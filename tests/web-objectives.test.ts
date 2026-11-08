// Objective pages (src/routes/seu/web/objectives.ts): the new-Objective form and its rules, creating an Objective at any tier and superseding another with
// it, the detail and edit pages, updating, moving, the lifecycle transitions, comments, and the routes that carry an Objective into commissioning (validate,
// compose the EBM, resolve conflicts). tests/objectives-controller.test.ts covers the tree, the Rejected list, search, delete and subtree retire.
//
//   - Each route is called over HTTP from the real app as root. A POST answers with a redirect; the test reads the flash message on the page it leads to, then
//     reads the Objective from the database.
//   - Objective statements carry the run tag. Rows are not deleted, as in the other tests that create Objectives and SEUs.
//   - The commissioning routes run on a plain SEU row, with events the commissioning would publish written by the test.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import pool from "../src/utils/db.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { objectivesDB } from "../src/dblayer/objectivesDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { objectiveInitialState } from "../src/routes/seu/core/objectives.js";
import { blockingEbmConflicts } from "../src/domain/engine/conflicts/index.js";
import { publishTestEvent } from "./engineFixtures.js";
import { commissionScenario } from "./webScenarios.js";
import {
  ROOT_USER_ID, ROOT_ACTOR_ID, createActiveObjective, waitUntilAsync, transitionObjective,
  setWebBaseUrl, newSession, extractCsrf, getPage, getRedirect, postForm, pageAlerts, assertPageMatches, assertPageDoesNotMatch, type Session,
} from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const CAPABILITIES = ["architecture-design", "requirements-analysis"];
let counter = 0;
const statement = (label: string) => `web-objectives ${run} ${label} ${++counter}`;
let server: ReturnType<typeof app.listen>;
let root: Session;
let csrf: string;
let initialState: string;

before(async () => {
  initialState = await objectiveInitialState();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  setWebBaseUrl(`http://127.0.0.1:${address.port}/aisworg`);
  root = newSession(ROOT_USER_ID);
  csrf = extractCsrf((await getPage(root, "/seu/objectives")).html);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
});

const readable = (text: string) => text.replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");
const hasAlert = (alerts: string[], pattern: RegExp) => assert.ok(alerts.some((a) => pattern.test(a)), `expected ${pattern}, the page showed ${JSON.stringify(alerts)}`);

// Reads the flash message on the page a redirect leads to.
async function flashAt(location: string | null): Promise<{ alerts: string[]; html: string; location: string }> {
  assert.ok(location, "the request answered with a redirect");
  const page = await getPage(root, location.replace(/^\/aisworg/, ""));
  assert.equal(page.status, 200, `GET ${location}`);
  return { alerts: pageAlerts(page.html).map(readable), html: page.html, location };
}

async function submit(pathName: string, fields: Record<string, string | string[]> = {}) {
  const posted = await postForm(root, pathName, csrf, fields);
  assert.equal(posted.status, 302, `POST ${pathName}`);
  return flashAt(posted.location);
}

async function visit(pathName: string) {
  const redirect = await getRedirect(root, pathName);
  assert.equal(redirect.status, 302, `GET ${pathName}`);
  return flashAt(redirect.location);
}

async function createViaForm(fields: Record<string, string | string[]>) {
  // The form sends the tier: Strategic for a root Objective, the tier chosen for a child.
  const result = await submit("/seu/objectives", { requiredCapabilityCodes: CAPABILITIES, ...(fields.parentObjectiveId ? {} : { tier: "Strategic" }), ...fields });
  return result;
}

async function objectiveNamed(text: string) {
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM objectives WHERE statement = $1", [text]);
  assert.equal(rows.length, 1, `exactly one Objective states "${text}"`);
  return (await objectivesDB.findById(rows[0].id)).data!;
}

