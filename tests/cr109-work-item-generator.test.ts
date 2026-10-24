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
import { fulfilCapabilityAsRoot as fulfilCapability, createActiveObjective } from "./testFixtures.js";
import { initiateAndValidateSeu } from "./testFixtures.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { completeWorkItem } from "../src/routes/seu/core/workItems.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { publishPack } from "../src/routes/seu/core/packs.js";
import { publishProfile } from "../src/routes/seu/core/profiles.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { knowledgeItemsDB } from "../src/dblayer/knowledgeItemsDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { decisionsDB } from "../src/dblayer/decisionsDB.js";
import { governanceEvaluationOutcomesDB } from "../src/dblayer/governanceEvaluationOutcomesDB.js";
import { capabilityFulfilmentPoolsDB } from "../src/dblayer/capabilityFulfilmentPoolsDB.js";
import { getEmptyPoolTenantId, driveCommissioningToActive, uniqueTestPackVersion, ensureEventSubscriptionsLoaded, ensureTestFixturePacks, waitForDispatchedWorkItem, transitionDeliverableSync, waitUntilAsync, ensureEligibleParticipant, ensureActorParticipant, resolveDispatchRejectionObligations, createEvidenceAsRoot, createObligationAsRoot, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, TESTER_ALL_ID } from "./testFixtures.js";
import type { CommandRow } from "../src/dblayer/seuTypes.js";
import { getPlatformTenantId } from "../src/dblayer/constants.js";
import { participantsDB } from "../src/dblayer/participantsDB.js";

async function rootParticipantId(seuId: string): Promise<string> {
  await ensureActorParticipant(seuId, ROOT_ACTOR_ID);
  const { data } = await participantsDB.findBySeuIdAndParticipantMasterId(seuId, ROOT_ACTOR_ID);
  return data!.id;
}

const PLATFORM_TENANT_ID = await getPlatformTenantId();


// Defined -> In Progress is a governed hop: the Execution Engine makes it off the kickoff, so a manual request that
// lands after it finds the Deliverable already In Progress (no_transition_definition). The producing Command
// (In Progress -> In Progress) is what the test then waits for.
function assertTransitionRequested(result: { ok: boolean; reason?: string }): void {
  if (result.ok) return;
  assert.ok(result.reason === "no_transition_definition" || result.reason === "already_in_flight", JSON.stringify(result));
}

