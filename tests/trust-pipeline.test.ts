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
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { createEvidence, transitionEvidence } from "../src/routes/seu/core/evidence.js";
import { createKnowledgeItem, transitionKnowledgeItem } from "../src/routes/seu/core/knowledge.js";
import { createDecision, transitionDecision } from "../src/routes/seu/core/decisions.js";

after(async () => {
  await pool.end();
});

async function commissionTestSeu(statementPrefix: string) {
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super",
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

  const toValidated = await transitionEvidence({ evidenceId: evidence.id, targetState: "Validated", actorRole: "super" });
  assert.equal(toValidated.ok, true);
  const toAccepted = await transitionEvidence({ evidenceId: evidence.id, targetState: "Accepted", actorRole: "super" });
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
    const step = await transitionDecision({ decisionId: decision.id, targetState, actorRole: "super" });
    assert.equal(step.ok, true, !step.ok ? `Decision transition to ${targetState} failed: ${JSON.stringify(step)}` : undefined);
  }

  const unblocked = await transitionDeliverable({ deliverableId, targetState: "Baselined", actorRole: "super", actorId: "1" });
  assert.equal(unblocked.ok, true, !unblocked.ok ? JSON.stringify(unblocked) : undefined);
});

test("Evidence, Knowledge and Decision each run their own governed lifecycle and reject an undefined transition", async () => {
  const { seuId, deliverableId } = await commissionAndApproveRequirementsSpec("phase5-lifecycles");

  const evidence = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Analytical Evidence", title: "Phase5 lifecycle test evidence" });
  const evidenceInvalid = await transitionEvidence({ evidenceId: evidence.id, targetState: "Referenced", actorRole: "super" });
  assert.equal(evidenceInvalid.ok, false);
  if (!evidenceInvalid.ok) assert.equal(evidenceInvalid.reason, "no_transition_definition");

  const knowledgeItem = await createKnowledgeItem({ seuId, deliverableId, category: "Technical Knowledge", title: "Phase5 lifecycle test knowledge" });
  const knowledgeInvalid = await transitionKnowledgeItem({ knowledgeItemId: knowledgeItem.id, targetState: "Published", actorRole: "super" });
  assert.equal(knowledgeInvalid.ok, false);
  if (!knowledgeInvalid.ok) assert.equal(knowledgeInvalid.reason, "no_transition_definition");

  const decision = await createDecision({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Design Decisions", title: "Phase5 lifecycle test decision" });
  const decisionInvalid = await transitionDecision({ decisionId: decision.id, targetState: "Approved", actorRole: "super" });
  assert.equal(decisionInvalid.ok, false);
  if (!decisionInvalid.ok) assert.equal(decisionInvalid.reason, "no_transition_definition");
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
