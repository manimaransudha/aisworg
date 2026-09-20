// CR-109 Build Plan §6/§5a — Governance Evaluation Outcome (§6.1/§6.2),
// Work Item Execution Context (§6.3), and Decision Dependency (§5a).
// Real scenarios, not just wiring checks: real Decisions/Evidence/Knowledge
// content a Participant would actually read, a real Policy deviation, a
// real open-but-non-blocking Obligation, the transitivity case (a Decision
// blocking Deliverable A also holds back Deliverable B downstream), and a
// second pass over Source Code with a different scenario set (null
// inputLocation, per-Deliverable scoping, partial multi-Decision block).
// Run against the real dev database, no mocking.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { completeWorkItem } from "../src/routes/seu/core/workItems.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { commissionSeu } from "../src/routes/seu/core/commissioning.js";
import { publishPack } from "../src/routes/seu/core/packs.js";
import { publishProfile } from "../src/routes/seu/core/profiles.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { evidenceDB } from "../src/dblayer/evidenceDB.js";
import { knowledgeItemsDB } from "../src/dblayer/knowledgeItemsDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { decisionsDB } from "../src/dblayer/decisionsDB.js";
import { governanceEvaluationOutcomesDB } from "../src/dblayer/governanceEvaluationOutcomesDB.js";
import { capabilityFulfilmentPoolsDB } from "../src/dblayer/capabilityFulfilmentPoolsDB.js";
import { driveCommissioningToActive, uniqueTestPackVersion, ensureEventSubscriptionsLoaded, waitForDispatchedWorkItem, waitUntilAsync, ensureEligibleParticipant, resolveDispatchRejectionObligations } from "./testFixtures.js";
import type { CommandRow } from "../src/dblayer/seuTypes.js";


// deliverableKickoffHandler (SEUOperational / DeliverableTransitioned /
// ObligationTransitioned) re-scans every Deliverable in the SEU and attempts
// each one's own next governed transition on its own initiative, the same
// governed check a manual transitionDeliverable call here also runs — the
// "manual" trigger tag on a row only controls whether it renders as a
// clickable button, it is not a restriction on who/what may attempt the
// transition. So a hop this test expects to succeed can legitimately have
// already been requested by that automatic rescan before this call lands
// (already_in_flight) — a real Command either way, just differing in who got
// there first. Callers that only need "the transition was requested, proceed
// to waitForDispatchedWorkItem" use this instead of asserting a bare
// ok === true.
function assertTransitionRequested(result: { ok: boolean; reason?: string }): void {
  if (result.ok) return;
  assert.equal(result.reason, "already_in_flight", JSON.stringify(result));
}

async function registerOrganisationName(code: string): Promise<void> {
  await pool.query(
    "INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES ('organisation-name', $1, $2, '11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING",
    [code, code]
  );
}