async function registerOrganisationName(code: string): Promise<void> {
  await pool.query(
    "INSERT INTO ontology_concepts (concept_type, code, default_label, status, tenant_id, author_id, author_badge) VALUES ('organisation-name', $1, $2, 'Active', $3, $4, $5) ON CONFLICT DO NOTHING",
    [code, code, PLATFORM_TENANT_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE]
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
async function commissionCr104MinimalSeu(statementPrefix: string, beforeCommenceWork?: (seuId: string) => Promise<void>, holdAtActivated?: (seuId: string) => Promise<void>, tenantId?: string): Promise<string> {
  // db:clean-slate does not seed the cr104 demo; seedAllTestFixturePacks (seedCr104Demo) does, and is idempotent.
  await ensureTestFixturePacks();
  const { data: template } = await templatesDB.findActiveByCode("cr104-demo-minimal");
  assert.ok(template, "cr104-demo-minimal Template must exist after ensureTestFixturePacks");

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
    actorId: TESTER_ALL_ID,
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
  const { objective: root } = await createObjective({ statement: `${statementPrefix}-root-${randomUUID()}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: TESTER_ALL_ID, });
  const { objective } = await createActiveObjective({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "software-construction", "software-release"],
    tier: "Engineering",
    parentObjectiveId: root.id,
    requestedBy: TESTER_ALL_ID,
  });

  const commissioned = await initiateAndValidateSeu({
    objectiveId: objective.id,
    profileId: profile!.id,
    actorId: TESTER_ALL_ID, tenantId,
  });
  assert.equal(commissioned.ok, true, !commissioned.ok ? JSON.stringify(commissioned) : "assertion failed");
  if (!commissioned.ok) throw new Error("unreachable");

  // A hold needs an actor that does not yet hold the commence-work badge, which TESTER_ALL always does. A fresh
  // participants_master row is that actor; driveCommissioningToActive grants it each badge its hops need.
  let driveActorId = TESTER_ALL_ID;
  if (holdAtActivated) {
    const { data: seu } = await seusDB.findById(commissioned.seu.id);
    const { data: holdActor, error } = await participantsMasterDB.create({
      tenantId: seu!.tenant_id ?? PLATFORM_TENANT_ID, type: "Human", displayName: `Hold Actor ${randomUUID()}`,
      capabilities: [], competency: {}, userId: null,
    });
    assert.ok(holdActor, `hold actor must be created: ${error}`);
    driveActorId = holdActor!.id;
  }
  const driven = await driveCommissioningToActive({ seuId: commissioned.seu.id, actorId: driveActorId, beforeCommenceWork, holdAtActivated });
  assert.equal(driven.ok, true, !driven.ok ? JSON.stringify(driven) : "assertion failed");
  return commissioned.seu.id;
}

// Drives a Deliverable from Defined to Approved: the engine's governed hop to In Progress, the producing Work
// Item completed "done" (records the reference), then the Command to approve, which the engine governs and applies.
// Returns the producing Work Item id.
async function driveDeliverableToApproved(deliverableId: string, tag: string): Promise<{ productionWorkItemId: string }> {
  const toInProgress = await transitionDeliverableSync({ deliverableId, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assert.equal(toInProgress.ok, true, !toInProgress.ok ? JSON.stringify(toInProgress) : "assertion failed");
  const { workItem: productionWorkItem } = await waitForDispatchedWorkItem(deliverableId, "In Progress", "In Progress");
  const produced = await completeWorkItem({ workItemId: productionWorkItem.id, outcome: "done", reference: `vcs://${tag}/produced@1` });
  assert.equal(produced.ok, true, !produced.ok ? JSON.stringify(produced) : "assertion failed");

  const toApproved = await transitionDeliverableSync({ deliverableId, targetState: "Approved", actorId: ROOT_ACTOR_ID });
  assert.equal(toApproved.ok, true, !toApproved.ok ? JSON.stringify(toApproved) : "assertion failed");

  return { productionWorkItemId: productionWorkItem.id };
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
async function commissionIsolatedSeu(run: string, beforeCommission?: (packId: string) => Promise<void>, beforeCommenceWork?: (seuId: string) => Promise<void>): Promise<{ seuId: string; deliverableId: string; packId: string }> {
  const packSeed = { code: `cr109-isolated-pack-${run}`, name: "CR-109 Isolated Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: {} };
  await registerOrganisationName(packSeed.code);
  const published = await publishPack({ seed: packSeed as any, actorId: TESTER_ALL_ID, activate: true });
  assert.ok(published.ok, `isolated pack must publish: ${!published.ok ? JSON.stringify(published) : ""}`);
  const { data: packRow } = await packsDB.findActiveByCode(packSeed.code);

  if (beforeCommission) await beforeCommission(packRow!.id);

  const { data: template } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID,
    code: `cr109-tpl-${run}`, name: "CR-109 Isolated Template",
    deliverableCatalogue: [{ code: "requirements-analysis-model" }],
  });
  await templatesDB.setMandatoryPacks(template!.id, [packSeed.code], ROOT_ACTOR_ID, "root");
  // setRequiredCapabilities takes real Capability row ids, not codes —
  // resolve "requirements-analysis" first.
  const { data: requiredCapabilities } = await capabilitiesDB.findByCodes(["requirements-analysis"]);
  const { data: rootMasterForCapabilities, error: rootMasterForCapabilitiesErr } = await participantsMasterDB.findById(ROOT_ACTOR_ID);
  if (rootMasterForCapabilitiesErr || !rootMasterForCapabilities) throw rootMasterForCapabilitiesErr ?? new Error("no participants_master row for user_id 1 -- is db:clean-slate seeded?");
  await templatesDB.setRequiredCapabilities(template!.id, (requiredCapabilities ?? []).map((c) => c.id), rootMasterForCapabilities.id, "root");

  await ensureEventSubscriptionsLoaded();
  const { objective: root } = await createObjective({ statement: `cr109-root-${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: TESTER_ALL_ID, });
  const { objective } = await createActiveObjective({ statement: `cr109-${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: root.id, requestedBy: TESTER_ALL_ID });
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
    actorId: TESTER_ALL_ID,
  });
  assert.equal(profilePublish.ok, true, !profilePublish.ok ? JSON.stringify(profilePublish.errors) : "assertion failed");
  if (!profilePublish.ok) throw new Error("unreachable");
  const { data: profile } = await profilesDB.findById(profilePublish.profileId);

  const requested = await initiateAndValidateSeu({ objectiveId: objective.id, profileId: profile!.id, actorId: TESTER_ALL_ID });
  assert.equal(requested.ok, true, !requested.ok ? `Validate Request failed: ${requested.reason}` : "assertion failed");
  if (!requested.ok) throw new Error("unreachable");

  // The Execution Engine makes the governed Defined -> In Progress hop off SEUOperational, so anything the hop's
  // governance must see (an Obligation, a fulfilled Capability) has to exist before commence-work. The caller
  // supplies it through beforeCommenceWork, which runs once the SEU is Activated.
  const driven = await driveCommissioningToActive({ seuId: requested.seu.id, actorId: TESTER_ALL_ID, beforeCommenceWork });
  assert.equal(driven.ok, true, !driven.ok ? JSON.stringify(driven) : "assertion failed");
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
  // The producing Command is generated when the Capability is fulfilled (the engine already made the hop to In
  // Progress at commence-work), and its Work Item snapshots the Execution Context then. Decision, Evidence and
  // Knowledge are therefore attached first and the Capability is fulfilled last.
  const seuId = await commissionCr104MinimalSeu("cr109-real-content");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "requirements-analysis-model" || d.name === "Requirements Analysis Model");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);

  const { data: decision } = await decisionsDB.create({ status: "Identified", participantId: await rootParticipantId(seuId), authorityBadge: ROOT_ACTOR_BADGE,
    seuId,
    relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [requirementsSpec!.id] }],
    category: "Engineering Decisions",
    title: "Scope: which backlog items does this Deliverable cover",
  });
  await decisionsDB.updateStatus(decision!.id, "Approved", { participantId: await rootParticipantId(seuId), authorityBadge: ROOT_ACTOR_BADGE });

  const evidence = await createEvidenceAsRoot({
    relatedObjectType: "Deliverable", relatedObjectId: requirementsSpec!.id, seuId,
    category: "Validation Evidence", title: "Stakeholder sign-off on backlog scope",
  });

  const { data: knowledge } = await knowledgeItemsDB.create({ status: "Observed", authorId: await rootParticipantId(seuId), authorityBadge: ROOT_ACTOR_BADGE,
    seuId, deliverableId: requirementsSpec!.id, category: "Domain Knowledge",
    title: "Domain glossary for this backlog", acquisitionScope: "SEU",
  });

  await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability!.capabilityId, capabilityCodes: ["requirements-analysis"] });

  const { workItem } = await waitForDispatchedWorkItem(requirementsSpec!.id, "In Progress", "In Progress");
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

  const { participant } = await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability!.capabilityId, capabilityCodes: ["requirements-analysis"] });

  const dispatched = await transitionDeliverable({ requestedBy: ROOT_ACTOR_ID, deliverableId: requirementsSpec!.id, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assertTransitionRequested(dispatched);

  const { command, workItem } = await waitForDispatchedWorkItem(requirementsSpec!.id, "In Progress", "In Progress");
  assert.ok(command!.eligible_participant_pool_id, "the Command must carry a real eligibleParticipantPoolRef");

  const { data: pool } = await capabilityFulfilmentPoolsDB.findById(command!.eligible_participant_pool_id!);
  assert.ok(pool, "the referenced pool snapshot must actually exist");
  assert.equal(pool!.seu_id, seuId);
  assert.ok(pool!.participant_ids.includes(participant.id), "the pool must be the real fulfilment and include this Participant");

  // Dispatch actually selected one member of this persisted snapshot.
  assert.ok(workItem.participant_id && pool!.participant_ids.includes(workItem.participant_id), "the Work Item goes to a member of the persisted pool");
});

