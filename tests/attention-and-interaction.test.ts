// Post-MVP Phase 8 (Attention Management: Ch.34, External Interaction: Ch.36)
// — automated coverage for what the Phase 8 audit checked by hand: a Quality
// Gate block raises exactly one deduplicated Attention Item (AM-002), a
// sustained blocking pattern raises a second, Escalation-category Attention
// Item alongside the Organisational Learning Obligation (Ch.35 §11), an
// External Interaction can be created and walked through its lifecycle, and
// a transition to "Failed" automatically raises an Exception-category
// Attention Item (Ch.36 §13 -> Ch.34 cross-chapter link). Run against the
// real dev database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverableSync as transitionDeliverable } from "./testFixtures.js";
import { createObligation, transitionObligation } from "../src/routes/seu/core/obligations.js";
import { createAttentionItem, listAttentionItemsBySeu, transitionAttentionItem } from "../src/routes/seu/core/attentionItems.js";
import { createExternalInteraction, listExternalInteractionsBySeu, transitionExternalInteraction } from "../src/routes/seu/core/externalInteractions.js";
import { ensureWebAppTemplateFixture, ensureCoreEngineeringQualityGates, commissionFromFormSync, ensureEligibleParticipant, resolveDispatchRejectionObligations } from "./testFixtures.js";

async function commissionAndFulfilRequirementsSpec(statementPrefix: string) {
  await ensureWebAppTemplateFixture();
  await ensureCoreEngineeringQualityGates();
  const result = await commissionFromFormSync(
    {
      statement: `${statementPrefix}-${randomUUID()}`,
      requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
      actorRole: "super", actorId: "1001", requestedBy: 1001,
    },
    // Fulfil before the Execution Engine's own automatic commence-work
    // attempt (executionEngineKickoff, off SEUActivated) reaches Dispatch —
    // otherwise it races an unfulfilled Capability into a real, spurious
    // empty_eligible_pool Obligation that pollutes this test's own Obligation
    // count (see driveCommissioningToActive's own beforeCommenceWork comment).
    async (seuId) => {
      const detail = await getSeuDetailView(seuId);
      const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
      assert.ok(reqAnalysisCapability);
      const participantMasterId = await ensureEligibleParticipant(seuId, ["requirements-analysis"]);
      await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, participantMasterId });
    }
  );
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const seuId = result.seu.id;

  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec);
  // The automatic commence-work rescan (off SEUOperational) already hit this
  // Deliverable's own then-unfulfilled Capability — a real, by-design
  // empty_eligible_pool Obligation/Attention Item, not this test's own AM-002
  // scenario (which cares about exactly one Attention Item: its own).
  await resolveDispatchRejectionObligations(seuId);
  return { seuId, deliverableId: requirementsSpec.id };
}

