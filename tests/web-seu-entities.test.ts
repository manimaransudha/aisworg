// SEU pages (src/routes/seu/web/seus.ts): the SEU list and the form that starts one, saving and validating an SEU, and the routes on an SEU's page that create and
// move its Attention Items, Evidence, Knowledge, Decisions, Obligations, External Interactions, Deliverables, Capabilities and EBM.
//
//   - Each route is called over HTTP from the real app as root. A POST answers with a redirect; the test reads the flash message on the page it leads to, then
//     reads what the route wrote from the database.
//   - The entities are moved with the verbs their state offers to root (nextActionsFor), one hop at a time, and the state is read after each hop.
//   - The SEUs are plain rows with a Deliverable or two, as in the other tests that need an SEU without commissioning one. Rows are not deleted.
import { platformConceptCodes } from "./schemaFixtures.js";
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import pool from "../src/utils/db.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { evidenceDB } from "../src/dblayer/evidenceDB.js";
import { knowledgeItemsDB } from "../src/dblayer/knowledgeItemsDB.js";
import { decisionsDB } from "../src/dblayer/decisionsDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { externalInteractionsDB } from "../src/dblayer/externalInteractionsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { objectivesDB } from "../src/dblayer/objectivesDB.js";
import { listConceptsForType } from "../src/routes/seu/core/ontology.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { dependencyDefinitionsDB } from "../src/dblayer/dependencyDefinitionsDB.js";
import { commissionScenario, type ScenarioSeu } from "./webScenarios.js";
import {
  ROOT_USER_ID, ROOT_ACTOR_ID, createActiveObjective, createObligationAsRoot, ensureWebAppTemplateFixture,
  setWebBaseUrl, newSession, extractCsrf, getPage, getRedirect, postForm, pageAlerts, assertPageMatches, assertPageDoesNotMatch, type Session,
} from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
let server: ReturnType<typeof app.listen>;
let root: Session;
let csrf: string;
let t: ScenarioSeu;
let deliverableA: { id: string; name: string };
let deliverableB: { id: string; name: string };
let deliverableC: { id: string; name: string };
let birthState: string;

before(async () => {
  t = await commissionScenario("rich", "web-seu-entities");
  const { data: birth } = await transitionDefinitionsDB.findBirth("Deliverable");
  assert.ok(birth);
  birthState = birth.to_state;
  // The Deliverables are the ones commissioning made for the SEU. Three that are still in the birth state are used, and the third is one that no dependency gates, so it can be moved.
  const fresh = ((await deliverablesDB.findBySeuId(t.seu.id)).data ?? []).filter((d) => d.lifecycle_state === birthState);
  const { data: ebm } = await ebmsDB.findById(t.seu.active_ebm_id!);
  const source = (ebm!.composition_report as { deliverableSource: { type: "Template" | "Profile"; id: string } }).deliverableSource;
  const gated = new Set(((await dependencyDefinitionsDB.findByOwner(source.type, source.id)).data ?? []).filter((r) => r.to_entity_type === "Deliverable" && r.to_name).map((r) => r.to_name));
  const free = fresh.filter((d) => !gated.has(d.name) && !(d.code && gated.has(d.code)));
  assert.ok(free.length >= 1 && fresh.length >= 3, `commissioning left ${fresh.length} Deliverables in ${birthState}, ${free.length} of them not gated by a dependency`);
  const movable = free[0];
  const [a, b] = fresh.filter((d) => d.id !== movable.id);
  [deliverableA, deliverableB, deliverableC] = [a, b, movable].map((d) => ({ id: d.id, name: d.name }));

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  setWebBaseUrl(`http://127.0.0.1:${address.port}/aisworg`);
  root = newSession(ROOT_USER_ID);
  csrf = extractCsrf((await getPage(root, "/seu/data-migrations")).html);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
});

const readable = (text: string) => text.replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");
const hasAlert = (alerts: string[], pattern: RegExp) => assert.ok(alerts.some((a) => pattern.test(a)), `expected ${pattern}, the page showed ${JSON.stringify(alerts)}`);
const seuPath = (suffix = "") => `/seu/seus/${t.seu.id}${suffix}`;

