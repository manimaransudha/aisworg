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
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverableSync as transitionDeliverable } from "./testFixtures.js";
import { createEvidence, transitionEvidence, linkEvidenceToObject, listEvidenceRelationships, listEvidenceLinkedToSeu } from "../src/routes/seu/core/evidence.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { evidenceDB } from "../src/dblayer/evidenceDB.js";
import { addKnowledgeValidationNote, createKnowledgeItem, listKnowledgeValidationNotes, transitionKnowledgeItem, updateKnowledgeReferences } from "../src/routes/seu/core/knowledge.js";
import { createDecision, transitionDecision } from "../src/routes/seu/core/decisions.js";
import { ensureWebAppTemplateFixture, ensureCoreEngineeringQualityGates, commissionFromFormSync, ensureEligibleParticipant, resolveDispatchRejectionObligations } from "./testFixtures.js";

async function commissionTestSeu(statementPrefix: string, beforeCommenceWork?: (seuId: string) => Promise<void>) {
  await ensureWebAppTemplateFixture();
  await ensureCoreEngineeringQualityGates();
  const result = await commissionFromFormSync(
    {
      statement: `${statementPrefix}-${randomUUID()}`,
      requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
      actorRole: "super", actorId: "1001", requestedBy: 1001,
    },
    beforeCommenceWork
  );
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

// Fulfils the Capability and walks Requirements Analysis Model from 'Defined'
// all the way to 'Approved' — no Obligation is ever created, so Phase 4's
// Quality Gate on "In Progress" -> "Approved" passes trivially, isolating
// Phase 5's new "Approved" -> "Baselined" gate as the only thing under test.
async function commissionAndApproveRequirementsSpec(statementPrefix: string) {
  const seuId = await commissionTestSeu(statementPrefix, async (seuId) => {
    const detail = await getSeuDetailView(seuId);
    const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
    assert.ok(reqAnalysisCapability);
    await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, participantMasterId: await ensureEligibleParticipant(seuId, ["requirements-analysis"]) });
  });
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec);
  // The automatic commence-work rescan (off SEUOperational) has already hit
  // this Deliverable's own then-unfulfilled Capability by the time
  // fulfilCapability above could possibly run — a real, by-design
  // empty_eligible_pool Obligation, not part of this test's own scenario.
  await resolveDispatchRejectionObligations(seuId);

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
      // CR-058 follow-up 2 — the gate's own category (now = its code,
      // category:evidence-backed) narrows the message; the real seeded
      // gate for this transition is category "Validation Evidence",
      // matching the Evidence this test creates below.
      assert.match(blocked.detail, /no accepted Evidence of category "Validation Evidence" or approved Decision found/);
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

  const decision = await createDecision({ seuId, relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [deliverableId] }], category: "Engineering Decisions", title: "Phase5 test: baseline readiness" });
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

  const decision = await createDecision({ seuId, relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [deliverableId] }], category: "Design Decisions", title: "Phase5 lifecycle test decision" });
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