test("Ch.12 §9 / CR-109 §6.2: with no eligible Participant the producing Capability stays unfulfilled and the Deliverable stays in Defined", async () => {
  {
    const seuId = await commissionCr104MinimalSeu("cr109-pool-no-capability", undefined, undefined, await getEmptyPoolTenantId());
    const detail = await getSeuDetailView(seuId);
    const requirementsSpec = detail?.deliverables.find((d) => d.name === "requirements-analysis-model" || d.name === "Requirements Analysis Model");
    assert.ok(requirementsSpec);

    // The Mandatory Policy blocks Defined -> In Progress until the producing Capability is Fulfilled.
    await ensureActorParticipant(seuId, ROOT_ACTOR_ID);
    const moved = await transitionDeliverableSync({ deliverableId: requirementsSpec!.id, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
    assert.equal(moved.ok, false, "no hop without a fulfilled Capability");
    if (!moved.ok) assert.equal(moved.reason, "policy_blocked", JSON.stringify(moved));

    const after = await getSeuDetailView(seuId);
    const deliverable = after?.deliverables.find((d) => d.id === requirementsSpec!.id);
    assert.equal(deliverable?.lifecycleState, "Defined", "the Deliverable stays in Defined");
    const { data: commands } = await commandsDB.findBySeuId(seuId);
    assert.equal((commands ?? []).filter((c) => c.entity_id === requirementsSpec!.id && c.from_state === "In Progress" && c.to_state === "In Progress").length, 0, "no producing Command without a hop");
  }
});

test("CR-109 §6.1: a deviating Standard Policy and an open, non-blocking Obligation both show up on a real Approved-with-Conditions outcome", async () => {
  const run = randomUUID().slice(0, 8);
  let standardPolicyId = "";
  let obligationId = "";
  const { seuId, deliverableId } = await commissionIsolatedSeu(run, async (packId) => {
    const { data: rootMaster, error: rootMasterErr } = await participantsMasterDB.findById(ROOT_ACTOR_ID);
    if (rootMasterErr || !rootMaster) throw rootMasterErr ?? new Error("no participants_master row for user_id 1 — is db:clean-slate seeded?");
    const { data: standardPolicy } = await policiesDB.upsert({
      code: `cr109-standard-deviation-${run}`, name: "CR-109 always-deviates Standard policy",
      constraintType: "Standard", scope: "Transition", governedTransition: "Deliverable|Defined|In Progress",
      condition: { type: "field_in", field: "neverSet", values: ["only-this-satisfies"] },
      originatingPackId: packId,
      authorId: rootMaster.id,
      authorBadge: "root",
    });
    assert.ok(standardPolicy);
    standardPolicyId = standardPolicy!.id;
  }, async (activatedSeuId) => {
    // Raised and fulfilled before commence-work, so the hop the engine makes at Operational is the first governance
    // evaluation of the Deliverable and records this open Obligation as consulted.
    const { data: seuDeliverables } = await deliverablesDB.findBySeuId(activatedSeuId);
    const head = (seuDeliverables ?? [])[0];
    assert.ok(head, "expected the one head-of-chain Deliverable");
    const created = await createObligationAsRoot({
      relatedObjectType: "Deliverable", relatedObjectId: head!.id,
      category: "Engineering", title: "Follow up with security review after this hop",
      // No blockedFromState/blockedToState — genuinely non-blocking, but still open (Identified).
    });
    assert.ok(created);
    assert.equal(created!.status, "Identified", "open, not resolved");
    obligationId = created!.id;
    assert.ok(head!.producing_capability_id, "expected the isolated Template's requirements-analysis Capability to be declared");
    await fulfilCapability({ seuId: activatedSeuId, capabilityId: head!.producing_capability_id!, capabilityCodes: ["requirements-analysis"] });
  });

  // The hop is the engine's own governed transition. Its Command carries the governance outcome the producing
  // Command reuses.
  let hop: CommandRow | undefined;
  await waitUntilAsync(async () => {
    const { data: commands } = await commandsDB.findBySeuId(seuId);
    hop = (commands ?? []).find((c) => c.entity_id === deliverableId && c.from_state === "Defined" && c.to_state === "In Progress");
    return !!hop;
  });
  const hopCommand = hop as CommandRow | undefined;
  const { data: outcome } = await governanceEvaluationOutcomesDB.findById(hopCommand!.governance_outcome_id!);
  assert.equal(outcome!.outcome, "Approved-with-Conditions", "a real Standard-Policy deviation must produce this exact outcome, not a bare 'Approved'");
  assert.ok(outcome!.deviated_policy_ids.includes(standardPolicyId), "the deviating Policy's real id must be recorded");
  assert.ok(outcome!.consulted_obligation_ids.includes(obligationId), "the open, non-blocking Obligation's real id must be recorded even though it never blocked");

  const { workItem } = await waitForDispatchedWorkItem(deliverableId, "In Progress", "In Progress");
  const ec = workItem!.execution_context!;
  assert.ok(!ec.governingPolicies.some((p) => p.id === standardPolicyId), "a deviated policy isn't 'satisfied' — governingPolicies reads satisfied_policy_ids, so it never lists the deviating Policy");
  assert.ok(ec.activeObligations.some((o) => o.id === obligationId), "the Participant must still see the open Obligation for their own awareness (Ch.32 §11)");
});

test("CR-109 §5a transitivity: an open Decision on Requirements Analysis Model also blocks Source Code, with no new dependency edge", async () => {
  // The SEU is held at Activated, with its Deliverables already created, while the open Decision is attached. The
  // engine then makes its governed hop at Operational, so the Decision exists before the hop is evaluated.
  const seuId = await commissionCr104MinimalSeu("cr109-transitivity", undefined, async (activatedSeuId) => {
    const activatedDetail = await getSeuDetailView(activatedSeuId);
    const req = activatedDetail?.deliverables.find((d) => d.name === "requirements-analysis-model" || d.name === "Requirements Analysis Model");
    assert.ok(req);
    const { data: openDecision } = await decisionsDB.create({ status: "Identified", participantId: await rootParticipantId(activatedSeuId), authorityBadge: ROOT_ACTOR_BADGE,
      seuId: activatedSeuId,
      relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [req.id] }],
      category: "Engineering Decisions",
      title: "CR-109 transitivity test decision",
    });
    assert.ok(openDecision);
  });
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "requirements-analysis-model" || d.name === "Requirements Analysis Model");
  const sourceCode = detail?.deliverables.find((d) => d.name === "source-code" || d.name === "Source Code");
  assert.ok(requirementsSpec && sourceCode);
  assert.equal(requirementsSpec.lifecycleState, "Defined", "the open Decision stopped the engine's own hop");

  const blockedDirect = await transitionDeliverable({ requestedBy: ROOT_ACTOR_ID, deliverableId: requirementsSpec!.id, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assert.equal(blockedDirect.ok, false);
  if (blockedDirect.ok) throw new Error("unreachable");
  assert.equal(blockedDirect.reason, "decision_blocked");

  // Source Code depends on Requirements Analysis Model reaching Approved
  // (cr104-demo-minimal.template.json's own dependencyGraph). Requirements
  // never advanced at all (still Defined), so Source Code's own attempt
  // must fail on dependency readiness — not because of any new graph edge
  // for the Decision, purely because Requirements never moved.
  const blockedTransitively = await transitionDeliverable({ requestedBy: ROOT_ACTOR_ID, deliverableId: sourceCode!.id, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
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
    await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, capabilityCodes: ["requirements-analysis"] });
  });
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "requirements-analysis-model" || d.name === "Requirements Analysis Model");
  const sourceCode = detail?.deliverables.find((d) => d.name === "source-code" || d.name === "Source Code");
  const constructionCapability = detail?.capabilities.find((c) => c.code === "software-construction");
  assert.ok(requirementsSpec && sourceCode && constructionCapability);

  // Content attached to Requirements Analysis Model ONLY — must never appear
  // in Source Code's own Execution Context.
  const { data: reqDecision } = await decisionsDB.create({ status: "Identified", participantId: await rootParticipantId(seuId), authorityBadge: ROOT_ACTOR_BADGE,
    seuId, relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [requirementsSpec!.id] }],
    category: "Engineering Decisions", title: "Requirements-only decision — must not leak into Source Code",
  });
  await decisionsDB.updateStatus(reqDecision!.id, "Approved", { participantId: await rootParticipantId(seuId), authorityBadge: ROOT_ACTOR_BADGE });
  await createEvidenceAsRoot({ relatedObjectType: "Deliverable", relatedObjectId: requirementsSpec!.id, seuId, category: "Validation Evidence", title: "Requirements-only evidence" });
  await knowledgeItemsDB.create({ status: "Observed", authorId: await rootParticipantId(seuId), authorityBadge: ROOT_ACTOR_BADGE, seuId, deliverableId: requirementsSpec!.id, category: "Domain Knowledge", title: "Requirements-only knowledge", acquisitionScope: "SEU" });

  await driveDeliverableToApproved(requirementsSpec!.id, `cr109-source-code-scoping-${seuId}`);

  await fulfilCapability({ seuId, capabilityId: constructionCapability!.capabilityId, capabilityCodes: ["software-construction"] });
  const dispatched = await transitionDeliverable({ requestedBy: ROOT_ACTOR_ID, deliverableId: sourceCode!.id, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assertTransitionRequested(dispatched);

  const { workItem } = await waitForDispatchedWorkItem(sourceCode!.id, "In Progress", "In Progress");
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
    await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, capabilityCodes: ["requirements-analysis"] });
  });
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "requirements-analysis-model" || d.name === "Requirements Analysis Model");
  const sourceCode = detail?.deliverables.find((d) => d.name === "source-code" || d.name === "Source Code");
  const constructionCapability = detail?.capabilities.find((c) => c.code === "software-construction");
  assert.ok(requirementsSpec && sourceCode && constructionCapability);

  // Both Decisions exist before Requirements Analysis Model is approved, because approving it makes the engine
  // request Source Code's own governed hop at once.
  const { data: approvedDecision } = await decisionsDB.create({ status: "Identified", participantId: await rootParticipantId(seuId), authorityBadge: ROOT_ACTOR_BADGE,
    seuId, relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [sourceCode!.id] }],
    category: "Engineering Decisions", title: "Source Code decision 1 (already Approved)",
  });
  await decisionsDB.updateStatus(approvedDecision!.id, "Approved", { participantId: await rootParticipantId(seuId), authorityBadge: ROOT_ACTOR_BADGE });

  const { data: openDecision } = await decisionsDB.create({ status: "Identified", participantId: await rootParticipantId(seuId), authorityBadge: ROOT_ACTOR_BADGE,
    seuId, relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [sourceCode!.id] }],
    category: "Engineering Decisions", title: "Source Code decision 2 (still open)",
  });

  await driveDeliverableToApproved(requirementsSpec!.id, `cr109-source-code-partial-block-${seuId}`);
  await fulfilCapability({ seuId, capabilityId: constructionCapability!.capabilityId, capabilityCodes: ["software-construction"] });

  const blocked = await transitionDeliverable({ requestedBy: ROOT_ACTOR_ID, deliverableId: sourceCode!.id, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assert.equal(blocked.ok, false);
  if (blocked.ok) throw new Error("unreachable");
  assert.equal(blocked.reason, "decision_blocked", "one Approved Decision is not enough — the second, still-open Decision must still block");

  await decisionsDB.updateStatus(openDecision!.id, "Approved", { participantId: await rootParticipantId(seuId), authorityBadge: ROOT_ACTOR_BADGE });
  const dispatched = await transitionDeliverable({ requestedBy: ROOT_ACTOR_ID, deliverableId: sourceCode!.id, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assertTransitionRequested(dispatched);
});