async function submit(pathName: string, fields: Record<string, string | string[]> = {}): Promise<{ alerts: string[]; location: string }> {
  const posted = await postForm(root, pathName, csrf, fields);
  assert.equal(posted.status, 302, `POST ${pathName}`);
  assert.ok(posted.location);
  const page = await getPage(root, posted.location.replace(/^\/aisworg/, ""));
  assert.equal(page.status, 200, `GET ${posted.location}`);
  return { alerts: pageAlerts(page.html).map(readable), location: posted.location };
}

const concepts = async (type: string) => (await listConceptsForType(type, { isRoot: true, tenantId: null }, false)).map((c) => c.code);

// Takes the entity along the verbs its state offers to root, one hop at a time, until `until` says to stop or nothing is offered.
async function walk(input: { entityType: Parameters<typeof nextActionsFor>[0]; label: string; statusOf: () => Promise<string>; hop: (verb: string) => string; until?: (status: string) => boolean; max?: number }): Promise<string[]> {
  const visited: string[] = [];
  for (let step = 0; step < (input.max ?? 8); step++) {
    const status = await input.statusOf();
    if (input.until?.(status)) break;
    const actions = await nextActionsFor(input.entityType, status, ROOT_ACTOR_ID);
    const next = actions.find((a) => !/reject|cancel|fail|supersede/i.test(a.verb)) ?? actions[0];
    if (!next) break;
    const result = await submit(input.hop(next.verb));
    hasAlert(result.alerts, new RegExp(`${input.label} moved from "${status}" to "${next.toState}"\\.`));
    assert.equal(await input.statusOf(), next.toState);
    visited.push(next.toState);
  }
  return visited;
}

// ── the list, the form and the first steps of commissioning ───────────────────────────────────────────────────────

test("the SEU list shows an SEU by its Objective and filters by lifecycle state", async () => {
  const { data: objective } = await objectivesDB.findById(t.seu.objective_id);
  assert.ok(objective);
  const listed = await getPage(root, `/seu/seus?q=${encodeURIComponent(objective.statement)}`);
  assert.equal(listed.status, 200);
  assertPageMatches(listed.html, new RegExp(objective.statement));

  const inState = await getPage(root, `/seu/seus?q=${encodeURIComponent(objective.statement)}&status=${t.seu.lifecycle_state}`);
  assertPageMatches(inState.html, new RegExp(objective.statement));
  const otherState = await getPage(root, "/seu/seus?status=Retired");
  assertPageDoesNotMatch(otherState.html, new RegExp(objective.statement), "the state filter shows only the SEUs in that state");
});