// --- Fixture 1: the real cr104-demo-minimal Template (real dependency chain,
// Requirements Analysis Model -> Source Code -> Deployment Manifest, real
// Capabilities) + a test-local Profile carrying the SAME knowledgeLocations/
// dispatchStrategyPreference content as cr104-demo-development.profile.json.
//
// Deliberately NOT cr104-demo-development itself: that Profile's own
// optionalPackCodes always adopts cr104-demo-seu-eligibility-policies, whose
// cr104-demo-seu-commence-work Policy is designed to block the SEU's own
// Activated -> Operational hop forever (that's the whole point of that
// fixture — CR-104/CR-107's own demo of a permanently-blocked commence-work
// hop). Fine for a human manually walking through the demo; wrong for a test
// that actually needs to dispatch Deliverable Work Items, since every
// Deliverable transition also checks its owning SEU isn't blocked
// (seu_blocked). This Profile omits that optional Pack entirely so real
// commissioning actually reaches Operational.
async function commissionCr104MinimalSeu(statementPrefix: string, beforeCommenceWork?: (seuId: string) => Promise<void>): Promise<string> {
  const { data: template } = await templatesDB.findActiveByCode("cr104-demo-minimal");
  assert.ok(template, "cr104-demo-minimal Template must be seeded (db:clean-slate) before this test runs");

  const profileCode = `cr109-wig-profile-${randomUUID().slice(0, 8)}`;
  const profileResult = await publishProfile({
    seed: {
      code: profileCode, name: "CR-109 Work Item Generator test Profile", baseTemplateCode: "cr104-demo-minimal",
      environment: "development", profileVersion: "1.0.0",
      // Mandatory Configuration Parameters for this tenant — same values
      // cr104-demo-development.profile.json itself sets.
      developmentMethodology: "scrum", primaryProgrammingLanguage: "typescript", sourceControlProvider: "github",
      redispatchMaxAttempts: 5, redispatchAttentionThreshold: 2,
      knowledgeLocations: [
        { deliverableCode: "requirements-analysis-model", inputLocation: "s3://cr104-demo/requirements-backlog.md", outputLocation: "s3://cr104-demo/requirements-analysis-model.md" },
        { deliverableCode: "source-code", outputLocation: "https://github.com/cr104-demo/source-code" },
        { deliverableCode: "deployment-manifest", outputLocation: "s3://cr104-demo/deployment-manifest.yaml" },
      ],
    },
    actorRole: "super", actorId: "1001",
  });
  assert.ok(profileResult.ok, `test Profile must publish: ${!profileResult.ok ? JSON.stringify(profileResult) : ""}`);
  const { data: profile } = await profilesDB.findActiveByCode(profileCode);
  assert.ok(profile);

  // Must be loaded before commissionSeu below publishes CommissionRequested
  // — driveCommissioningToActive also calls this, but only after commissionSeu
  // has already published, which is too late if nothing else in this process
  // has loaded subscriptions yet: the event is missed outright (not delayed),
  // so the later wait for CommissionValidated times out for real.
  await ensureEventSubscriptionsLoaded();

  // commissionSeu rejects a Strategic Objective directly ("a programme
  // umbrella... decompose it into Operational/Engineering objectives") — a
  // Strategic root + Engineering child, same as commissionIsolatedSeu below.
  const { objective: root } = await createObjective({ statement: `${statementPrefix}-root-${randomUUID()}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed" });
  const { objective } = await createObjective({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "software-construction", "software-release"],
    tier: "Engineering",
    parentObjectiveId: root.id,
    requestedBy: 1001,
  });

  const commissioned = await commissionSeu({
    objectiveId: objective.id,
    templateIds: [template!.id],
    profileIds: [profile!.id],
    actorRole: "super", actorId: "1001", requestedBy: 1001,
  });
  assert.equal(commissioned.ok, true, !commissioned.ok ? JSON.stringify(commissioned) : undefined);
  if (!commissioned.ok) throw new Error("unreachable");

  const driven = await driveCommissioningToActive({ seuId: commissioned.seu.id, actorRole: "super", actorId: "1001", beforeCommenceWork });
  assert.equal(driven.ok, true, !driven.ok ? JSON.stringify(driven) : undefined);
  return commissioned.seu.id;
}

// Drives a Deliverable all the way from Defined to Approved: dispatch,
// complete "done" (lands In Progress), dispatch again, complete "done"
// again (lands Approved, the acceptance transition). Returns the two
// Work Item ids in case a caller wants to inspect either one's Execution
// Context.
async function driveDeliverableToApproved(deliverableId: string, tag: string): Promise<{ productionWorkItemId: string; acceptanceWorkItemId: string }> {
  const toInProgress = await transitionDeliverable({ deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assertTransitionRequested(toInProgress);
  const { workItem: productionWorkItem } = await waitForDispatchedWorkItem(deliverableId, "Defined", "In Progress");
  const produced = await completeWorkItem({ workItemId: productionWorkItem.id, outcome: "done", reference: `vcs://${tag}/produced@1` });
  assert.equal(produced.ok, true, !produced.ok ? JSON.stringify(produced) : undefined);

  const toApproved = await transitionDeliverable({ deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
  assertTransitionRequested(toApproved);
  const { workItem: acceptanceWorkItem } = await waitForDispatchedWorkItem(deliverableId, "In Progress", "Approved");
  const accepted = await completeWorkItem({ workItemId: acceptanceWorkItem.id, outcome: "done", reference: `vcs://${tag}/accepted@1` });
  assert.equal(accepted.ok, true, !accepted.ok ? JSON.stringify(accepted) : undefined);

  return { productionWorkItemId: productionWorkItem.id, acceptanceWorkItemId: acceptanceWorkItem.id };
}

// --- Fixture 2: an isolated, single-Deliverable Template/Pack/Profile (same
// minimal pattern cr107-execution-engine-deliverable-kickoff.test.ts uses),
// the test owns the one Pack, free to attach whatever Policy it needs without
// touching the shared cr104-demo-development fixture. Declares a real
// "requirements-analysis" producing Capability (dispatchEngine.ts's Case 1a —
// !producingCapabilityId — is a hard, terminal rejection, not "unconditional
// dispatch" as an earlier version of this comment assumed) and fulfils it
// with a genuine eligible Participant via beforeCommenceWork, so the tests
// below observe a real Dispatched Work Item instead of a rejected Command.
// beforeCommission runs after the Pack is published but before commissioning
// starts — applicable_policy_ids is materialised ONCE, at EBM composition
// time, from whichever Policies already exist for the composed Pack at that
// exact moment (compositionCompleted.ts); a Policy upserted after
// commissioning has already completed is invisible to policyEngine.evaluate
// (the bug the first version of this fixture actually had).
async function commissionIsolatedSeu(run: string, beforeCommission?: (packId: string) => Promise<void>): Promise<{ seuId: string; deliverableId: string; packId: string }> {
  const packSeed = { code: `cr109-isolated-pack-${run}`, name: "CR-109 Isolated Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: {} };
  await registerOrganisationName(packSeed.code);
  const published = await publishPack({ seed: packSeed as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(published.ok, `isolated pack must publish: ${!published.ok ? JSON.stringify(published) : ""}`);
  const { data: packRow } = await packsDB.findActiveByCode(packSeed.code);

  if (beforeCommission) await beforeCommission(packRow!.id);

  const { data: template } = await templatesDB.upsert({
    code: `cr109-tpl-${run}`, name: "CR-109 Isolated Template",
    deliverableCatalogue: [{ code: "requirements-analysis-model" }],
  });
  await templatesDB.setMandatoryPacks(template!.id, [packSeed.code]);
  // setRequiredCapabilities takes real Capability row ids, not codes —
  // resolve "requirements-analysis" first.
  const { data: requiredCapabilities } = await capabilitiesDB.findByCodes(["requirements-analysis"]);
  await templatesDB.setRequiredCapabilities(template!.id, (requiredCapabilities ?? []).map((c) => c.id));

  await ensureEventSubscriptionsLoaded();
  const { objective: root } = await createObjective({ statement: `cr109-root-${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed" });
  const { objective } = await createObjective({ statement: `cr109-${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: root.id, requestedBy: 1001 });
  const profilePublish = await publishProfile({
    seed: {
      code: `cr109-profile-${run}`,
      name: "CR-109 Isolated Profile",
      baseTemplateCode: template!.code,
      environment: "development",
      profileVersion: `1.0.${Date.now()}${process.pid}`,
      developmentMethodology: "scrum",
      primaryProgrammingLanguage: "typescript",
      sourceControlProvider: "github",
      redispatchMaxAttempts: 5,
      redispatchAttentionThreshold: 2,
    },
    actorRole: "super",
    actorId: "1001",
  });
  assert.equal(profilePublish.ok, true, !profilePublish.ok ? JSON.stringify(profilePublish.errors) : undefined);
  if (!profilePublish.ok) throw new Error("unreachable");
  const { data: profile } = await profilesDB.findById(profilePublish.profileId);

  const requested = await commissionSeu({ objectiveId: objective.id, templateIds: [template!.id], profileIds: [profile!.id], actorRole: "super", actorId: "1001" });
  assert.equal(requested.ok, true, !requested.ok ? `Validate Request failed: ${requested.reason}` : undefined);
  if (!requested.ok) throw new Error("unreachable");

  // No beforeCommenceWork fulfilment here, deliberately: the failing test
  // this fixture serves creates its OWN Obligation after commissioning
  // returns, then needs its OWN transitionDeliverable call to be the first
  // real attempt on Defined -> In Progress, so that Obligation is genuinely
  // open (and so recorded as "consulted") when governance actually runs.
  // Fulfilling here would let the automatic commence-work kickoff complete
  // that hop first, before the test's Obligation exists. The commence-work
  // kickoff's own first attempt (no Participant yet) hits empty_eligible_pool
  // and rejects instead — swept below so it doesn't linger as a second,
  // unrelated open Obligation once the test creates its real one.
  const driven = await driveCommissioningToActive({ seuId: requested.seu.id, actorRole: "super", actorId: "1001" });
  assert.equal(driven.ok, true, !driven.ok ? JSON.stringify(driven) : undefined);
  await resolveDispatchRejectionObligations(requested.seu.id);

  const { data: deliverables } = await deliverablesDB.findBySeuId(requested.seu.id);
  const deliverable = (deliverables ?? [])[0];
  assert.ok(deliverable, "expected the one head-of-chain Deliverable");

  return { seuId: requested.seu.id, deliverableId: deliverable!.id, packId: packRow!.id };
}

// ---------------------------------------------------------------------------
// Requirements Analysis Model — scenario set 1
// ---------------------------------------------------------------------------

test("CR-109 §6.1/§6.2/§6.3: a real Decision, Evidence and Knowledge attached to the Deliverable show up as actual content in the Work Item's Execution Context", async () => {
  // Fulfilled AFTER commissioning, deliberately — Decision/Evidence/Knowledge
  // below are attached before the explicit dispatch too, and the automatic
  // commence-work rescan must not dispatch (and snapshot the Execution
  // Context) before they exist.
  const seuId = await commissionCr104MinimalSeu("cr109-real-content");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "requirements-analysis-model" || d.name === "Requirements Analysis Model");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);

  await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability!.capabilityId, participantMasterId: await ensureEligibleParticipant(seuId, ["requirements-analysis"]) });

  const { data: decision } = await decisionsDB.create({
    seuId,
    relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [requirementsSpec!.id] }],
    category: "Engineering Decisions",
    title: "Scope: which backlog items does this Deliverable cover",
  });
  await decisionsDB.updateStatus(decision!.id, "Approved");

  const { data: evidence } = await evidenceDB.create({
    relatedObjectType: "Deliverable", relatedObjectId: requirementsSpec!.id, seuId,
    category: "Validation Evidence", title: "Stakeholder sign-off on backlog scope",
  });

  const { data: knowledge } = await knowledgeItemsDB.create({
    seuId, deliverableId: requirementsSpec!.id, category: "Domain Knowledge",
    title: "Domain glossary for this backlog", acquisitionScope: "SEU",
  });

  const dispatched = await transitionDeliverable({ deliverableId: requirementsSpec!.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assertTransitionRequested(dispatched);

  const { workItem } = await waitForDispatchedWorkItem(requirementsSpec!.id, "Defined", "In Progress");
  const ec = workItem!.execution_context!;
  assert.ok(ec.relevantDecisions.some((d) => d.id === decision!.id && d.title === decision!.title && d.status === "Approved"), "the actual Decision (title/status), not just a count");
  assert.ok(ec.supportingEvidence.some((e) => e.id === evidence!.id && e.title === evidence!.title), "the actual Evidence, not just a count");
  assert.ok(ec.relevantKnowledge.some((k) => k.id === knowledge!.id && k.title === knowledge!.title), "the actual Knowledge, not just a count");
});

test("Ch.12 §9 / CR-109 §6.2: the eligible-Participant pool is persisted at Command generation and Dispatch reads it, not a live query", async () => {
  const seuId = await commissionCr104MinimalSeu("cr109-pool-persistence");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "requirements-analysis-model" || d.name === "Requirements Analysis Model");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);

  const { participant } = await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability!.capabilityId, participantMasterId: await ensureEligibleParticipant(seuId, ["requirements-analysis"]) });

  const dispatched = await transitionDeliverable({ deliverableId: requirementsSpec!.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assertTransitionRequested(dispatched);

  const { command, workItem } = await waitForDispatchedWorkItem(requirementsSpec!.id, "Defined", "In Progress");
  assert.ok(command!.eligible_participant_pool_id, "the Command must carry a real eligibleParticipantPoolRef");

  const { data: pool } = await capabilityFulfilmentPoolsDB.findById(command!.eligible_participant_pool_id!);
  assert.ok(pool, "the referenced pool snapshot must actually exist");
  assert.equal(pool!.seu_id, seuId);
  assert.deepEqual(pool!.participant_ids, [participant.id], "the pool must be the real fulfilment, not empty or fabricated");

  // Dispatch actually selected from this persisted snapshot.
  assert.equal(workItem.participant_id, participant.id);
});

test("Ch.12 §9 / CR-109 §6.2: no producing Capability declared means no pool at all, not an empty-query result", async () => {
  const seuId = await commissionCr104MinimalSeu("cr109-pool-no-capability");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "requirements-analysis-model" || d.name === "Requirements Analysis Model");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);

  // Deliberately no fulfilCapability call — the Deliverable has a producing
  // Capability declared, but nobody fulfils it, so the pool snapshot must
  // exist with an empty participant_ids array (not a null pool reference).
  // Ch.33's own redesign (this session): governance clearing and dispatch
  // outcome are no longer the same synchronous fact — transitionDeliverable
  // reports "Command requested" regardless, and an empty pool is Dispatch's
  // own case 1 (DispatchRejected, Command marked Failed), not a deferral.
  const requested = await transitionDeliverable({ deliverableId: requirementsSpec!.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assertTransitionRequested(requested);

  let command: CommandRow | null = null;
  await waitUntilAsync(async () => {
    const { data: commands } = await commandsDB.findBySeuId(seuId);
    command = (commands ?? []).find((c) => c.entity_id === requirementsSpec!.id) ?? null;
    return command?.status === "Failed";
  });
  assert.equal(command?.status, "Failed", "an empty eligible-Participant pool must reject, not silently dispatch or defer forever");
  assert.ok(command?.eligible_participant_pool_id, "a Capability WAS declared, so a pool snapshot must still exist");
  const { data: pool } = await capabilityFulfilmentPoolsDB.findById(command!.eligible_participant_pool_id!);
  assert.deepEqual(pool!.participant_ids, []);
});

test("CR-109 §6.1: a deviating Standard Policy and an open, non-blocking Obligation both show up on a real Approved-with-Conditions outcome", async () => {
  const run = randomUUID().slice(0, 8);
  let standardPolicyId = "";
  const { seuId, deliverableId } = await commissionIsolatedSeu(run, async (packId) => {
    const { data: standardPolicy } = await policiesDB.upsert({
      code: `cr109-standard-deviation-${run}`, name: "CR-109 always-deviates Standard policy",
      constraintType: "Standard", scope: "Transition", governedTransition: "Deliverable|Defined|In Progress",
      condition: { type: "field_in", field: "neverSet", values: ["only-this-satisfies"] },
      originatingPackId: packId,
    });
    assert.ok(standardPolicy);
    standardPolicyId = standardPolicy!.id;
  });

  const { data: obligation } = await obligationsDB.create({
    seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId,
    category: "Engineering", title: "Follow up with security review after this hop",
    // No blockedFromState/blockedToState — genuinely non-blocking, but still open (Identified).
  });
  assert.ok(obligation);
  assert.equal(obligation!.status, "Identified", "open, not resolved");

  // Fulfilled here, after the Obligation above already exists, so this
  // call's own governance evaluation is the first real attempt on the hop
  // and genuinely sees (and records) that open Obligation.
  const { data: deliverable } = await deliverablesDB.findById(deliverableId);
  assert.ok(deliverable?.producing_capability_id, "expected the isolated Template's requirements-analysis Capability to be declared");
  const participantMasterId = await ensureEligibleParticipant(seuId, ["requirements-analysis"]);
  await fulfilCapability({ seuId, capabilityId: deliverable!.producing_capability_id!, participantMasterId });

  const dispatched = await transitionDeliverable({ deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assertTransitionRequested(dispatched);

  const { data: rawCommand } = await commandsDB.findBySeuId(seuId);
  const command = rawCommand![0];
  const { data: outcome } = await governanceEvaluationOutcomesDB.findById(command.governance_outcome_id!);
  assert.equal(outcome!.outcome, "Approved-with-Conditions", "a real Standard-Policy deviation must produce this exact outcome, not a bare 'Approved'");
  assert.ok(outcome!.deviated_policy_ids.includes(standardPolicyId), "the deviating Policy's real id must be recorded");
  assert.ok(outcome!.consulted_obligation_ids.includes(obligation!.id), "the open, non-blocking Obligation's real id must be recorded even though it never blocked");

  const { workItem } = await waitForDispatchedWorkItem(deliverableId, "Defined", "In Progress");
  const ec = workItem!.execution_context!;
  assert.ok(ec.governingPolicies.length === 0, "deviated policies aren't 'satisfied' — governingPolicies reads satisfied_policy_ids, which stays empty here");
  assert.ok(ec.activeObligations.some((o) => o.id === obligation!.id), "the Participant must still see the open Obligation for their own awareness (Ch.32 §11)");
});

test("CR-109 §5a transitivity: an open Decision on Requirements Analysis Model also blocks Source Code, with no new dependency edge", async () => {
  const seuId = await commissionCr104MinimalSeu("cr109-transitivity");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "requirements-analysis-model" || d.name === "Requirements Analysis Model");
  const sourceCode = detail?.deliverables.find((d) => d.name === "source-code" || d.name === "Source Code");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && sourceCode && reqAnalysisCapability);

  await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability!.capabilityId, participantMasterId: await ensureEligibleParticipant(seuId, ["requirements-analysis"]) });

  const { data: decision } = await decisionsDB.create({
    seuId,
    relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [requirementsSpec!.id] }],
    category: "Engineering Decisions",
    title: "CR-109 transitivity test decision",
  });
  assert.ok(decision);

  const blockedDirect = await transitionDeliverable({ deliverableId: requirementsSpec!.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(blockedDirect.ok, false);
  if (blockedDirect.ok) throw new Error("unreachable");
  assert.equal(blockedDirect.reason, "decision_blocked");

  // Source Code depends on Requirements Analysis Model reaching Approved
  // (cr104-demo-minimal.template.json's own dependencyGraph). Requirements
  // never advanced at all (still Defined), so Source Code's own attempt
  // must fail on dependency readiness — not because of any new graph edge
  // for the Decision, purely because Requirements never moved.
  const blockedTransitively = await transitionDeliverable({ deliverableId: sourceCode!.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(blockedTransitively.ok, false);
  if (blockedTransitively.ok) throw new Error("unreachable");
  assert.equal(blockedTransitively.reason, "dependency_not_satisfied", "Source Code is blocked purely because Requirements Analysis Model never reached Approved, no new edge involved");
});

// ---------------------------------------------------------------------------
// Source Code — a different scenario set: reaching it for real (both hops of
// Requirements Analysis Model), null inputLocation, per-Deliverable scoping,
// and a partial multi-Decision block.
// ---------------------------------------------------------------------------

test("CR-109 Source Code §6.3: Execution Context resolves a null inputLocation for real (no entry declared) and does not leak Requirements Analysis Model's own Decisions/Evidence/Knowledge", async () => {
  const seuId = await commissionCr104MinimalSeu("cr109-source-code-scoping", async (seuId) => {
    const detail = await getSeuDetailView(seuId);
    const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
    assert.ok(reqAnalysisCapability);
    await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, participantMasterId: await ensureEligibleParticipant(seuId, ["requirements-analysis"]) });
  });
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "requirements-analysis-model" || d.name === "Requirements Analysis Model");
  const sourceCode = detail?.deliverables.find((d) => d.name === "source-code" || d.name === "Source Code");
  const constructionCapability = detail?.capabilities.find((c) => c.code === "software-construction");
  assert.ok(requirementsSpec && sourceCode && constructionCapability);

  // Content attached to Requirements Analysis Model ONLY — must never appear
  // in Source Code's own Execution Context.
  const { data: reqDecision } = await decisionsDB.create({
    seuId, relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [requirementsSpec!.id] }],
    category: "Engineering Decisions", title: "Requirements-only decision — must not leak into Source Code",
  });
  await decisionsDB.updateStatus(reqDecision!.id, "Approved");
  await evidenceDB.create({ relatedObjectType: "Deliverable", relatedObjectId: requirementsSpec!.id, seuId, category: "Validation Evidence", title: "Requirements-only evidence" });
  await knowledgeItemsDB.create({ seuId, deliverableId: requirementsSpec!.id, category: "Domain Knowledge", title: "Requirements-only knowledge", acquisitionScope: "SEU" });

  await driveDeliverableToApproved(requirementsSpec!.id, `cr109-source-code-scoping-${seuId}`);

  await fulfilCapability({ seuId, capabilityId: constructionCapability!.capabilityId, participantMasterId: await ensureEligibleParticipant(seuId, ["software-construction"]) });
  const dispatched = await transitionDeliverable({ deliverableId: sourceCode!.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assertTransitionRequested(dispatched);

  const { workItem } = await waitForDispatchedWorkItem(sourceCode!.id, "Defined", "In Progress");
  const ec = workItem!.execution_context!;
  assert.equal(ec.relevantDeliverable.id, sourceCode!.id);
  assert.equal(ec.service?.code, "software-construction");
  assert.equal(ec.inputLocation, null, "cr104-demo-development.profile.json declares no inputLocation for source-code — must resolve to null, not fabricated");
  assert.equal(ec.outputLocation, "https://github.com/cr104-demo/source-code");
  assert.ok(!ec.relevantDecisions.some((d) => d.id === reqDecision!.id), "Requirements Analysis Model's own Decision must not leak into Source Code's Execution Context");
  assert.equal(ec.supportingEvidence.length, 0, "Source Code has no Evidence of its own yet");
  assert.equal(ec.relevantKnowledge.length, 0, "Source Code has no Knowledge of its own yet");
});