test("the new-Objective form offers the tier the parent allows, and turns back a tier it does not, a parent that does not exist and an Objective to supersede that does not exist", async () => {
  const fresh = await getPage(root, "/seu/objectives/new");
  assert.equal(fresh.status, 200);
  assertPageMatches(fresh.html, /New Strategic Objective/);

  const { objective: strategic } = await createActiveObjective({ statement: statement("form-strategic"), requiredCapabilityCodes: [], tier: "Strategic", requestedBy: ROOT_ACTOR_ID });
  const child = await getPage(root, `/seu/objectives/new?parent=${strategic.id}&tier=Operational`);
  assert.equal(child.status, 200);
  assertPageMatches(child.html, /New Operational Objective/);

  const wrongTier = await visit(`/seu/objectives/new?parent=${strategic.id}&tier=Strategic`);
  assert.equal(wrongTier.location, `/aisworg/seu/objectives/${strategic.id}`);
  hasAlert(wrongTier.alerts, /A Strategic Objective can only add: Operational, Engineering children\./);
  const noTier = await visit(`/seu/objectives/new?parent=${strategic.id}`);
  hasAlert(noTier.alerts, /can only add: Operational, Engineering children\./);

  const { objective: engineering } = await createActiveObjective({ statement: statement("form-engineering"), requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: strategic.id, requestedBy: ROOT_ACTOR_ID });
  hasAlert((await visit(`/seu/objectives/new?parent=${engineering.id}&tier=Engineering`)).alerts, /A Engineering Objective can only add: no children\./);

  hasAlert((await visit(`/seu/objectives/new?parent=${randomUUID()}&tier=Operational`)).alerts, /Parent Objective not found\./);
  hasAlert((await visit(`/seu/objectives/new?supersedes=${randomUUID()}`)).alerts, /Objective to supersede not found\./);
  const supersede = await getPage(root, `/seu/objectives/new?supersedes=${strategic.id}`);
  assert.equal(supersede.status, 200);
  assertPageMatches(supersede.html, new RegExp(strategic.statement), "the form names the Objective it will supersede");
});

test("an Objective is created at its tier with its Capabilities, under a parent when it has one; a form with no statement or Capability is turned back with what was typed kept", async () => {
  const typed = statement("typed-not-sent");
  const incomplete = await createViaForm({ statement: typed, requiredCapabilityCodes: [] });
  hasAlert(incomplete.alerts, /Statement and at least one required Capability are required\./);
  assert.equal(incomplete.location, "/aisworg/seu/objectives/new");
  assertPageMatches(incomplete.html, new RegExp(typed), "the statement typed is shown again");
  assert.equal((await createViaForm({ statement: " " })).alerts.some((a) => /Statement and at least one/.test(a)), true);

  const top = statement("created-strategic");
  const created = await createViaForm({ statement: top });
  hasAlert(created.alerts, new RegExp(`Objective created as ${initialState}\\. Activate it before commissioning an SEU against it\\.`));
  const strategic = await objectiveNamed(top);
  assert.deepEqual([strategic.tier, strategic.status, strategic.parent_objective_id], ["Strategic", initialState, null]);
  assert.deepEqual(((await objectivesDB.getRequiredCapabilities(strategic.id)).data ?? []).map((c) => c.code).sort(), [...CAPABILITIES].sort());

  const operationalText = statement("created-operational");
  hasAlert((await createViaForm({ statement: operationalText, tier: "Operational", parentObjectiveId: strategic.id, requiredCapabilityCodes: CAPABILITIES[0] })).alerts, /Objective created as/);
  const operational = await objectiveNamed(operationalText);
  assert.deepEqual([operational.tier, operational.parent_objective_id], ["Operational", strategic.id]);
  assert.deepEqual(((await objectivesDB.getRequiredCapabilities(operational.id)).data ?? []).map((c) => c.code), [CAPABILITIES[0]], "a single Capability is read as a list of one");

  const refusedText = statement("refused-engineering-root");
  const refused = await createViaForm({ statement: refusedText, tier: "Engineering" });
  assert.ok(refused.alerts.length > 0 && !refused.alerts.some((a) => /Objective created/.test(a)), JSON.stringify(refused.alerts));
  assert.equal(refused.location.startsWith("/aisworg/seu/objectives/new"), true, "a refused create leads back to the form");
  const { rows } = await pool.query("SELECT 1 FROM objectives WHERE statement = $1", [refusedText]);
  assert.equal(rows.length, 0);

  hasAlert((await createViaForm({ statement: statement("unknown-capability"), requiredCapabilityCodes: ["zz-no-capability"] })).alerts, /unknown capability code\(s\): zz-no-capability/);
});

