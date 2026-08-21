// Post-MVP Phase 5 (Knowledge, Evidence, Decision Models: Ch.16, 17, 19) —
// automated coverage for what the Phase 5 audit checked by hand: a Deliverable
// transition ("Approved" -> "Baselined", new this phase) is blocked until
// either an accepted Evidence Item or an approved Decision exists for that
// Deliverable, and each of Evidence/Knowledge/Decision runs its own governed
// lifecycle through the same generic transitionEngine every other entity type
// already uses. Run against the real dev database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverableSync as transitionDeliverable } from "./testFixtures.js";
import { createEvidence, transitionEvidence, linkEvidenceToObject, listEvidenceRelationships, listEvidenceLinkedToSeu } from "../src/routes/seu/core/evidence.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { evidenceDB } from "../src/dblayer/evidenceDB.js";
import { createKnowledgeItem, transitionKnowledgeItem } from "../src/routes/seu/core/knowledge.js";
import { createDecision, transitionDecision } from "../src/routes/seu/core/decisions.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function commissionTestSeu(statementPrefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super", actorId: "1001",
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

// Fulfils the Capability and walks Requirements Specification from 'Defined'
// all the way to 'Approved' — no Obligation is ever created, so Phase 4's
// Quality Gate on "In Progress" -> "Approved" passes trivially, isolating
// Phase 5's new "Approved" -> "Baselined" gate as the only thing under test.
async function commissionAndApproveRequirementsSpec(statementPrefix: string) {
  const seuId = await commissionTestSeu(statementPrefix);
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);

  await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, participantType: "AI", displayName: "Phase5 Test Analyst" });
  const toInProgress = await transitionDeliverable({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(toInProgress.ok, true, !toInProgress.ok ? JSON.stringify(toInProgress) : undefined);
  const toApproved = await transitionDeliverable({ deliverableId: requirementsSpec.id, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(toApproved.ok, true, !toApproved.ok ? JSON.stringify(toApproved) : undefined);

  return { seuId, deliverableId: requirementsSpec.id };
}

test("Quality Gate blocks 'Approved' -> 'Baselined' until Evidence is Accepted, then allows it", async () => {
  const { seuId, deliverableId } = await commissionAndApproveRequirementsSpec("phase5-evidence-gate");

  const blocked = await transitionDeliverable({ deliverableId, targetState: "Baselined", actorRole: "super", actorId: "1" });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.equal(blocked.reason, "quality_gate_blocked");
    if (blocked.reason === "quality_gate_blocked") {
      assert.match(blocked.detail, /Requires Accepted Evidence or Approved Decision/);
      assert.match(blocked.detail, /no accepted Evidence or approved Decision found/);
    }
  }

  const evidence = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Validation Evidence", title: "Phase5 test: requirements sign-off", source: "Manual review" });
  assert.equal(evidence.status, "Collected");

  // Not yet Accepted — still blocked.
  const stillBlocked = await transitionDeliverable({ deliverableId, targetState: "Baselined", actorRole: "super", actorId: "1" });
  assert.equal(stillBlocked.ok, false);

  const toValidated = await transitionEvidence({ evidenceId: evidence.id, targetState: "Validated", actorRole: "super", actorId: "1001" });
  assert.equal(toValidated.ok, true);
  const toAccepted = await transitionEvidence({ evidenceId: evidence.id, targetState: "Accepted", actorRole: "super", actorId: "1001" });
  assert.equal(toAccepted.ok, true);

  const unblocked = await transitionDeliverable({ deliverableId, targetState: "Baselined", actorRole: "super", actorId: "1" });
  assert.equal(unblocked.ok, true, !unblocked.ok ? JSON.stringify(unblocked) : undefined);
  if (unblocked.ok) assert.equal(unblocked.deliverable.lifecycle_state, "Baselined");
});

test("Quality Gate also accepts an Approved Decision as satisfying the same precondition (the 'or' in Evidence-or-Decision)", async () => {
  const { seuId, deliverableId } = await commissionAndApproveRequirementsSpec("phase5-decision-gate");

  const decision = await createDecision({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Engineering Decisions", title: "Phase5 test: baseline readiness", selectedAlternative: "Proceed to baseline" });
  assert.equal(decision.status, "Identified");

  for (const targetState of ["Analysed", "Proposed", "Reviewed", "Approved"]) {
    const step = await transitionDecision({ decisionId: decision.id, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(step.ok, true, !step.ok ? `Decision transition to ${targetState} failed: ${JSON.stringify(step)}` : undefined);
  }

  const unblocked = await transitionDeliverable({ deliverableId, targetState: "Baselined", actorRole: "super", actorId: "1" });
  assert.equal(unblocked.ok, true, !unblocked.ok ? JSON.stringify(unblocked) : undefined);
});

test("Evidence, Knowledge and Decision each run their own governed lifecycle and reject an undefined transition", async () => {
  const { seuId, deliverableId } = await commissionAndApproveRequirementsSpec("phase5-lifecycles");

  const evidence = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Analytical Evidence", title: "Phase5 lifecycle test evidence" });
  const evidenceInvalid = await transitionEvidence({ evidenceId: evidence.id, targetState: "Referenced", actorRole: "super", actorId: "1001" });
  assert.equal(evidenceInvalid.ok, false);
  if (!evidenceInvalid.ok) assert.equal(evidenceInvalid.reason, "no_transition_definition");

  const knowledgeItem = await createKnowledgeItem({ seuId, deliverableId, category: "Technical Knowledge", title: "Phase5 lifecycle test knowledge" });
  const knowledgeInvalid = await transitionKnowledgeItem({ knowledgeItemId: knowledgeItem.id, targetState: "Published", actorRole: "super", actorId: "1001" });
  assert.equal(knowledgeInvalid.ok, false);
  if (!knowledgeInvalid.ok) assert.equal(knowledgeInvalid.reason, "no_transition_definition");

  const decision = await createDecision({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Design Decisions", title: "Phase5 lifecycle test decision" });
  const decisionInvalid = await transitionDecision({ decisionId: decision.id, targetState: "Approved", actorRole: "super", actorId: "1001" });
  assert.equal(decisionInvalid.ok, false);
  if (!decisionInvalid.ok) assert.equal(decisionInvalid.reason, "no_transition_definition");
});

// Chapter 17 §9/§20 gap fix (owner, 2026-08-21) — "Rejected evidence shall
// remain preserved for audit purposes" had no transition path into it at
// all before this fix (data-only: new transition_definitions/authorityVocabulary
// rows, no code change — transitionEngine is already fully generic). Proves
// both reachable hops (Collected->Rejected and Validated->Rejected), and
// that Rejected is terminal (no further governed hop out of it).
test("Evidence can be Rejected from either Collected or Validated, and Rejected is terminal", async () => {
  const { seuId, deliverableId } = await commissionAndApproveRequirementsSpec("phase5-evidence-reject");

  const fromCollected = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Analytical Evidence", title: "Reject from Collected" });
  const rejectedFromCollected = await transitionEvidence({ evidenceId: fromCollected.id, targetState: "Rejected", actorRole: "super", actorId: "1001" });
  assert.equal(rejectedFromCollected.ok, true, !rejectedFromCollected.ok ? JSON.stringify(rejectedFromCollected) : undefined);
  if (rejectedFromCollected.ok) assert.equal(rejectedFromCollected.evidence.status, "Rejected");

  const fromValidated = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Analytical Evidence", title: "Reject from Validated" });
  const toValidated = await transitionEvidence({ evidenceId: fromValidated.id, targetState: "Validated", actorRole: "super", actorId: "1001" });
  assert.equal(toValidated.ok, true, !toValidated.ok ? JSON.stringify(toValidated) : undefined);
  const rejectedFromValidated = await transitionEvidence({ evidenceId: fromValidated.id, targetState: "Rejected", actorRole: "super", actorId: "1001" });
  assert.equal(rejectedFromValidated.ok, true, !rejectedFromValidated.ok ? JSON.stringify(rejectedFromValidated) : undefined);

  // Terminal: no governed hop exists out of Rejected (preserved for audit,
  // per the chapter's own words — not archived, not reactivated).
  const noFurtherHop = await transitionEvidence({ evidenceId: fromCollected.id, targetState: "Archived", actorRole: "super", actorId: "1001" });
  assert.equal(noFurtherHop.ok, false);
  if (!noFurtherHop.ok) assert.equal(noFurtherHop.reason, "no_transition_definition");
});

test("Knowledge Item inherits Acquisition Scope from its producing Deliverable by default", async () => {
  const { deliverableId, seuId } = await commissionAndApproveRequirementsSpec("phase5-acquisition-scope");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.id === deliverableId);
  assert.ok(requirementsSpec);
  assert.equal(requirementsSpec.acquisitionScope, "SEU", "seeded Deliverables default to SEU scope");

  const inherited = await createKnowledgeItem({ seuId, deliverableId, category: "Domain Knowledge", title: "Phase5 scope inheritance test" });
  assert.equal(inherited.acquisition_scope, "SEU");

  const overridden = await createKnowledgeItem({ seuId, deliverableId, category: "Domain Knowledge", title: "Phase5 scope override test", acquisitionScope: "Capability" });
  assert.equal(overridden.acquisition_scope, "Capability");
});

// CR-051 item 1 (Ch.17 §20.2/§20.8) — one Evidence Item may support many
// engineering artefacts. Proves the join-table redesign: linking to a
// second object, findByRelatedObject finding it via both, cross-SEU sharing
// (the confirmed side effect — no same-SEU ownership check blocks it), and
// idempotent re-linking.
test("Evidence can be linked to more than one object, findByRelatedObject finds it via each, and cross-SEU linking works", async () => {
  const { seuId: seuA, deliverableId: deliverableA } = await commissionAndApproveRequirementsSpec("phase5-evidence-multi-a");
  const { deliverableId: deliverableB } = await commissionAndApproveRequirementsSpec("phase5-evidence-multi-b");

  const evidence = await createEvidence({ seuId: seuA, relatedObjectType: "Deliverable", relatedObjectId: deliverableA, category: "Validation Evidence", title: "Shared test results" });

  // Only one relationship so far — from creation.
  const relationshipsBefore = await listEvidenceRelationships(evidence.id);
  assert.equal(relationshipsBefore.length, 1);
  assert.equal(relationshipsBefore[0].related_object_id, deliverableA);

  // Link to a SECOND Deliverable belonging to a DIFFERENT SEU entirely.
  const linked = await linkEvidenceToObject(evidence.id, "Deliverable", deliverableB);
  assert.equal(linked.ok, true, !linked.ok ? linked.detail : undefined);

  const relationshipsAfter = await listEvidenceRelationships(evidence.id);
  assert.equal(relationshipsAfter.length, 2, "one Evidence Item now supports two artefacts");

  // findByRelatedObject finds the SAME Evidence row via EITHER relationship.
  const { data: foundViaA } = await evidenceDB.findByRelatedObject("Deliverable", deliverableA);
  assert.ok((foundViaA ?? []).some((e) => e.id === evidence.id));
  const { data: foundViaB } = await evidenceDB.findByRelatedObject("Deliverable", deliverableB);
  assert.ok((foundViaB ?? []).some((e) => e.id === evidence.id), "cross-SEU: found via a Deliverable belonging to a different SEU than the Evidence's own origin");

  // Re-linking the same relationship is a no-op, not an error.
  const relinked = await linkEvidenceToObject(evidence.id, "Deliverable", deliverableB);
  assert.equal(relinked.ok, true);
  const relationshipsAfterRelink = await listEvidenceRelationships(evidence.id);
  assert.equal(relationshipsAfterRelink.length, 2, "re-linking the same object is idempotent");

  // Linking a non-existent Deliverable is rejected.
  const invalid = await linkEvidenceToObject(evidence.id, "Deliverable", randomUUID());
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.reason, "invalid");

  // Linking against a non-existent Evidence row is rejected.
  const notFound = await linkEvidenceToObject(randomUUID(), "Deliverable", deliverableA);
  assert.equal(notFound.ok, false);
  if (!notFound.ok) assert.equal(notFound.reason, "not_found");
});

// CR-051 item 3 (Ch.17 §12/§20.10) — Evidence Provenance: originating
// Deliverable/Participant/Capability/Decision/activity, all preserved and
// surfaced through the SEU detail view's provenance labels.
test("Evidence preserves its full provenance — originating Deliverable, Participant, Capability, Decision and activity", async () => {
  const seuId = await commissionTestSeu("phase5-evidence-provenance");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);

  const { participant } = await fulfilCapability({
    seuId, capabilityId: reqAnalysisCapability.capabilityId, participantType: "AI", displayName: "Phase5 Provenance Analyst",
  });

  const decision = await createDecision({
    seuId, relatedObjectType: "Deliverable", relatedObjectId: requirementsSpec.id,
    category: "Engineering Decisions", title: "Phase5 provenance test decision",
  });

  const evidence = await createEvidence({
    seuId, relatedObjectType: "Deliverable", relatedObjectId: requirementsSpec.id,
    category: "Validation Evidence", title: "Provenance-tagged evidence",
    originatingParticipantId: participant.id,
    originatingCapabilityId: reqAnalysisCapability.capabilityId,
    originatingDecisionId: decision.id,
    originatingActivity: "ran the requirements validation suite",
  });

  // originatingDeliverableId auto-derives from relatedObjectType/Id (Deliverable case).
  assert.equal(evidence.originating_deliverable_id, requirementsSpec.id);
  assert.equal(evidence.originating_participant_id, participant.id);
  assert.equal(evidence.originating_capability_id, reqAnalysisCapability.capabilityId);
  assert.equal(evidence.originating_decision_id, decision.id);
  assert.equal(evidence.originating_activity, "ran the requirements validation suite");

  const refreshed = await getSeuDetailView(seuId);
  const evidenceView = refreshed?.evidence.find((e) => e.evidence.id === evidence.id);
  assert.ok(evidenceView);
  assert.equal(evidenceView.provenance.deliverableName, "Requirements Specification");
  assert.equal(evidenceView.provenance.participantName, "Phase5 Provenance Analyst (AI)");
  assert.ok(evidenceView.provenance.capabilityName?.includes("requirements-analysis"));
  assert.equal(evidenceView.provenance.decisionTitle, "Phase5 provenance test decision");
  assert.equal(evidenceView.provenance.activity, "ran the requirements validation suite");

  // Provenance is entirely optional — Evidence created without any of it has null fields, not an error.
  const bareEvidence = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: requirementsSpec.id, category: "Validation Evidence", title: "No provenance supplied" });
  assert.equal(bareEvidence.originating_participant_id, null);
  assert.equal(bareEvidence.originating_capability_id, null);
  assert.equal(bareEvidence.originating_decision_id, null);
  assert.equal(bareEvidence.originating_activity, null);
  // ...except originating Deliverable, which still auto-derives.
  assert.equal(bareEvidence.originating_deliverable_id, requirementsSpec.id);
});

// CR-051 item 4 (Ch.17 §15/§20.13) — versioning + supersede link. Owner's own
// worked example: V1 supports Deliverables in SEU1 AND SEU2 (cross-SEU
// sharing, item 2). V2 corrects V1 but is only relevant to SEU2. Superseding
// must NOT cascade — SEU1's own relationship to V1 stays exactly as it was.
test("Superseding an Evidence Item does not cascade — the predecessor's own relationships and status are untouched", async () => {
  const { seuId: seu1, deliverableId: seu1Deliverable } = await commissionAndApproveRequirementsSpec("phase5-evidence-supersede-a");
  const { seuId: seu2, deliverableId: seu2Deliverable } = await commissionAndApproveRequirementsSpec("phase5-evidence-supersede-b");

  const v1 = await createEvidence({ seuId: seu1, relatedObjectType: "Deliverable", relatedObjectId: seu1Deliverable, category: "Validation Evidence", title: "V1: shared test results" });
  const linked = await linkEvidenceToObject(v1.id, "Deliverable", seu2Deliverable);
  assert.equal(linked.ok, true, !linked.ok ? linked.detail : undefined);

  // V1 must be discoverable as a supersede-predecessor from SEU2's own page,
  // even though it originated in SEU1 — the whole point of the scenario.
  const seu2Candidates = await listEvidenceLinkedToSeu(seu2);
  assert.ok(seu2Candidates.some((e) => e.id === v1.id), "cross-SEU-shared V1 must be findable from SEU2's own page");

  // V2 corrects V1, but is only ever linked to SEU2's own Deliverable.
  const v2 = await createEvidence({
    seuId: seu2, relatedObjectType: "Deliverable", relatedObjectId: seu2Deliverable,
    category: "Validation Evidence", title: "V2: corrected test results", supersedesEvidenceId: v1.id,
  });
  assert.equal(v2.supersedes_evidence_id, v1.id);

  // V1's own relationships are completely unchanged — still both SEU1's and SEU2's original Deliverables.
  const v1Relationships = await listEvidenceRelationships(v1.id);
  assert.equal(v1Relationships.length, 2, "V2's existence must not add, remove, or alter any of V1's own relationships");
  assert.ok(v1Relationships.some((r) => r.related_object_id === seu1Deliverable));
  assert.ok(v1Relationships.some((r) => r.related_object_id === seu2Deliverable));

  // V1's status is untouched — no automatic transition on supersede.
  const { data: v1Refetched } = await evidenceDB.findById(v1.id);
  assert.equal(v1Refetched?.status, "Collected", "superseding must not change the predecessor's own lifecycle status");

  // V1 still satisfies SEU1's own Quality Gate exactly as before — nothing about SEU1's standing changed.
  const { data: stillFoundForSeu1 } = await evidenceDB.findByRelatedObject("Deliverable", seu1Deliverable);
  assert.ok((stillFoundForSeu1 ?? []).some((e) => e.id === v1.id), "V1 must still satisfy SEU1's own Deliverable exactly as before");

  // The reverse lookup finds V2 from V1.
  const supersededBy = await evidenceDB.findSupersededBy(v1.id);
  assert.ok((supersededBy.data ?? []).some((e) => e.id === v2.id));

  // Naming a non-existent predecessor is rejected.
  await assert.rejects(() =>
    createEvidence({ seuId: seu2, relatedObjectType: "Deliverable", relatedObjectId: seu2Deliverable, category: "Validation Evidence", title: "Bogus predecessor", supersedesEvidenceId: randomUUID() })
  );
});

// CR-051 item 5 (Ch.17 §16/§20.14) — the full named event set. Landing in
// each state publishes its own named event (EvidenceValidated/Accepted/
// Referenced/Archived/Rejected), not just the generic EvidenceTransitioned.
test("Evidence transitions publish the correct named event for each landed state", async () => {
  const { seuId, deliverableId } = await commissionAndApproveRequirementsSpec("phase5-evidence-named-events");

  const evidence = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Analytical Evidence", title: "Named-event test evidence" });

  for (const [targetState, expectedEventType] of [
    ["Validated", "EvidenceValidated"],
    ["Accepted", "EvidenceAccepted"],
    ["Referenced", "EvidenceReferenced"],
    ["Archived", "EvidenceArchived"],
  ] as const) {
    const result = await transitionEvidence({ evidenceId: evidence.id, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(result.ok, true, !result.ok ? JSON.stringify(result) : undefined);
  }

  const { data: events } = await eventsDB.findByOriginatingObject("Evidence", evidence.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  assert.ok(eventTypes.includes("EvidenceCollected"));
  assert.ok(eventTypes.includes("EvidenceValidated"));
  assert.ok(eventTypes.includes("EvidenceAccepted"));
  assert.ok(eventTypes.includes("EvidenceReferenced"));
  assert.ok(eventTypes.includes("EvidenceArchived"));
  assert.ok(!eventTypes.includes("EvidenceTransitioned"), "the generic fallback must not fire for a target state the map covers");

  // Rejected is a separate branch (Collected -> Rejected), tested independently.
  const rejectable = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Analytical Evidence", title: "Named-event test evidence (rejected)" });
  const rejected = await transitionEvidence({ evidenceId: rejectable.id, targetState: "Rejected", actorRole: "super", actorId: "1001" });
  assert.equal(rejected.ok, true, !rejected.ok ? JSON.stringify(rejected) : undefined);
  const { data: rejectedEvents } = await eventsDB.findByOriginatingObject("Evidence", rejectable.id);
  assert.ok((rejectedEvents ?? []).some((e) => e.event_type === "EvidenceRejected"));
});
