// CR-108 — Obligation Model (Ch.23) execution-side gaps found while building
// CR-107. Three real behaviors added, each covered here:
//
// 1. A Pack's own standalone contributionObligationDefinitions[] (composed
//    onto the EBM's behaviors.pool, migration 249/250) is now actually read
//    at runtime — raiseObligationsForPackDefinitions, called from
//    attemptSeuCommenceWork right after the Policy-block check — so a
//    Pack-declared Obligation whose applicabilityDeliverables names the
//    SEU|Activated|Operational hop genuinely blocks commence-work, and
//    resolving it lets the Execution Engine's own existing
//    ObligationTransitioned retry reach Operational.
// 2. AttentionItem has no blocked_from_state/blocked_to_state of its own
//    (Ch.34 has no such concept — it's a notification/routing surface, never
//    a structural gate), but AttentionItemTransitioned is now a real,
//    catalogued event two subscribers react to: executionEngineKickoff
//    re-attempts the SEU's own commence-work hop (filtered to
//    related_object_type === "SEU", self-checking via attemptSeuCommenceWork),
//    and deliverableKickoff runs its existing blanket per-Deliverable rescan.
// 3. The manual "Create Obligation" web form/route (SEU detail page) is
//    removed; Obligation creation for a Participant's own assigned
//    Deliverable now goes through participantHome.ts's raiseMyObligation,
//    which re-derives and enforces the caller's own myDeliverableIds before
//    calling the same createObligation core function.
//
// Run against the real dev database, no mocking.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionSeu } from "../src/routes/seu/core/commissioning.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { transitionObligation, createObligation } from "../src/routes/seu/core/obligations.js";
import { raiseMyObligation } from "../src/routes/seu/core/participantHome.js";
import { transitionAttentionItem } from "../src/routes/seu/core/attentionItems.js";
import { publishPack } from "../src/routes/seu/core/packs.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { publishProfile } from "../src/routes/seu/core/profiles.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import {
  uniqueTestPackVersion, driveCommissioningToActive, ensureEventSubscriptionsLoaded, waitUntilAsync,
  ensureWebAppTemplateFixture, commissionFromFormSync, ensureEligibleParticipant, resolveDispatchRejectionObligations,
  waitForDispatchedWorkItem, ensurePolicyDefinitionWithObligation,
} from "./testFixtures.js";
import type { SeuRow } from "../src/dblayer/seuTypes.js";

async function registerOrganisationName(code: string): Promise<void> {
  await pool.query(
    "INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES ('organisation-name', $1, $2, '11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING",
    [code, code]
  );
}