test("a Quality Gate block raises exactly one 'Action Required' Attention Item, deduplicated across repeated attempts (AM-002)", async () => {
  const { seuId, deliverableId } = await commissionAndFulfilRequirementsSpec("phase8-attention-dedup");

  // tests/web-flow.e2e.test.ts's own commissionIsolatedPhase8Seu comment:
  // the Obligation must exist BEFORE the Deliverable ever reaches "In
  // Progress", not right after — deliverableKickoffHandler's rescan off the
  // DeliverableTransitioned that "In Progress" publishes is fire-and-forget
  // (eventBus.publish never awaits dispatch), so it can run its own
  // governance read at any point afterward, independent of this test's own
  // synchronous timeline, and race a still-unblocked pass in ahead of this
  // test's own createObligation call. Creating it first means every attempt
  // at that hop, automatic or manual, whichever gets there first, finds the
  // same Obligation already in place.
  const obligation = await createObligation({ relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Engineering", title: "Phase8 attention-dedup blocker (left unresolved)" });
  await transitionDeliverable({ deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });

  for (let i = 0; i < 3; i++) {
    const attempt = await transitionDeliverable({ deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
    assert.equal(attempt.ok, false);
  }

  const items = await listAttentionItemsBySeu(seuId);
  const actionRequired = items.filter((a) => a.category === "Action Required" && a.related_object_type === "Deliverable" && a.related_object_id === deliverableId && a.status !== "Closed" && a.status !== "Resolved");
  assert.equal(actionRequired.length, 1, "repeated blocked attempts against the same situation must not flood the inbox");
  assert.match(actionRequired[0]!.title, /blocked by Quality Gate/);

  void obligation;
});

test("a sustained pattern of Quality Gate blocking raises a High-priority 'Escalation' Attention Item alongside the Organisational Learning Obligation", async () => {
  const { seuId, deliverableId } = await commissionAndFulfilRequirementsSpec("phase8-attention-escalation");

  // Same ordering fix as the AM-002 dedup test above — Obligation before
  // "In Progress", not after (see that test's own comment for why).
  await createObligation({ relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Engineering", title: "Phase8 escalation blocker (left unresolved)" });
  await transitionDeliverable({ deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });

  // Threshold is 3 (SUSTAINED_BLOCK_THRESHOLD) — cross it.
  for (let i = 0; i < 4; i++) {
    const attempt = await transitionDeliverable({ deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
    assert.equal(attempt.ok, false);
  }

  const items = await listAttentionItemsBySeu(seuId);
  const escalations = items.filter((a) => a.category === "Escalation");
  assert.equal(escalations.length, 1, "exactly one Escalation Attention Item, regardless of how many attempts crossed the threshold");
  assert.equal(escalations[0]!.priority, "High");
  assert.equal(escalations[0]!.related_object_type, "Obligation");
  assert.match(escalations[0]!.title, /Sustained pattern/);
});

test("an Attention Item can be created directly and walked through its Ch.34 §9 lifecycle", async () => {
  const { seuId } = await commissionAndFulfilRequirementsSpec("phase8-attention-lifecycle");

  const attentionItem = await createAttentionItem({ seuId, category: "Action Required", title: "Phase8 direct-create test item" });
  assert.equal(attentionItem.status, "Created");

  for (const targetState of ["Delivered", "Acknowledged", "In Progress", "Resolved", "Closed"]) {
    const step = await transitionAttentionItem({ attentionItemId: attentionItem.id, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(step.ok, true, !step.ok ? JSON.stringify(step) : undefined);
  }
});

test("an External Interaction can be recorded against a Deliverable and walked through its Ch.36 §9 lifecycle", async () => {
  const { seuId, deliverableId } = await commissionAndFulfilRequirementsSpec("phase8-interaction-lifecycle");

  const interaction = await createExternalInteraction({
    seuId,
    deliverableId,
    interactionType: "Status Update",
    direction: "Outbound",
    targetSystem: "Customer Email",
    purpose: "Phase8 test interaction",
  });
  assert.equal(interaction.status, "Created");
  assert.equal(interaction.deliverable_id, deliverableId);

  const bySeu = await listExternalInteractionsBySeu(seuId);
  assert.ok(bySeu.some((i) => i.id === interaction.id));

  for (const targetState of ["Validated", "Dispatched", "Acknowledged", "Completed", "Archived"]) {
    const step = await transitionExternalInteraction({ interactionId: interaction.id, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(step.ok, true, !step.ok ? JSON.stringify(step) : undefined);
  }
});

test("transitioning an External Interaction to Failed automatically raises an Exception-category Attention Item (Ch.36 §13)", async () => {
  const { seuId } = await commissionAndFulfilRequirementsSpec("phase8-interaction-failure");

  const interaction = await createExternalInteraction({
    seuId,
    interactionType: "API Call",
    direction: "Outbound",
    targetSystem: "External Ticketing System",
  });

  const toValidated = await transitionExternalInteraction({ interactionId: interaction.id, targetState: "Validated", actorRole: "super", actorId: "1001" });
  assert.equal(toValidated.ok, true, !toValidated.ok ? JSON.stringify(toValidated) : undefined);

  const toDispatched = await transitionExternalInteraction({ interactionId: interaction.id, targetState: "Dispatched", actorRole: "super", actorId: "1001" });
  assert.equal(toDispatched.ok, true, !toDispatched.ok ? JSON.stringify(toDispatched) : undefined);

  const toFailed = await transitionExternalInteraction({ interactionId: interaction.id, targetState: "Failed", actorRole: "super", actorId: "1001" });
  assert.equal(toFailed.ok, true, !toFailed.ok ? JSON.stringify(toFailed) : undefined);

  const items = await listAttentionItemsBySeu(seuId);
  const exceptions = items.filter((a) => a.category === "Exception" && a.related_object_type === "ExternalInteraction" && a.related_object_id === interaction.id);
  assert.equal(exceptions.length, 1);
  assert.equal(exceptions[0]!.priority, "High");
  assert.match(exceptions[0]!.title, /failed/);
});

test("rejects an External Interaction created against a Deliverable that does not belong to the given SEU", async () => {
  const { deliverableId } = await commissionAndFulfilRequirementsSpec("phase8-interaction-wrong-seu-a");
  const { seuId: otherSeuId } = await commissionAndFulfilRequirementsSpec("phase8-interaction-wrong-seu-b");

  await assert.rejects(
    () => createExternalInteraction({ seuId: otherSeuId, deliverableId, interactionType: "Status Update", direction: "Outbound", targetSystem: "Test" }),
    /does not belong to SEU/
  );
});