// "Firm up the Knowledge structure" session (2026-09-19, migration 239) —
// §8/§10/§14's structured reference fields, version, author/badge tracking,
// and append-only validation notes are all real columns/mechanisms now, not
// gaps. Owner-confirmed design: the 4 reference fields (Evidence/Deliverable/
// Decision/Knowledge References) share one §10-relationship-type-keyed JSON
// shape; "supersedes" is valid only inside knowledge_references ("knowledge
// can contradict anything" but supersession "should stay within knowledge
// references only"); validation notes aggregate, never overwrite, with no
// forced gate on any one transition.
test("Knowledge Item captures §8/§10/§14 structure: structured references, version default, author/badge tracking, self-reference guard, and aggregated validation notes", async () => {
  const { seuId, deliverableId } = await commissionAndApproveRequirementsSpec("phase5-knowledge-structure");

  const evidence = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Analytical Evidence", title: "Phase5 structure test evidence" });
  const decision = await createDecision({ seuId, relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [deliverableId] }], category: "Design Decisions", title: "Phase5 structure test decision" });
  const otherKnowledge = await createKnowledgeItem({ seuId, deliverableId, category: "Domain Knowledge", title: "Phase5 structure test - other knowledge item" });

  const knowledgeItem = await createKnowledgeItem({
    seuId,
    deliverableId,
    category: "Technical Knowledge",
    title: "Phase5 structure test knowledge",
    evidenceReferences: { supports: [evidence.id] },
    deliverableReferences: { "derives from": [deliverableId] },
    decisionReferences: { supports: [decision.id] },
    knowledgeReferences: { "derives from": [otherKnowledge.id] },
    confidenceLevel: "Medium",
    userId: 1001,
  });

  // §8/§10: each reference field lands exactly as given, in its own §10-shaped object.
  assert.deepEqual(knowledgeItem.evidence_references, { supports: [evidence.id] });
  assert.deepEqual(knowledgeItem.deliverable_references, { "derives from": [deliverableId] });
  assert.deepEqual(knowledgeItem.decision_references, { supports: [decision.id] });
  assert.deepEqual(knowledgeItem.knowledge_references, { "derives from": [otherKnowledge.id] });
  assert.equal(knowledgeItem.confidence_level, "Medium");

  // §15/FR-41.1: version starts at 1.0.0 — no bump logic yet, since no Edit path exists.
  assert.equal(knowledgeItem.version, "1.0.0");

  // Creation is ungoverned — no badge yet (mirrors decisions.authority_badge's own treatment).
  assert.equal(knowledgeItem.authority_badge, null);

  // §10: Related Knowledge must never refer to itself.
  await assert.rejects(() => updateKnowledgeReferences(knowledgeItem.id, { supports: [knowledgeItem.id] }), /own id/);

  // A real, non-self update succeeds and persists.
  const withUpdatedReferences = await updateKnowledgeReferences(knowledgeItem.id, { "derives from": [otherKnowledge.id], supersedes: [otherKnowledge.id] });
  assert.deepEqual(withUpdatedReferences.knowledge_references, { "derives from": [otherKnowledge.id], supersedes: [otherKnowledge.id] });

  // author_id/authority_badge update on every governed transition thereafter
  // — the row always reflects the most recent actor, full history stays in `events`.
  const toProposed = await transitionKnowledgeItem({ knowledgeItemId: knowledgeItem.id, targetState: "Proposed", actorRole: "super", actorId: "1001", userId: 1001 });
  assert.equal(toProposed.ok, true, !toProposed.ok ? JSON.stringify(toProposed) : undefined);
  if (toProposed.ok) assert.equal(toProposed.knowledgeItem.authority_badge, "knowledge_propose");

  // §11 Validation / §14 "validation history" — aggregates, never overwrites
  // (owner: "no forced gate" — addable at any point, not tied to one hop).
  await addKnowledgeValidationNote({ knowledgeItemId: knowledgeItem.id, noteText: "First pass: terminology confirmed against domain glossary." });
  await addKnowledgeValidationNote({ knowledgeItemId: knowledgeItem.id, noteText: "Second pass: cross-checked against Requirements Analysis Model." });
  const notes = await listKnowledgeValidationNotes(knowledgeItem.id);
  assert.deepEqual(
    notes.map((n) => n.note_text),
    ["First pass: terminology confirmed against domain glossary.", "Second pass: cross-checked against Requirements Analysis Model."]
  );
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

  // Two relationships so far — from creation: the explicit Deliverable plus
  // the implicit SEU membership row evidenceDB.create always adds (Ch.17
  // model cleanup, migration 232).
  const relationshipsBefore = await listEvidenceRelationships(evidence.id);
  assert.equal(relationshipsBefore.length, 2);
  assert.ok(relationshipsBefore.some((r) => r.related_object_type === "Deliverable" && r.related_object_id === deliverableA));
  assert.ok(relationshipsBefore.some((r) => r.related_object_type === "SEU" && r.related_object_id === seuA));

  // Link to a SECOND Deliverable belonging to a DIFFERENT SEU entirely.
  const linked = await linkEvidenceToObject(evidence.id, "Deliverable", deliverableB);
  assert.equal(linked.ok, true, !linked.ok ? linked.detail : undefined);

  const relationshipsAfter = await listEvidenceRelationships(evidence.id);
  assert.equal(relationshipsAfter.length, 3, "one Evidence Item now supports two artefacts, plus its own SEU membership row");

  // findByRelatedObject finds the SAME Evidence row via EITHER relationship.
  const { data: foundViaA } = await evidenceDB.findByRelatedObject("Deliverable", deliverableA);
  assert.ok((foundViaA ?? []).some((e) => e.id === evidence.id));
  const { data: foundViaB } = await evidenceDB.findByRelatedObject("Deliverable", deliverableB);
  assert.ok((foundViaB ?? []).some((e) => e.id === evidence.id), "cross-SEU: found via a Deliverable belonging to a different SEU than the Evidence's own origin");

  // Re-linking the same relationship is a no-op, not an error.
  const relinked = await linkEvidenceToObject(evidence.id, "Deliverable", deliverableB);
  assert.equal(relinked.ok, true);
  const relationshipsAfterRelink = await listEvidenceRelationships(evidence.id);
  assert.equal(relationshipsAfterRelink.length, 3, "re-linking the same object is idempotent");

  // Linking a non-existent Deliverable is rejected.
  const invalid = await linkEvidenceToObject(evidence.id, "Deliverable", randomUUID());
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.reason, "invalid");

  // Linking against a non-existent Evidence row is rejected.
  const notFound = await linkEvidenceToObject(randomUUID(), "Deliverable", deliverableA);
  assert.equal(notFound.ok, false);
  if (!notFound.ok) assert.equal(notFound.reason, "not_found");
});