test("an SEU is saved against an Active leaf Objective and a Profile, validated, and refused when the Objective is not Active, is a Strategic umbrella or is not chosen", async () => {
  const { template, profile } = await ensureWebAppTemplateFixture();
  const { objective: strategic } = await createActiveObjective({ statement: `web-seu ${run} strategic`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: ROOT_ACTOR_ID });
  const { objective: leaf } = await createActiveObjective({ statement: `web-seu ${run} leaf`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: strategic.id, requestedBy: ROOT_ACTOR_ID });
  const selection = `${template.id}|${profile.id}`;

  const form = await getPage(root, `/seu/seus/new?objectiveId=${leaf.id}`);
  assert.equal(form.status, 200);
  assertPageMatches(form.html, /Commission SEU from Objective/);
  const picker = await getPage(root, "/seu/seus/new");
  assertPageMatches(picker.html, new RegExp(leaf.statement), "the Objective with no SEU yet is offered for commissioning");
  const unknown = await getRedirect(root, `/seu/seus/new?objectiveId=${randomUUID()}`);
  assert.equal(unknown.status, 302);

  hasAlert((await submit("/seu/seus", { templateProfile: selection })).alerts, /Choose an Objective to commission against\./);
  hasAlert((await submit("/seu/seus", { objectiveId: leaf.id })).alerts, /Choose a Profile to commission against\./);
  hasAlert((await submit("/seu/seus", { objectiveId: strategic.id, templateProfile: selection })).alerts, /a Strategic Objective is a programme umbrella/);
  const { objective: defined } = await createObjective({ statement: `web-seu ${run} defined`, requiredCapabilityCodes: [], tier: "Operational", parentObjectiveId: strategic.id, requestedBy: ROOT_ACTOR_ID });
  hasAlert((await submit("/seu/seus", { objectiveId: defined.id, templateProfile: selection })).alerts, /objective is not Active \(status: Defined\)/);

  const saved = await submit("/seu/seus", { objectiveId: leaf.id, templateProfile: selection });
  hasAlert(saved.alerts, /SEU saved\. Validate it to continue commissioning\./);
  assert.equal(saved.location, `/aisworg/seu/seus/new?objectiveId=${leaf.id}`);
  const seu = (await seusDB.findByObjectiveId(leaf.id)).data!;
  assert.deepEqual([seu.lifecycle_state, seu.profile_id, seu.template_id], ["Initiated", profile.id, template.id]);
  hasAlert((await submit("/seu/seus", { objectiveId: leaf.id, templateProfile: selection })).alerts, /SEU saved\./);
  assert.equal((await seusDB.findByObjectiveId(leaf.id)).data?.id, seu.id, "saving the same selection again reuses the SEU");

  hasAlert((await submit(`/seu/seus/${randomUUID()}/transition/validate`)).alerts, /SEU not found\./);
  hasAlert((await submit(`/seu/seus/${seu.id}/transition/zz-no-verb`)).alerts, /SEU transition blocked: no "zz-no-verb" step from Initiated/);
  const validated = await submit(`/seu/seus/${seu.id}/transition/validate`);
  hasAlert(validated.alerts, /SEU validated — compose the Engineering Behavior Model next\./);
  assert.equal(validated.location, `/aisworg/seu/objectives/${leaf.id}/validate-commission`);
  assert.equal((await seusDB.findById(seu.id)).data?.lifecycle_state, "Validated");
});

test("the page of an SEU and its EBM page are shown, and an SEU that does not exist leads back to the list", async () => {
  const detail = await getPage(root, seuPath());
  assert.equal(detail.status, 200);
  assertPageMatches(detail.html, new RegExp(deliverableA.name));
  assertPageMatches(detail.html, new RegExp(deliverableB.name));
  assert.equal((await getPage(root, seuPath("/ebm"))).status, 200);

  const missing = await getRedirect(root, `/seu/seus/${randomUUID()}`);
  assert.equal(missing.location, "/aisworg/seu/seus");
  hasAlert(pageAlerts((await getPage(root, "/seu/seus")).html).map(readable), /SEU not found\./);
  assert.equal((await getRedirect(root, `/seu/seus/${randomUUID()}/ebm`)).location, "/aisworg/seu/seus");
});

// ── Attention Items ───────────────────────────────────────────────────────────────────────────────────────────────