test("CR-109 Source Code §5a: decision_blocked triggers even when only ONE of several related Decisions is still open, and clears only once every one of them reaches Approved", async () => {
  const seuId = await commissionCr104MinimalSeu("cr109-source-code-partial-block", async (seuId) => {
    const detail = await getSeuDetailView(seuId);
    const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
    assert.ok(reqAnalysisCapability);
    await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, participantMasterId: await ensureEligibleParticipant(seuId, ["requirements-analysis"]) });
  });
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "requirements-analysis-model" || d.name === "Requirements Analysis Model");
  const sourceCode = detail?.deliverables.find((d) => d.name === "source-code" || d.name === "Source Code");
  const constructionCapability = detail?.capabilities.find((c) => c.code === "software-construction");
  assert.ok(requirementsSpec && sourceCode && constructionCapability);

  await driveDeliverableToApproved(requirementsSpec!.id, `cr109-source-code-partial-block-${seuId}`);
  await fulfilCapability({ seuId, capabilityId: constructionCapability!.capabilityId, participantMasterId: await ensureEligibleParticipant(seuId, ["software-construction"]) });

  const { data: approvedDecision } = await decisionsDB.create({
    seuId, relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [sourceCode!.id] }],
    category: "Engineering Decisions", title: "Source Code decision 1 (already Approved)",
  });
  await decisionsDB.updateStatus(approvedDecision!.id, "Approved");

  const { data: openDecision } = await decisionsDB.create({
    seuId, relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [sourceCode!.id] }],
    category: "Engineering Decisions", title: "Source Code decision 2 (still open)",
  });

  const blocked = await transitionDeliverable({ deliverableId: sourceCode!.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(blocked.ok, false);
  if (blocked.ok) throw new Error("unreachable");
  assert.equal(blocked.reason, "decision_blocked", "one Approved Decision is not enough — the second, still-open Decision must still block");

  await decisionsDB.updateStatus(openDecision!.id, "Approved");
  const dispatched = await transitionDeliverable({ deliverableId: sourceCode!.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assertTransitionRequested(dispatched);
});