test("a new Objective supersedes an Active one when a comment explains it: the original is Superseded and points at the new one", async () => {
  const { objective: original } = await createActiveObjective({ statement: statement("to-supersede"), requiredCapabilityCodes: [], tier: "Strategic", requestedBy: ROOT_ACTOR_ID });
  const replacementText = statement("replacement");

  const uncommented = await createViaForm({ statement: replacementText, supersedes: original.id });
  hasAlert(uncommented.alerts, /Supersede requires a comment explaining the supersession\./);
  assert.equal(uncommented.location, `/aisworg/seu/objectives/new?supersedes=${original.id}`);
  assert.equal((await objectivesDB.findById(original.id)).data?.status, "Active");

  const done = await createViaForm({ statement: replacementText, supersedes: original.id, supersedeComment: "The scope changed." });
  hasAlert(done.alerts, /Objective created as/);
  const replacement = await objectiveNamed(replacementText);
  const superseded = (await objectivesDB.findById(original.id)).data!;
  assert.deepEqual([superseded.status, superseded.superseding_objective_id], ["Superseded", replacement.id]);

  const { objective: notActive } = await createActiveObjective({ statement: statement("not-supersedable"), requiredCapabilityCodes: [], tier: "Strategic", requestedBy: ROOT_ACTOR_ID });
  await transitionObjective({ objectiveId: notActive.id, targetState: "Retired", actorId: ROOT_ACTOR_ID });
  const blockedText = statement("replacement-blocked");
  const blocked = await createViaForm({ statement: blockedText, supersedes: notActive.id, supersedeComment: "Too late." });
  hasAlert(blocked.alerts, /Objective created, but superseding the original was blocked: /);
  assert.equal(blocked.location, `/aisworg/seu/objectives/${(await objectiveNamed(blockedText)).id}`, "the Objective was created, so the page leads to it");
});

test("an Objective's page shows it and the verbs root may take, its edit page shows it for change, and one that does not exist leads back to the list", async () => {
  const text = statement("detail");
  await createViaForm({ statement: text });
  const objective = await objectiveNamed(text);

  const detail = await getPage(root, `/seu/objectives/${objective.id}`);
  assert.equal(detail.status, 200);
  assertPageMatches(detail.html, new RegExp(text));
  const activate = (await nextActionsFor("Objective", initialState, ROOT_ACTOR_ID)).find((a) => a.toState === "Active");
  assert.ok(activate, "root may activate an Objective in its first state");
  assertPageMatches(detail.html, new RegExp(`/seu/objectives/${objective.id}/transition/${activate.verb}`), "the page offers the verb root holds for activation");

  const edit = await getPage(root, `/seu/objectives/${objective.id}/edit`);
  assert.equal(edit.status, 200);
  assertPageMatches(edit.html, new RegExp(text));

  hasAlert((await visit(`/seu/objectives/${randomUUID()}`)).alerts, /Objective not found\./);
  hasAlert((await visit(`/seu/objectives/${randomUUID()}/edit`)).alerts, /Objective not found\./);
});