// Ch.17 model cleanup (migration 232, this session) retired the bespoke
// originating_participant_id/originating_capability_id/originating_decision_id/
// originating_activity columns outright — "Evidence does not need anything.
// Evidence is required by others." Every relationship (including what these
// used to be) is now just another evidence_relationships row, added via
// linkEvidenceToObject, surfaced through SeuDetailEvidence.relationships/
// relatedObjectLabels instead of a bespoke provenance sub-object. Rewritten
// from the old originating_*-column version to match.
test("Evidence preserves its full provenance as evidence_relationships rows — Deliverable, Participant, Capability and Decision all resolve to real labels", async () => {
  const seuId = await commissionTestSeu("phase5-evidence-provenance");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);

  const { participant } = await fulfilCapability({
    seuId, capabilityId: reqAnalysisCapability.capabilityId, participantMasterId: await ensureEligibleParticipant(seuId, ["requirements-analysis"]),
  });

  const decision = await createDecision({
    seuId, relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [requirementsSpec.id] }],
    category: "Engineering Decisions", title: "Phase5 provenance test decision",
  });

  const evidence = await createEvidence({
    seuId, relatedObjectType: "Deliverable", relatedObjectId: requirementsSpec.id,
    category: "Validation Evidence", title: "Provenance-tagged evidence",
  });

  const linkedParticipant = await linkEvidenceToObject(evidence.id, "Participant", participant.id);
  assert.equal(linkedParticipant.ok, true);
  const linkedCapability = await linkEvidenceToObject(evidence.id, "Capability", reqAnalysisCapability.capabilityId);
  assert.equal(linkedCapability.ok, true);
  const linkedDecision = await linkEvidenceToObject(evidence.id, "Decision", decision.id);
  assert.equal(linkedDecision.ok, true);

  const relationships = await listEvidenceRelationships(evidence.id);
  const relatedTypes = relationships.map((r) => r.related_object_type);
  assert.ok(relatedTypes.includes("SEU"), "every Evidence carries its SEU membership relationship");
  assert.ok(relatedTypes.includes("Deliverable"));
  assert.ok(relatedTypes.includes("Participant"));
  assert.ok(relatedTypes.includes("Capability"));
  assert.ok(relatedTypes.includes("Decision"));
  assert.ok(relationships.some((r) => r.related_object_type === "Decision" && r.related_object_id === decision.id));

  const refreshed = await getSeuDetailView(seuId);
  const evidenceView = refreshed?.evidence.find((e) => e.evidence.id === evidence.id);
  assert.ok(evidenceView);
  assert.ok(evidenceView.relatedObjectLabels.some((l) => l === "Requirements Analysis Model"));
  assert.ok(evidenceView.relatedObjectLabels.some((l) => l === `${participant.display_name} (${participant.type})`));
  assert.ok(evidenceView.relatedObjectLabels.some((l) => l.includes("requirements-analysis")));

  // A relationship is entirely optional — Evidence created with only its
  // required Deliverable relationship has no Participant/Capability/Decision
  // relationships at all, not an error.
  const bareEvidence = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: requirementsSpec.id, category: "Validation Evidence", title: "No extra relationships supplied" });
  const bareRelationships = await listEvidenceRelationships(bareEvidence.id);
  assert.deepEqual(new Set(bareRelationships.map((r) => r.related_object_type)), new Set(["SEU", "Deliverable"]));
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

  // V1's own relationships are completely unchanged — still its own SEU1
  // membership row plus both SEU1's and SEU2's Deliverables.
  const v1Relationships = await listEvidenceRelationships(v1.id);
  assert.equal(v1Relationships.length, 3, "V2's existence must not add, remove, or alter any of V1's own relationships");
  assert.ok(v1Relationships.some((r) => r.related_object_type === "SEU" && r.related_object_id === seu1));
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