test("an Attention Item is raised on an SEU, optionally for a Deliverable, and moved along its lifecycle; a form with no category or title is refused", async () => {
  hasAlert((await submit(seuPath("/attention-items"), { category: " ", title: "x" })).alerts, /Category and title are required\./);
  const title = `Raised from the SEU page ${run}`;
  const created = await submit(seuPath("/attention-items"), { category: "Action Required", title, priority: "High", deliverableId: deliverableA.id });
  hasAlert(created.alerts, new RegExp(`Attention Item "${title}" created \\(Action Required, High\\)\\.`));
  const item = ((await attentionItemsDB.findBySeuId(t.seu.id)).data ?? []).find((a) => a.title === title)!;
  assert.deepEqual([item.related_object_type, item.related_object_id, item.priority], ["Deliverable", deliverableA.id, "High"]);

  const general = `Raised for the SEU ${run}`;
  hasAlert((await submit(seuPath("/attention-items"), { category: "Action Required", title: general })).alerts, /created \(Action Required, /);
  assert.equal(((await attentionItemsDB.findBySeuId(t.seu.id)).data ?? []).find((a) => a.title === general)?.related_object_id, null);

  hasAlert((await submit(seuPath(`/attention-items/${randomUUID()}/transition/anything`))).alerts, /Attention Item not found\./);
  hasAlert((await submit(seuPath(`/attention-items/${item.id}/transition/zz-no-verb`))).alerts, new RegExp(`"zz-no-verb" is not available from ${item.status}\\.`));
  const visited = await walk({ entityType: "AttentionItem", label: "Attention Item", statusOf: async () => (await attentionItemsDB.findById(item.id)).data!.status, hop: (verb) => seuPath(`/attention-items/${item.id}/transition/${verb}`), max: 2 });
  assert.ok(visited.length >= 1, "root can take at least the first hop");
});

// ── Evidence, Knowledge and Decisions ─────────────────────────────────────────────────────────────────────────────

test("Evidence is collected for a Deliverable, assessed on a validation dimension, linked to another Deliverable and moved along its lifecycle", async () => {
  hasAlert((await submit(seuPath("/evidence"), { deliverableId: deliverableA.id, category: "Analytical Evidence", title: " " })).alerts, /Deliverable, category and title are required\./);
  const title = `Collected evidence ${run}`;
  hasAlert((await submit(seuPath("/evidence"), { deliverableId: deliverableA.id, category: "Analytical Evidence", title, description: "What was seen", source: "vcs://source" })).alerts, new RegExp(`Evidence "${title}" collected \\(Analytical Evidence\\)\\.`));
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM evidence WHERE title = $1", [title]);
  assert.equal(rows.length, 1);
  const evidence = (await evidenceDB.findById(rows[0].id)).data!;
  assert.deepEqual([evidence.status, evidence.source, evidence.description], ["Collected", "vcs://source", "What was seen"]);
  const validatePath = seuPath(`/evidence/${evidence.id}/validate`);

  hasAlert((await submit(validatePath, { dimension: "", status: "x" })).alerts, /Dimension and status are required\./);
  const [dimension] = await concepts("evidence-validation-dimension");
  const [status] = await concepts("evidence-validation-status");
  assert.ok(dimension && status, "the Ontology holds validation dimensions and statuses");
  hasAlert((await submit(validatePath, { dimension, status, notes: "Looks right" })).alerts, new RegExp(`Recorded "${dimension}" assessment \\(${status}\\) — confidence now `));
  assert.equal((await evidenceDB.findById(evidence.id)).data?.validation_dimensions.length, 1);
  hasAlert((await submit(seuPath(`/evidence/${randomUUID()}/validate`), { dimension, status })).alerts, /Evidence not found\./);

  hasAlert((await submit(seuPath(`/evidence/${evidence.id}/link`), {})).alerts, /Deliverable is required\./);
  hasAlert((await submit(seuPath(`/evidence/${evidence.id}/link`), { deliverableId: deliverableB.id })).alerts, /Evidence linked\./);
  const relationships = (await evidenceDB.findRelationshipsByEvidenceId(evidence.id)).data ?? [];
  assert.ok(relationships.some((r) => r.related_object_id === deliverableB.id), "the Evidence is linked to the second Deliverable");
  hasAlert((await submit(seuPath(`/evidence/${randomUUID()}/link`), { deliverableId: deliverableB.id })).alerts, /Evidence not found\./);

  hasAlert((await submit(seuPath(`/evidence/${randomUUID()}/transition/anything`))).alerts, /Evidence not found\./);
  hasAlert((await submit(seuPath(`/evidence/${evidence.id}/transition/zz-no-verb`))).alerts, /"zz-no-verb" is not available from Collected\./);
  const visited = await walk({ entityType: "Evidence", label: "Evidence", statusOf: async () => (await evidenceDB.findById(evidence.id)).data!.status, hop: (verb) => seuPath(`/evidence/${evidence.id}/transition/${verb}`), max: 3 });
  assert.ok(visited.length >= 1);
});

test("a Knowledge Item is observed with its supporting Evidence, moved to Published, and only then promoted one Acquisition Scope tier at a time; the form is refused without its fields or Evidence", async () => {
  hasAlert((await submit(seuPath("/evidence"), { deliverableId: deliverableA.id, category: "Analytical Evidence", title: `Support ${run}` })).alerts, /collected/);
  const supporting = (await pool.query<{ id: string }>("SELECT id FROM evidence WHERE title = $1", [`Support ${run}`])).rows[0].id;

  hasAlert((await submit(seuPath("/knowledge"), { deliverableId: deliverableA.id, category: "Technical Knowledge", title: " ", evidenceId: supporting })).alerts, /Deliverable, category and title are required\./);
  hasAlert((await submit(seuPath("/knowledge"), { deliverableId: deliverableA.id, category: "Technical Knowledge", title: `No evidence ${run}` })).alerts, /Select the supporting Evidence\./);
  const title = `Observed knowledge ${run}`;
  hasAlert((await submit(seuPath("/knowledge"), { deliverableId: deliverableA.id, evidenceId: supporting, category: "Technical Knowledge", title, description: "Seen in practice" })).alerts, new RegExp(`Knowledge Item "${title}" observed \\(Technical Knowledge, SEU scope\\)\\.`));
  const item = ((await knowledgeItemsDB.findByDeliverableId(deliverableA.id)).data ?? []).find((k) => k.title === title)!;
  assert.deepEqual([item.status, item.acquisition_scope], ["Observed", "SEU"]);

  const promotePath = seuPath(`/knowledge/${item.id}/promote-scope`);
  hasAlert((await submit(promotePath, {})).alerts, /Target scope is required\./);
  hasAlert((await submit(promotePath, { targetScope: "Capability" })).alerts, /Acquisition Scope promotion blocked: Knowledge Item must be Published before its Acquisition Scope can be promoted \(currently Observed\)/);

  hasAlert((await submit(seuPath(`/knowledge/${randomUUID()}/transition/anything`))).alerts, /Knowledge Item not found\./);
  hasAlert((await submit(seuPath(`/knowledge/${item.id}/transition/zz-no-verb`))).alerts, /"zz-no-verb" is not available from Observed\./);
  await walk({ entityType: "Knowledge", label: "Knowledge Item", statusOf: async () => (await knowledgeItemsDB.findById(item.id)).data!.status, hop: (verb) => seuPath(`/knowledge/${item.id}/transition/${verb}`), until: (s) => s === "Published" });
  assert.equal((await knowledgeItemsDB.findById(item.id)).data?.status, "Published");

  hasAlert((await submit(promotePath, { targetScope: "Platform" })).alerts, /promotion is one tier at a time/);
  assert.equal((await knowledgeItemsDB.findById(item.id)).data?.acquisition_scope, "SEU", "a refused promotion changes nothing");
  hasAlert((await submit(promotePath, { targetScope: "Capability" })).alerts, /Knowledge Item promoted from "SEU" to "Capability" scope\. Organisational Learning Obligation raised: "Codify /);
  assert.equal((await knowledgeItemsDB.findById(item.id)).data?.acquisition_scope, "Capability");
  const obligations = (await obligationsDB.findByRelatedObject("Deliverable", deliverableA.id)).data ?? [];
  assert.ok(obligations.some((o) => o.category === "Organisational Learning" && o.title.includes(title)), "the promotion raised an Obligation for the Deliverable");
});

test("a Decision is identified on Evidence or Knowledge and moved along its lifecycle; the form is refused without its fields or support", async () => {
  hasAlert((await submit(seuPath("/evidence"), { deliverableId: deliverableB.id, category: "Analytical Evidence", title: `Decision support ${run}` })).alerts, /collected/);
  const supporting = (await pool.query<{ id: string }>("SELECT id FROM evidence WHERE title = $1", [`Decision support ${run}`])).rows[0].id;

  hasAlert((await submit(seuPath("/decisions"), { deliverableId: deliverableB.id, category: "Engineering Decisions", title: " ", evidenceId: supporting })).alerts, /Deliverable, category and title are required\./);
  hasAlert((await submit(seuPath("/decisions"), { deliverableId: deliverableB.id, category: "Engineering Decisions", title: `Unsupported ${run}` })).alerts, /Select supporting Knowledge or Evidence, or both\./);
  const title = `Identified decision ${run}`;
  hasAlert((await submit(seuPath("/decisions"), {
    deliverableId: deliverableB.id, evidenceId: supporting, category: "Engineering Decisions", title, engineeringQuestion: "Which way?", alternativeStatement: "Take the left path", alternativeRationale: "It is shorter",
  })).alerts, new RegExp(`Decision "${title}" identified \\(Engineering Decisions\\)\\.`));
  const decision = ((await decisionsDB.findBySeuId(t.seu.id)).data ?? []).find((d) => d.title === title)!;
  assert.deepEqual([decision.status, decision.engineering_question, decision.alternatives.map((a) => a.statement)], ["Identified", "Which way?", ["Take the left path"]]);

  hasAlert((await submit(seuPath(`/decisions/${randomUUID()}/transition/anything`))).alerts, /Decision not found\./);
  hasAlert((await submit(seuPath(`/decisions/${decision.id}/transition/zz-no-verb`))).alerts, /"zz-no-verb" is not available from Identified\./);
  const visited = await walk({ entityType: "Decision", label: "Decision", statusOf: async () => (await decisionsDB.findById(decision.id)).data!.status, hop: (verb) => seuPath(`/decisions/${decision.id}/transition/${verb}`), max: 2 });
  assert.equal(visited.length, 2);
});

// ── Obligations, External Interactions, Deliverables ─────────────────────────────────────────────────────────────

test("an Obligation is revised and moved along its lifecycle from the SEU page", async () => {
  const [severityCode] = await platformConceptCodes("category:obligation-severity", 1);
  const [priorityCode] = await platformConceptCodes("category:obligation-priority", 1);
  const obligation = await createObligationAsRoot({ relatedObjectType: "Deliverable", relatedObjectId: deliverableA.id, category: "Operational", title: `Obligation to revise ${run}` });
  hasAlert((await submit(seuPath(`/obligations/${obligation.id}/revise`), { title: `Obligation revised ${run}`, description: "Now with a description", category: obligation.category, severity: obligation.severity ?? severityCode, priority: obligation.priority ?? priorityCode, completionCriteria: "Done when checked" })).alerts, /Obligation saved\./);
  const revised = (await obligationsDB.findById(obligation.id)).data!;
  assert.deepEqual([revised.title, revised.description, revised.completion_criteria], [`Obligation revised ${run}`, "Now with a description", "Done when checked"]);

  hasAlert((await submit(seuPath(`/obligations/${randomUUID()}/transition/anything`))).alerts, /Obligation not found\./);
  hasAlert((await submit(seuPath(`/obligations/${obligation.id}/transition/zz-no-verb`))).alerts, new RegExp(`"zz-no-verb" is not available from ${revised.status}\\.`));
  const visited = await walk({ entityType: "Obligation", label: "Obligation", statusOf: async () => (await obligationsDB.findById(obligation.id)).data!.status, hop: (verb) => seuPath(`/obligations/${obligation.id}/transition/${verb}`), max: 2 });
  assert.equal(visited.length, 2);
});

test("an External Interaction is recorded for an SEU and moved by the target state posted; a form with no type, direction or system, or a hop it does not have, is refused", async () => {
  hasAlert((await submit(seuPath("/external-interactions"), { interactionType: "webhook", direction: "Outbound", targetSystem: " " })).alerts, /Interaction type, direction and target system are required\./);
  const created = await submit(seuPath("/external-interactions"), { deliverableId: deliverableA.id, interactionType: "webhook", direction: "Outbound", targetSystem: `ci-${run}`, purpose: "Notify the CI" });
  hasAlert(created.alerts, new RegExp(`External Interaction with "ci-${run}" recorded \\(webhook, Outbound\\)\\.`));
  const interaction = ((await pool.query<{ id: string }>("SELECT id FROM external_interactions WHERE target_system = $1", [`ci-${run}`])).rows[0])!;
  const row = (await externalInteractionsDB.findById(interaction.id)).data!;
  assert.deepEqual([row.status, row.direction, row.deliverable_id, row.purpose], ["Created", "Outbound", deliverableA.id, "Notify the CI"]);

  const transition = seuPath(`/external-interactions/${interaction.id}/transition`);
  hasAlert((await submit(transition, {})).alerts, /Target state is required\./);
  hasAlert((await submit(transition, { targetState: "Completed" })).alerts, /External Interaction transition blocked: no Transition Definition for ExternalInteraction Created -> Completed/);
  for (const [from, to] of [["Created", "Validated"], ["Validated", "Dispatched"], ["Dispatched", "Acknowledged"], ["Acknowledged", "Completed"]]) {
    hasAlert((await submit(transition, { targetState: to })).alerts, new RegExp(`External Interaction moved from "${from}" to "${to}"\\.`));
    assert.equal((await externalInteractionsDB.findById(interaction.id)).data?.status, to);
  }
  const noDeliverable = await submit(seuPath("/external-interactions"), { interactionType: "email", direction: "Inbound", targetSystem: `mail-${run}` });
  hasAlert(noDeliverable.alerts, /recorded \(email, Inbound\)\./);
  const ghost = await submit(seuPath("/external-interactions"), { deliverableId: randomUUID(), interactionType: "email", direction: "Inbound", targetSystem: `ghost-${run}` });
  assert.ok(ghost.alerts.length > 0 && !ghost.alerts.some((a) => /recorded/.test(a)), "an interaction for a Deliverable that does not exist is not recorded");
});

test("a Deliverable is moved by the Execution Engine from the SEU page, which records a completed Command, and a transition the Deliverable does not have is refused", async () => {
  const path = seuPath(`/deliverables/${deliverableC.id}/transition`);
  hasAlert((await submit(path, {})).alerts, /Target state is required\./);
  const stateBefore = (await deliverablesDB.findById(deliverableC.id)).data?.lifecycle_state;
  hasAlert((await submit(path, { targetState: "Baselined" })).alerts, /Transition blocked: no Transition Definition for Deliverable [A-Za-z ]+ -> Baselined/);
  assert.equal((await deliverablesDB.findById(deliverableC.id)).data?.lifecycle_state, stateBefore, "a refused hop changes nothing");

  hasAlert((await submit(path, { targetState: "In Progress" })).alerts, /Deliverable "[A-Za-z ]+" → "In Progress" completed by the Execution Engine\./);
  assert.equal((await deliverablesDB.findById(deliverableC.id)).data?.lifecycle_state, "In Progress");
  const commands = ((await commandsDB.findBySeuId(t.seu.id)).data ?? []).filter((c) => c.entity_id === deliverableC.id && c.to_state === "In Progress");
  assert.deepEqual(commands.map((c) => c.status), ["Completed"], "the hop left one Completed Command");
});

// ── Capabilities and the EBM ──────────────────────────────────────────────────────────────────────────────────────

test("the Capability routes refuse a replacement with no type or name, a release of no Participant and a request for a Capability the SEU does not require", async () => {
  const capabilityId = (await pool.query<{ id: string }>("SELECT id FROM capability_definitions ORDER BY created_at LIMIT 1")).rows[0].id;
  const base = seuPath(`/capabilities/${capabilityId}`);
  hasAlert((await submit(`${base}/participant/${randomUUID()}/replace`, { participantType: "Human", displayName: " " })).alerts, /Replacement Participant type and display name are required\./);
  hasAlert((await submit(`${base}/release`, {})).alerts, /At least one Participant is required\./);
  const requested = await submit(`${base}/fulfil`, {});
  assert.ok(requested.alerts.length > 0 && !requested.alerts.some((a) => /Capability requested\./.test(a)), JSON.stringify(requested.alerts));
  const released = await submit(`${base}/release`, { participantIds: randomUUID() });
  assert.ok(released.alerts.length > 0 && !released.alerts.some((a) => /Released:/.test(a)), JSON.stringify(released.alerts));
});

test("the EBM routes refuse a transition for an SEU with no EBM, and a verb the EBM's state does not offer", async () => {
  const bare = await commissionScenario("unsettled", "web-seu-ebm-none", { conflictSet: "entities" });
  assert.equal(bare.seu.active_ebm_id, null);
  hasAlert((await submit(`/seu/seus/${bare.seu.id}/ebm/transition/validate`)).alerts, /This SEU has no Engineering Behavior Model to transition yet\./);

  const ebm = (await ebmsDB.findById(t.seu.active_ebm_id!)).data!;
  const refused = await postForm(root, `/seu/seus/${t.seu.id}/ebm/transition/zz-no-verb`, csrf, {});
  assert.equal(refused.status, 302);
  assert.equal(refused.location, `/aisworg/seu/seus/${t.seu.id}`);
  hasAlert(pageAlerts((await getPage(root, "/seu/seus")).html).map(readable), new RegExp(`EBM transition blocked: no "zz-no-verb" step from ${ebm.status}`));
});