// --- Item 1: a Pack's own obligationDefinitions[].applicabilityDeliverables
// naming SEU|Activated|Operational must genuinely gate commence-work, the
// same way a Policy already does — same shared "SEU stays Activated, a real
// Obligation + Attention Item raised" shape CR-107's own commissionBlockedSeu
// already established for the Policy path.
async function commissionSeuBlockedByPackObligation(run: string) {
  const obligationCode = `cr108-ob-${run}`;
  const pack = {
    code: `cr108-pack-obligation-${run}`, name: "CR-108 Pack Obligation Pack", category: "Organisation",
    packVersion: uniqueTestPackVersion(), installationClassification: "Optional",
    contributions: {
      obligationDefinitions: [
        {
          code: obligationCode,
          category: "Engineering",
          title: `CR-108 pack obligation ${run}`,
          description: "A Pack-declared Obligation Definition must be resolved before this SEU may commence work.",
          origin: "Organisation Packs",
          priority: "High",
          severity: "High",
          completionCriteria: "The Pack-declared condition is satisfied.",
          requiredEvidence: { title: "n/a", category: "Analytical Evidence", description: "n/a", collectionMethod: "n/a" },
          applicabilityDeliverables: [{ name: "SEU", transitions: ["SEU|Activated|Operational"], governingCondition: null }],
        },
      ],
    },
  };
  await registerOrganisationName(pack.code);
  const published = await publishPack({ seed: pack as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(published.ok, `pack obligation pack must publish: ${!published.ok ? JSON.stringify(published) : ""}`);
  const { data: packRow } = await packsDB.findActiveByCode(pack.code);

  const { data: template } = await templatesDB.upsert({
    code: `cr108-tpl-${run}`, name: "CR-108 Template",
    deliverableCatalogue: [{ code: "requirements-analysis-model" }],
  });
  await templatesDB.setMandatoryPacks(template!.id, [pack.code]);
  await templatesDB.setRequiredCapabilities(template!.id, []);

  await ensureEventSubscriptionsLoaded();
  const { objective: root } = await createObjective({ statement: `cr108-root-${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed" });
  const { objective } = await createObjective({ statement: `cr108-${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: root.id, requestedBy: 1001 });
  const profilePublish = await publishProfile({
    seed: {
      code: `cr108-profile-${run}`,
      name: "CR-108 Profile",
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

  const result = await driveCommissioningToActive({ seuId: requested.seu.id, actorRole: "super", actorId: "1001", timeoutMs: 30000 });
  assert.equal(result.ok, false, "a Pack-declared Obligation Definition matching the hop must block Activated -> Operational");
  if (!result.ok) assert.equal(result.stage, "blocked");

  const { data: seu } = await seusDB.findById(requested.seu.id);
  assert.equal(seu?.lifecycle_state, "Activated", "a Pack-Obligation block leaves the SEU Activated, not Operational");

  const { data: obligations } = await obligationsDB.findByRelatedObject("SEU", seu!.id);
  const blockingObligation = (obligations ?? []).find((o) => o.blocked_to_state === "Operational" && o.title === `CR-108 pack obligation ${run}`);
  assert.ok(blockingObligation, "a real Obligation must be raised from the Pack's own Obligation Definition for the blocked commence-work hop");
  assert.equal(blockingObligation!.category, "Engineering");
  assert.equal(blockingObligation!.origin, "Organisation Packs");

  return { seu: seu!, blockingObligation: blockingObligation! };
}

test("CR-108 item 1: a Pack's own obligationDefinitions[].applicabilityDeliverables blocks SEU commence-work, and resolving it unblocks via the existing ObligationTransitioned retry", async () => {
  const run = randomUUID().slice(0, 8);
  const { seu, blockingObligation } = await commissionSeuBlockedByPackObligation(run);

  // Drive the real Obligation through its full lifecycle to Verified — the
  // same real transitionObligation path a human/API caller uses.
  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    const step = await transitionObligation({ obligationId: blockingObligation.id, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(step.ok, true, !step.ok ? `Obligation ${targetState} step failed: ${JSON.stringify(step)}` : undefined);
  }

  // ObligationTransitioned (published by that last "Verified" hop) wakes
  // executionEngineKickoff's existing handleObligationTransitioned — the same
  // retry path CR-107's Policy-raised Obligation already exercises, now
  // exercised by a Pack-raised one instead (blocked_from_state/
  // blocked_to_state are set identically by raiseObligationsForPackDefinitions).
  let seuAfter: SeuRow | null = null;
  await waitUntilAsync(async () => {
    const { data: reloaded } = await seusDB.findById(seu.id);
    seuAfter = reloaded ?? null;
    return reloaded?.lifecycle_state === "Operational";
  });
  assert.equal(seuAfter?.lifecycle_state, "Operational", "resolving the Pack-raised Obligation must let the Execution Engine's own retry reach Operational");
});

test("CR-108 item 2: resolving the raised AttentionItem (not the Obligation) also re-triggers the Execution Engine's own commence-work retry", async () => {
  const run = randomUUID().slice(0, 8);

  // A Policy block (same mechanism CR-107's own test uses) raises both a
  // real Obligation AND a real Attention Item for the SEU-scoped block
  // (raiseObligationForBlockedTransition). This test resolves ONLY the
  // Attention Item, leaving the Obligation itself untouched, to isolate
  // AttentionItemTransitioned as the real trigger — not a side effect of the
  // Obligation's own resolution.
  const pack = { code: `cr108-attn-pack-${run}`, name: "CR-108 Attention Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: {} };
  await registerOrganisationName(pack.code);
  const published = await publishPack({ seed: pack as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(published.ok, `attention pack must publish: ${!published.ok ? JSON.stringify(published) : ""}`);
  const { data: packRow } = await packsDB.findActiveByCode(pack.code);

  const policyCode = `cr108-attn-policy-${run}`;
  const { data: seuPolicy } = await policiesDB.upsert({
    code: policyCode, name: `CR-108 commence-work policy ${run}`, constraintType: "Policy",
    scope: "Transition", governedTransition: "SEU|Activated|Operational",
    condition: { type: "field_in", field: "neverSet", values: ["only-this-satisfies"] },
    originatingPackId: packRow!.id,
  });
  assert.ok(seuPolicy);
  // raiseObligationForBlockedTransition now raises nothing (no Obligation,
  // no Attention Item) unless the blocking Policy's own Definition declares
  // a relatedObligations[] entry.
  await ensurePolicyDefinitionWithObligation({ code: policyCode, name: `CR-108 commence-work policy ${run}`, category: "Compliance", title: `CR-108 attention blocker ${run}` });

  const { data: template } = await templatesDB.upsert({
    code: `cr108-attn-tpl-${run}`, name: "CR-108 Attention Template",
    deliverableCatalogue: [{ code: "requirements-analysis-model" }],
  });
  await templatesDB.setMandatoryPacks(template!.id, [pack.code]);
  await templatesDB.setRequiredCapabilities(template!.id, []);

  await ensureEventSubscriptionsLoaded();
  const { objective: root } = await createObjective({ statement: `cr108-attn-root-${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed" });
  const { objective } = await createObjective({ statement: `cr108-attn-${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: root.id, requestedBy: 1001 });
  const profilePublish = await publishProfile({
    seed: {
      code: `cr108-attn-profile-${run}`, name: "CR-108 Attention Profile", baseTemplateCode: template!.code,
      environment: "development", profileVersion: `1.0.${Date.now()}${process.pid}`,
      developmentMethodology: "scrum", primaryProgrammingLanguage: "typescript", sourceControlProvider: "github",
      redispatchMaxAttempts: 5, redispatchAttentionThreshold: 2,
    },
    actorRole: "super", actorId: "1001",
  });
  assert.equal(profilePublish.ok, true, !profilePublish.ok ? JSON.stringify(profilePublish.errors) : undefined);
  if (!profilePublish.ok) throw new Error("unreachable");
  const { data: profile } = await profilesDB.findById(profilePublish.profileId);
  const requested = await commissionSeu({ objectiveId: objective.id, templateIds: [template!.id], profileIds: [profile!.id], actorRole: "super", actorId: "1001" });
  assert.equal(requested.ok, true, !requested.ok ? `Validate Request failed: ${requested.reason}` : undefined);
  if (!requested.ok) throw new Error("unreachable");

  const driven = await driveCommissioningToActive({ seuId: requested.seu.id, actorRole: "super", actorId: "1001", timeoutMs: 30000 });
  assert.equal(driven.ok, false, "the unsatisfied Policy must block Activated -> Operational");

  const { data: seu } = await seusDB.findById(requested.seu.id);
  assert.equal(seu?.lifecycle_state, "Activated");

  // driveCommissioningToActive's own "blocked" detection only polls for the
  // Obligation (testFixtures.ts) — raiseObligationForBlockedTransition raises
  // the Attention Item in a separate, later awaited DB write within the same
  // call, so a real (if narrow) window exists where the Obligation is
  // visible before the Attention Item is. Poll for it too, rather than
  // reading it once.
  let attentionItem: import("../src/dblayer/seuTypes.js").AttentionItemRow | undefined;
  await waitUntilAsync(async () => {
    const { data } = await attentionItemsDB.findOpenByRelatedObjectAny("SEU", seu!.id);
    attentionItem = (data ?? []).find((a) => a.category === "Action Required" && /blocked by Policy/.test(a.title));
    return !!attentionItem;
  });
  assert.ok(attentionItem, "raiseObligationForBlockedTransition must also raise a real Attention Item for the SEU-scoped block");

  // Clear the actual blocking condition, exactly as CR-107's own test does —
  // re-publish the same Policy (same code + originatingPackId) with a
  // condition that now passes, so the retry below has something real to
  // succeed against.
  await policiesDB.upsert({
    code: seuPolicy!.code, name: `CR-108 commence-work policy ${run} (resolved)`, constraintType: "Policy",
    scope: "Transition", governedTransition: "SEU|Activated|Operational",
    condition: { type: "always_true" },
    originatingPackId: packRow!.id,
  });

  // Walk ONLY the Attention Item to Resolved — the Obligation itself is
  // deliberately left untouched, so any retry that happens is provably off
  // AttentionItemTransitioned, not a coincidental Obligation-side resolution.
  for (const targetState of ["Delivered", "Acknowledged", "In Progress", "Resolved"]) {
    const step = await transitionAttentionItem({ attentionItemId: attentionItem!.id, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(step.ok, true, !step.ok ? `Attention Item ${targetState} step failed: ${JSON.stringify(step)}` : undefined);
  }

  let seuAfter: SeuRow | null = null;
  await waitUntilAsync(async () => {
    const { data: reloaded } = await seusDB.findById(seu!.id);
    seuAfter = reloaded ?? null;
    return reloaded?.lifecycle_state === "Operational";
  });
  assert.equal(seuAfter?.lifecycle_state, "Operational", "resolving the raised Attention Item must let executionEngineKickoff's new AttentionItemTransitioned subscriber retry commence-work");
});

// --- Item 3: the manual SEU-detail "Create Obligation" web form/route is
// gone (see tests/web-flow.e2e.test.ts's Phase 4/7/8 fixes, which now call
// createObligation directly instead of POSTing to the removed route).
// raiseMyObligation (participantHome.ts) is the real replacement — a
// Participant may only raise an Obligation against a Deliverable genuinely
// dispatched to their own engagement, re-derived server-side, never trusted
// off the form.
async function createTestUser(label: string): Promise<number> {
  // migration 033 — users.type/tenant_id are NOT NULL (CR-004, every user
  // belongs to a Platform or a Tenant); 'Platform' + PLATFORM_TENANT_ID is
  // always seeded, so this needs no dependency on which tenant the SEU
  // itself was commissioned under.
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO users (email, name, type, tenant_id) VALUES ($1, $2, 'Platform', '11111111-1111-1111-1111-111111111111') RETURNING id",
    [`cr108-${label}-${randomUUID()}@example.test`, label]
  );
  return rows[0]!.id;
}

async function attachUserToParticipantMaster(participantMasterId: string, userId: number): Promise<void> {
  await pool.query("UPDATE participants_master SET user_id = $1 WHERE id = $2", [userId, participantMasterId]);
}

test("CR-108 item 3: a Participant can raise an Obligation against their own dispatched Deliverable, and is rejected for one that isn't theirs", async () => {
  const run = randomUUID().slice(0, 8);
  await ensureWebAppTemplateFixture();
  const userId = await createTestUser(run);

  const result = await commissionFromFormSync(
    { statement: `cr108-participant-${run}`, requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"], actorRole: "super", actorId: "1001", requestedBy: 1001 },
    async (seuId) => {
      const detail = await getSeuDetailView(seuId);
      const capability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
      assert.ok(capability);
      const participantMasterId = await ensureEligibleParticipant(seuId, ["requirements-analysis"]);
      await attachUserToParticipantMaster(participantMasterId, userId);
      await fulfilCapability({ seuId, capabilityId: capability!.capabilityId, participantMasterId });
    }
  );
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const seuId = result.seu.id;

  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec);
  await resolveDispatchRejectionObligations(seuId);

  // Drive the Deliverable to a real dispatched Work Item against this exact
  // Participant — myDeliverableIds (raiseMyObligation's own ownership check)
  // is derived from a real commands/work_items row, never assumed.
  await transitionDeliverable({ deliverableId: requirementsSpec!.id, targetState: "In Progress", actorRole: "super", actorId: "1001" });
  await waitForDispatchedWorkItem(requirementsSpec!.id, "Defined", "In Progress");

  const raised = await raiseMyObligation({
    userId, seuId, deliverableId: requirementsSpec!.id,
    category: "Engineering", title: "CR-108 participant-raised obligation",
    description: "Raised via the Participant-facing quickview form.",
    severity: "Medium", completionCriteria: "The named condition is addressed.",
  });
  assert.equal(raised.ok, true, !raised.ok ? JSON.stringify(raised) : undefined);
  if (!raised.ok) throw new Error("unreachable");
  assert.equal(raised.obligation.related_object_type, "Deliverable");
  assert.equal(raised.obligation.related_object_id, requirementsSpec!.id);
  assert.equal(raised.obligation.seu_id, seuId);

  // A Deliverable never dispatched to this Participant — not_mine, no
  // Obligation created, regardless of whether the id is even real.
  const rejected = await raiseMyObligation({
    userId, seuId, deliverableId: randomUUID(),
    category: "Engineering", title: "should never be created",
  });
  assert.equal(rejected.ok, false);
  if (rejected.ok) throw new Error("unreachable");
  assert.equal(rejected.reason, "not_mine");
});

// --- CR-108 follow-on (owner: "WorkItem Generator has to include everything
// in the EBM relevant to that deliverable including obligations, evidences,
// knowledge... Engineering Capital and Checklists are part of a pack which
// shows contributing capability. If deliverable corresponds to the
// capability, it gets included in the workitem... The relevant profile
// configuration parameters have to be in the work item. Like methodology,
// environment etc. dispatch_strategy is not relevant to a participant.")
// Exercises workItemGenerator.ts's three widened Execution Context fields
// together: activeObligations (Deliverable-wide, not outcome-scoped),
// applicableChecklists/engineeringCapital (matched via the composing Pack's
// own contributed Capability code), and profileConfiguration (work-relevant
// fields only, dispatch-mechanism knobs excluded).
test("CR-108 follow-on: Work Item Execution Context includes every Deliverable Obligation, the composing Pack's own Checklists/Engineering Capital matched via producing Capability, and relevant Profile Configuration only", async () => {
  const run = randomUUID().slice(0, 8);
  const pack = {
    code: `cr108-ec-pack-${run}`, name: "CR-108 Execution Context Pack", category: "Organisation",
    packVersion: uniqueTestPackVersion(), installationClassification: "Optional",
    contributions: {
      capabilities: [{ code: "requirements-analysis" }],
      checklists: [
        {
          name: "CR-108 Execution Context Checklist",
          description: "Checklist exercised by the Execution Context widening test.",
          items: [{ statement: "CR-108 checklist item statement" }],
        },
      ],
      engineeringCapital: [{ type: "Reusable Components", url: "https://example.test/cr108-ec" }],
    },
  };
  await registerOrganisationName(pack.code);
  const published = await publishPack({ seed: pack as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(published.ok, `execution-context pack must publish: ${!published.ok ? JSON.stringify(published) : ""}`);

  const { data: requiredCapabilities } = await capabilitiesDB.findByOriginatingPackIds([published.pack!.id]);
  const { data: template } = await templatesDB.upsert({
    code: `cr108-ec-tpl-${run}`, name: "CR-108 Execution Context Template",
    deliverableCatalogue: [{ code: "requirements-analysis-model" }],
  });
  await templatesDB.setMandatoryPacks(template!.id, [pack.code]);
  await templatesDB.setRequiredCapabilities(template!.id, (requiredCapabilities ?? []).map((c) => c.id));

  await ensureEventSubscriptionsLoaded();
  const { objective: root } = await createObjective({ statement: `cr108-ec-root-${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed" });
  const { objective } = await createObjective({ statement: `cr108-ec-${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: root.id, requestedBy: 1001 });
  const profilePublish = await publishProfile({
    seed: {
      code: `cr108-ec-profile-${run}`, name: "CR-108 Execution Context Profile", baseTemplateCode: template!.code,
      environment: "development", profileVersion: `1.0.${Date.now()}${process.pid}`,
      developmentMethodology: "scrum", primaryProgrammingLanguage: "typescript", sourceControlProvider: "github",
      redispatchMaxAttempts: 5, redispatchAttentionThreshold: 2,
    },
    actorRole: "super", actorId: "1001",
  });
  assert.equal(profilePublish.ok, true, !profilePublish.ok ? JSON.stringify(profilePublish.errors) : undefined);
  if (!profilePublish.ok) throw new Error("unreachable");
  const { data: profile } = await profilesDB.findById(profilePublish.profileId);
  const requested = await commissionSeu({ objectiveId: objective.id, templateIds: [template!.id], profileIds: [profile!.id], actorRole: "super", actorId: "1001" });
  assert.equal(requested.ok, true, !requested.ok ? `Validate Request failed: ${requested.reason}` : undefined);
  if (!requested.ok) throw new Error("unreachable");
  const seuId = requested.seu.id;

  // The unrelated Obligation must exist BEFORE the Deliverable ever becomes
  // dispatch-eligible — same reasoning tests/attention-and-interaction.test.ts's
  // own commissionAndFulfilRequirementsSpec documents: deliverableKickoff's
  // automatic rescan (off SEUOperational, fire-and-forget) can otherwise
  // generate the Work Item — freezing its Execution Context — before this
  // test's own createObligation call lands. beforeCommenceWork fires as soon
  // as the SEU reaches Activated, which is after Create Engineering Assets
  // has already run (the Deliverable row exists) but before any automatic
  // dispatch attempt.
  let unrelatedObligation!: Awaited<ReturnType<typeof createObligation>>;
  const driven = await driveCommissioningToActive({
    seuId, actorRole: "super", actorId: "1001", timeoutMs: 30000,
    beforeCommenceWork: async () => {
      const detail = await getSeuDetailView(seuId);
      const capability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
      assert.ok(capability);
      const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
      assert.ok(requirementsSpec);

      // Unrelated to the Governance Evaluation Outcome the transition below
      // will produce — proving activeObligations is genuinely "every
      // Obligation on the Deliverable," not just what a specific Outcome
      // happened to consult.
      unrelatedObligation = await createObligation({
        relatedObjectType: "Deliverable", relatedObjectId: requirementsSpec!.id,
        category: "Engineering", title: `CR-108 unrelated obligation ${run}`,
      });

      const participantMasterId = await ensureEligibleParticipant(seuId, ["requirements-analysis"]);
      await fulfilCapability({ seuId, capabilityId: capability!.capabilityId, participantMasterId });
    },
  });
  assert.equal(driven.ok, true, !driven.ok ? JSON.stringify(driven) : undefined);
  await resolveDispatchRejectionObligations(seuId);

  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec);

  await transitionDeliverable({ deliverableId: requirementsSpec!.id, targetState: "In Progress", actorRole: "super", actorId: "1001" });
  const { workItem } = await waitForDispatchedWorkItem(requirementsSpec!.id, "Defined", "In Progress");
  const ec = workItem!.execution_context!;

  assert.ok(ec.activeObligations.some((o) => o.id === unrelatedObligation.id), "activeObligations must include every Obligation on the Deliverable, not just ones a Governance Evaluation Outcome consulted");

  assert.ok(
    ec.applicableChecklists.some((c) => c.packCode === pack.code && c.checklistName === "CR-108 Execution Context Checklist" && c.statement === "CR-108 checklist item statement"),
    "applicableChecklists must include the composing Pack's own Checklist item, matched via the Deliverable's producing Capability"
  );
  assert.ok(
    ec.engineeringCapital.some((c) => c.packCode === pack.code && c.type === "Reusable Components" && c.url === "https://example.test/cr108-ec"),
    "engineeringCapital must include the composing Pack's own entry, matched the same way"
  );

  assert.equal(ec.profileConfiguration.developmentMethodology, "scrum");
  assert.equal(ec.profileConfiguration.environment, "development");
  assert.equal(ec.profileConfiguration.primaryProgrammingLanguage, "typescript");
  assert.equal(ec.profileConfiguration.sourceControlProvider, "github");
  assert.equal((ec.profileConfiguration as Record<string, unknown>).dispatchStrategyPreference, undefined, "dispatch-mechanism knobs must never appear in the Participant-facing profileConfiguration");
  assert.equal((ec.profileConfiguration as Record<string, unknown>).redispatchMaxAttempts, undefined);
});