test("an Objective that is still in its first state is updated with a new version or without one, and the Capabilities posted replace the old; the form is turned back for none, and a later state cannot be edited", async () => {
  const text = statement("to-update");
  await createViaForm({ statement: text });
  const objective = await objectiveNamed(text);
  const updatePath = `/seu/objectives/${objective.id}/update`;

  const noCapabilities = await submit(updatePath, { statement: "Kept on the form", requiredCapabilityCodes: [] });
  hasAlert(noCapabilities.alerts, /At least one required Capability is required\./);
  assert.equal(noCapabilities.location, `/aisworg/seu/objectives/${objective.id}/edit`);
  assertPageMatches(noCapabilities.html, /Kept on the form/, "the edit page shows what was typed");
  hasAlert((await submit(updatePath, { statement: "  ", requiredCapabilityCodes: CAPABILITIES })).alerts, /Statement is required\./);

  const newText = statement("updated-statement");
  const versioned = await submit(updatePath, { statement: newText, requiredCapabilityCodes: [CAPABILITIES[1]] });
  const afterVersioned = (await objectivesDB.findById(objective.id)).data!;
  hasAlert(versioned.alerts, new RegExp(`Objective updated to v${String(afterVersioned.version).replace(/\./g, "\\.")}\\.`));
  assert.equal(afterVersioned.statement, newText);
  assert.notEqual(afterVersioned.version, objective.version, "a save bumps the version");
  assert.deepEqual(((await objectivesDB.getRequiredCapabilities(objective.id)).data ?? []).map((c) => c.code), [CAPABILITIES[1]]);

  const sameVersion = await submit(updatePath, { statement: `${newText} again`, requiredCapabilityCodes: CAPABILITIES, action: "save_no_version" });
  hasAlert(sameVersion.alerts, new RegExp(`Objective updated \\(still v${String(afterVersioned.version).replace(/\./g, "\\.")}\\)\\.`));
  assert.equal((await objectivesDB.findById(objective.id)).data?.version, afterVersioned.version);

  hasAlert((await submit(`/seu/objectives/${objective.id}/transition/activate`)).alerts, /moved from "/);
  hasAlert((await submit(updatePath, { statement: "Too late", requiredCapabilityCodes: CAPABILITIES })).alerts, new RegExp(`Objective is not ${initialState} \\(status: Active\\)`));
});

test("an Objective is moved under another parent while it is in its first state; a move that breaks the tree is refused with the reason", async () => {
  const strategicText = statement("move-strategic");
  await createViaForm({ statement: strategicText });
  const strategic = await objectiveNamed(strategicText);
  const make = async (label: string, tier: string, parentObjectiveId: string) => {
    const text = statement(label);
    hasAlert((await createViaForm({ statement: text, tier, parentObjectiveId })).alerts, /Objective created/);
    return objectiveNamed(text);
  };
  const operationalOne = await make("move-operational-one", "Operational", strategic.id);
  const operationalTwo = await make("move-operational-two", "Operational", strategic.id);
  const engineering = await make("move-engineering", "Engineering", operationalOne.id);

  hasAlert((await submit(`/seu/objectives/${engineering.id}/move`, { newParentId: operationalTwo.id })).alerts, /Objective moved\./);
  assert.equal((await objectivesDB.findById(engineering.id)).data?.parent_objective_id, operationalTwo.id);

  hasAlert((await submit(`/seu/objectives/${engineering.id}/move`, { newParentId: " " })).alerts, /a Engineering Objective requires a parent \(only Strategic may be a root\)/);
  hasAlert((await submit(`/seu/objectives/${operationalTwo.id}/move`, { newParentId: engineering.id })).alerts, /cannot be more strategic than its new parent's tier \(Engineering\)|would create a cycle/);
  assert.equal((await objectivesDB.findById(operationalTwo.id)).data?.parent_objective_id, strategic.id, "a refused move changes nothing");
});

test("an Objective is activated, and rejected only with a comment; an Active one is retired and then archived; a transition the state does not allow is refused", async () => {
  const make = async (label: string) => {
    const text = statement(label);
    hasAlert((await createViaForm({ statement: text })).alerts, /Objective created/);
    return objectiveNamed(text);
  };
  const status = async (id: string) => (await objectivesDB.findById(id)).data!.status;

  const first = await make("transition-reject");
  hasAlert((await submit(`/seu/objectives/${first.id}/transition/activate`)).alerts, new RegExp(`Objective moved from "${initialState}" to "Active"\\.`));
  assert.equal(await status(first.id), "Active");
  hasAlert((await submit(`/seu/objectives/${first.id}/transition/reject`)).alerts, /Transition blocked: /);
  assert.equal(await status(first.id), "Active", "a rejection with no comment is refused");
  hasAlert((await submit(`/seu/objectives/${first.id}/transition/reject`, { comment: "Out of scope." })).alerts, /Objective moved from "Active" to "Reject"\./);
  assert.equal(await status(first.id), "Reject");

  const second = await make("transition-retire");
  await submit(`/seu/objectives/${second.id}/transition/activate`);
  hasAlert((await submit(`/seu/objectives/${second.id}/transition/archive`)).alerts, /Transition blocked: /);
  hasAlert((await submit(`/seu/objectives/${second.id}/transition/retire`)).alerts, /Objective moved from "Active" to "Retired"\./);
  hasAlert((await submit(`/seu/objectives/${second.id}/transition/archive`)).alerts, /Objective moved from "Retired" to "Archived"\./);
  assert.equal(await status(second.id), "Archived");
});

test("a comment is added to an Objective and shown on its page, and a blank comment is refused", async () => {
  const text = statement("comment");
  await createViaForm({ statement: text });
  const objective = await objectiveNamed(text);

  const blank = await submit(`/seu/objectives/${objective.id}/comments`, { comment: "   " });
  hasAlert(blank.alerts, /Comment text is required\./);
  assert.equal(blank.location, `/aisworg/seu/objectives/${objective.id}/edit`);

  const added = await submit(`/seu/objectives/${objective.id}/comments`, { comment: `A comment for ${run}` });
  hasAlert(added.alerts, /Comment added\./);
  const comments = (await objectivesDB.findById(objective.id)).data!.comments as Array<{ text: string }>;
  assert.deepEqual(comments.map((c) => c.text), [`A comment for ${run}`]);
  assertPageMatches((await getPage(root, `/seu/objectives/${objective.id}`)).html, new RegExp(`A comment for ${run}`));
});

test("the commissioning routes of an Objective with no SEU lead to the form that starts one, and say why", async () => {
  const text = statement("no-seu");
  await createViaForm({ statement: text });
  const objective = await objectiveNamed(text);
  const reason = async () => pageAlerts((await getPage(root, "/seu/objectives")).html).map(readable);

  const validate = await getRedirect(root, `/seu/objectives/${objective.id}/validate-commission`);
  assert.equal(validate.location, `/aisworg/seu/seus/new?objectiveId=${objective.id}`);
  hasAlert(await reason(), /Nothing to validate — choose a Template\/Profile selection first\./);
  const compose = await getRedirect(root, `/seu/objectives/${objective.id}/compose-ebm`);
  assert.equal(compose.location, `/aisworg/seu/seus/new?objectiveId=${objective.id}`);
  hasAlert(await reason(), /Nothing to compose — choose a Template\/Profile selection first\./);
  const resolve = await getRedirect(root, `/seu/objectives/${objective.id}/resolve-conflicts`);
  assert.equal(resolve.location, `/aisworg/seu/objectives/${objective.id}/compose-ebm`);
  hasAlert(await reason(), /Nothing to resolve — compose this SEU first\./);

  const none = await postForm(root, `/seu/objectives/${objective.id}/compose-ebm`, csrf, {});
  assert.equal(none.location, `/aisworg/seu/objectives/${objective.id}/compose-ebm`);
  hasAlert(await reason(), /Nothing to re-validate\./);
  const noSeu = await postForm(root, `/seu/objectives/${objective.id}/compose-ebm`, csrf, { templateProfile: `${randomUUID()}|${randomUUID()}` });
  assert.equal(noSeu.status, 302);
  hasAlert(await reason(), /No SEU found for this Objective\./);
});

test("the validation page of an Objective's SEU shows that the request passed once the SEU is validated, and a failure with its reason and references", async () => {
  const { seu } = await commissionScenario("rich", "web-objectives-validate");
  const path = `/seu/objectives/${seu.objective_id}/validate-commission`;
  const passed = await getPage(root, path);
  assert.equal(passed.status, 200);
  assertPageMatches(passed.html, /Validate Request passed/);
  assertPageDoesNotMatch(passed.html, /Validate Request failed/);

  await publishTestEvent({ eventType: "CommissionFailed", originatingObjectType: "SEU", originatingObjectId: seu.id, seuId: seu.id, payload: { stage: "validate_request", reason: "A reference is gone", references: ["Template X", "Profile Y"], checks: [] } });
  const failed = await getPage(root, path);
  assertPageMatches(failed.html, /Validate Request failed: A reference is gone: Template X; Profile Y/);
  assertPageDoesNotMatch(failed.html, /Validate Request passed/, "a later failure replaces the pass");
});

test("composition that finds no conflict leaves the SEU Operational with its EBM, and the compose and resolve pages lead to the SEU", async () => {
  const { seu, objectiveId, conflictKeys } = await commissionScenario("clean", "web-objectives-clean", { conflictSet: "objectives" });
  assert.deepEqual(conflictKeys, [], "the composition found no conflict");
  assert.ok(seu.active_ebm_id, "the SEU has its EBM");
  const composed = await getRedirect(root, `/seu/objectives/${objectiveId}/compose-ebm`);
  assert.equal(composed.status, 302);
  assert.equal(composed.location, `/aisworg/seu/seus/${seu.id}`, "an SEU that already has its EBM leads to its own page");
  const resolved = await getRedirect(root, `/seu/objectives/${objectiveId}/resolve-conflicts`);
  assert.equal(resolved.location, `/aisworg/seu/seus/${seu.id}`);
});

test("composition that finds conflicts nobody settled stores them, announces nothing and leaves the SEU without an EBM; picking an option on the Resolve Conflicts page settles one and the composition then completes", async () => {
  const { seu, objectiveId, templateId, profileId, conflictKeys } = await commissionScenario("unsettled", "web-objectives-unsettled", { conflictSet: "objectives" });
  assert.ok(conflictKeys.length > 0, "the composition found conflicts");
  assert.equal(seu.active_ebm_id, null, "no EBM while a conflict is open");
  assert.equal(seu.lifecycle_state, "Validated");
  const composePath = `/seu/objectives/${objectiveId}/compose-ebm`;
  const selection = `${templateId}|${profileId}`;
  const announcedCount = async () => ((await eventsDB.findByOriginatingObject("SEU", seu.id)).data ?? []).filter((e) => e.event_type === "CompositionCompleted").length;

  assert.equal((await getPage(root, composePath)).status, 200, "the compose page shows the stored composition");
  const resolve = await getPage(root, `/seu/objectives/${objectiveId}/resolve-conflicts`);
  assert.equal(resolve.status, 200);
  assertPageMatches(resolve.html, /Resolve Conflicts/);
  assertPageMatches(resolve.html, /Authority rules/, "the screen has a tab for the table that has the conflict");

  const recomposed = await postForm(root, composePath, csrf, { templateProfile: selection });
  assert.equal(recomposed.status, 302);
  assert.equal(recomposed.location, `/aisworg${composePath}`);
  assert.equal(await announcedCount(), 0, "an open conflict blocks the announcement");

  const notOpen = await postForm(root, composePath, csrf, { templateProfile: selection, ebmPickKey: `zz-no-conflict-${run}`, ebmPickOption: "0" });
  assert.equal(notOpen.location, `/aisworg/seu/objectives/${objectiveId}/resolve-conflicts`);
  hasAlert((await flashAt(notOpen.location)).alerts, /That conflict is not open\./);

  for (const key of conflictKeys) {
    const picked = await postForm(root, composePath, csrf, { templateProfile: selection, ebmPickKey: key, ebmPickOption: "0" });
    assert.equal(picked.status, 302, `pick for ${key}`);
  }
  const stored = (await seusDB.findById(seu.id)).data!.composition_report as { ebmConflicts: Record<string, Array<{ resolution: unknown; notice?: boolean }>>; resolvedCompositionConflicts: Record<string, unknown> };
  for (const key of conflictKeys) assert.ok(key in stored.resolvedCompositionConflicts, `${key} is recorded as settled`);
  assert.equal(blockingEbmConflicts(stored.ebmConflicts as never).length, 0, "no conflict blocks the composition any more");
  assert.ok((await announcedCount()) > 0, "the composition is announced once every conflict is settled");
  await waitUntilAsync(async () => !!(await seusDB.findById(seu.id)).data?.active_ebm_id);
  assert.ok((await seusDB.findById(seu.id)).data?.active_ebm_id, "the announcement made the EBM");
});

test("composition that finds conflicts and settles them takes the SEU to Operational with the picks recorded", async () => {
  const { seu, conflictKeys } = await commissionScenario("settled", "web-objectives-settled", { conflictSet: "objectives" });
  assert.ok(conflictKeys.length > 0, "the composition found conflicts");
  assert.ok(seu.active_ebm_id, "the settled composition made the EBM");
  const stored = seu.composition_report as { resolvedCompositionConflicts: Record<string, unknown> };
  for (const key of conflictKeys) assert.ok(key in stored.resolvedCompositionConflicts, `${key} is recorded as settled`);
});
