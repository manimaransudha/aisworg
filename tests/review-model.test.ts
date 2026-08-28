// Review Model — Plan (Phase 14, Ch.25). A Review is a governed evaluation that
// (1) never modifies the reviewed object (RM-001), (2) produces an immutable
// outcome at Completion (FR-25.5), and (3) is consumed by Governance via a
// Quality Gate (§11). The gate test uses an UNUSED transition triple
// (Deliverable Reviewed -> Baselined) so it exercises the gate logic without
// affecting any real Deliverable flow on the shared dev database. Run against
// the real dev database.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { createReview, transitionReview } from "../src/routes/seu/core/reviews.js";
import { createFinding, transitionFinding, convertFindingToObligation } from "../src/routes/seu/core/findings.js";
import { explainDeliverable } from "../src/routes/seu/core/traceability.js";
import { reviewsDB } from "../src/dblayer/reviewsDB.js";
import { findingsDB } from "../src/dblayer/findingsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { reviewGatesDB } from "../src/dblayer/reviewGatesDB.js";
import { qualityGateEngine } from "../src/domain/engine/qualityGateEngine.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function commissionSeu(prefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${prefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super", actorId: "1001",
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const detail = await getSeuDetailView(result.seu.id);
  const deliverable = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  assert.ok(deliverable);
  return { seuId: result.seu.id, deliverable };
}

// Walk a Review Planned -> Prepared -> In Progress -> Completed(outcome) -> Accepted.
async function walkReviewToAccepted(reviewId: string, outcome: "Passed" | "Passed with Recommendations" | "Rework Required" | "Failed" | "Deferred" | "Not Applicable") {
  await transitionReview({ reviewId, targetState: "Prepared", actorRole: "super", actorId: "1001" });
  await transitionReview({ reviewId, targetState: "In Progress", actorRole: "super", actorId: "1001" });
  const completed = await transitionReview({ reviewId, targetState: "Completed", actorRole: "super", actorId: "1001", outcome });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : undefined);
  await transitionReview({ reviewId, targetState: "Accepted", actorRole: "super", actorId: "1001" });
}

test("a Review runs its full lifecycle without modifying the reviewed object; its outcome is set at Completion and is immutable", async () => {
  const { seuId, deliverable } = await commissionSeu("review-lifecycle");

  const review = await createReview({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Architecture", name: "Architecture Review of Requirements Specification" });
  assert.equal(review.status, "Planned");
  assert.equal(review.outcome, null, "a fresh Review has no outcome");

  // Completing without an outcome is refused.
  await transitionReview({ reviewId: review.id, targetState: "Prepared", actorRole: "super", actorId: "1001" });
  await transitionReview({ reviewId: review.id, targetState: "In Progress", actorRole: "super", actorId: "1001" });
  const noOutcome = await transitionReview({ reviewId: review.id, targetState: "Completed", actorRole: "super", actorId: "1001" });
  assert.equal(noOutcome.ok, false);
  if (!noOutcome.ok) assert.equal(noOutcome.reason, "outcome_required");

  // Completing with an outcome sets it.
  const completed = await transitionReview({ reviewId: review.id, targetState: "Completed", actorRole: "super", actorId: "1001", outcome: "Passed with Recommendations" });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : undefined);
  if (completed.ok) assert.equal(completed.review.outcome, "Passed with Recommendations");

  // The reviewed Deliverable is untouched by the Review (RM-001).
  const detail = await getSeuDetailView(seuId);
  assert.equal(detail?.deliverables.find((d) => d.id === deliverable.id)?.lifecycleState, "Defined", "a Review must never modify the reviewed object");

  // Outcome survives further lifecycle transitions unchanged (immutable).
  await transitionReview({ reviewId: review.id, targetState: "Accepted", actorRole: "super", actorId: "1001" });
  await transitionReview({ reviewId: review.id, targetState: "Archived", actorRole: "super", actorId: "1001" });
  const { data: finalRow } = await reviewsDB.findById(review.id);
  assert.equal(finalRow?.outcome, "Passed with Recommendations", "the outcome is immutable across later transitions");
  assert.equal(finalRow?.status, "Archived");
});

test("requires_accepted_review Quality Gate blocks a transition until an Accepted, passing Review against the required Review Gate exists (CR-059)", async () => {
  const { seuId, deliverable } = await commissionSeu("review-gate");

  // A gate on a fully run-scoped triple, not just a run-scoped category —
  // qualityGateEngine.evaluate() ANDs across EVERY active gate at a given
  // (entityType, fromState, toState), regardless of category, so sharing
  // the "unused" Deliverable Reviewed -> Baselined triple with any other
  // test that also creates a gate there (transition-definition-authoring.test.ts
  // does) can block this test on a completely unrelated gate's own criteria.
  // Real, observed failure — a category-only fix (CR-058's own precedent)
  // was not enough here.
  const { data: corePack } = await packsDB.findByCode("development");
  assert.ok(corePack, "core pack must be seeded");
  const run = randomUUID();
  const fromState = `test-from-${run}`;
  const toState = `test-to-${run}`;
  const { data: reviewGate } = await reviewGatesDB.upsert({
    code: `Solution / Architecture Document (test-${run})`,
    name: "Architecture Notebook Review",
    entityType: "Deliverable",
    fromState,
    toState,
    originatingPackId: corePack!.id,
  });
  assert.ok(reviewGate);
  await qualityGatesDB.upsert({
    name: "Requires Architecture Review",
    category: `test-${run}`,
    entityType: "Deliverable",
    fromState,
    toState,
    criteria: { type: "requires_accepted_review", reviewGateId: reviewGate!.id },
    originatingPackId: corePack!.id,
  });
  const evalGate = () => qualityGateEngine.evaluate({ entityType: "Deliverable", entityId: deliverable.id, seuId, fromState, toState });

  assert.equal((await evalGate()).outcome, "Blocked", "no Review yet -> blocked");

  // A Failed Architecture review does NOT satisfy it.
  const failed = await createReview({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Architecture", name: "Arch review (fails)", reviewGateId: reviewGate!.id });
  await walkReviewToAccepted(failed.id, "Failed");
  assert.equal((await evalGate()).outcome, "Blocked", "an Accepted but Failed Review does not satisfy the gate");

  // A passing review NOT linked to this Review Gate does NOT satisfy it — the
  // FK match (CR-059) replaces the old free-text category comparison.
  const unlinkedReview = await createReview({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Code", name: "Code review (passes, unlinked)" });
  await walkReviewToAccepted(unlinkedReview.id, "Passed");
  assert.equal((await evalGate()).outcome, "Blocked", "a passing Review not linked to the required Review Gate does not satisfy it");

  // An Accepted + passing Review linked to the required Review Gate satisfies it.
  const arch = await createReview({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Architecture", name: "Arch review (passes)", reviewGateId: reviewGate!.id });
  await walkReviewToAccepted(arch.id, "Passed");
  assert.equal((await evalGate()).outcome, "Passed", "an Accepted, passing Review linked to the required Review Gate satisfies the gate");
});

test("Findings: a High-severity Finding auto-surfaces an Attention Item; a Finding resolves and can be converted to an Obligation", async () => {
  const { seuId, deliverable } = await commissionSeu("review-findings");
  const review = await createReview({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Security", name: "Security Review" });

  // A Low-severity finding does not auto-raise Attention.
  const low = await createFinding({ reviewId: review.id, severity: "Low", title: "Minor naming nit" });
  assert.equal(low.status, "Open");
  const afterLow = (await attentionItemsDB.findBySeuId(seuId)).data ?? [];
  assert.equal(afterLow.some((a) => a.title.includes("Minor naming nit")), false, "a Low finding does not auto-surface Attention");

  // A High-severity finding auto-surfaces an Attention Item (Decision C).
  const high = await createFinding({ reviewId: review.id, severity: "High", title: "Unvalidated input on enrollment endpoint", description: "SQL injection risk" });
  const openException = await attentionItemsDB.findOpenByRelatedObject(seuId, "Action Required", "Deliverable", deliverable.id);
  assert.ok(openException, "a High finding auto-surfaces an Attention Item");

  // The finding does NOT auto-create an Obligation.
  assert.equal(high.obligation_id, null, "a Finding is not auto-converted to an Obligation");

  // Manual conversion creates and links an Obligation.
  const converted = await convertFindingToObligation({ findingId: high.id, category: "Security" });
  assert.equal(converted.ok, true, !converted.ok ? JSON.stringify(converted) : undefined);
  if (converted.ok) {
    assert.ok(converted.obligationId);
    const { data: linked } = await findingsDB.findById(high.id);
    assert.equal(linked?.obligation_id, converted.obligationId, "the Finding is linked to the Obligation it was converted into");
  }

  // Double conversion is refused.
  const again = await convertFindingToObligation({ findingId: high.id });
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.reason, "already_converted");

  // The finding can be resolved.
  const resolved = await transitionFinding({ findingId: high.id, targetState: "Resolved", actorRole: "super", actorId: "1001" });
  assert.equal(resolved.ok, true, !resolved.ok ? JSON.stringify(resolved) : undefined);
  if (resolved.ok) assert.equal(resolved.finding.status, "Resolved");
});

test("Traceability (Ch.25 §14): a Deliverable's explanation lists the Reviews that evaluated it and the Findings they produced", async () => {
  const { seuId, deliverable } = await commissionSeu("review-traceability");
  const review = await createReview({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Design", name: "Design Review" });
  await walkReviewToAccepted(review.id, "Passed with Recommendations");
  const finding = await createFinding({ reviewId: review.id, severity: "Medium", title: "Consider caching the catalogue query" });

  const explanation = await explainDeliverable(deliverable.id);
  assert.ok(explanation);
  const tracedReview = explanation!.reviews.find((r) => r.id === review.id);
  assert.ok(tracedReview, "the Review appears in the Deliverable's traceability");
  assert.equal(tracedReview!.outcome, "Passed with Recommendations");
  assert.equal(tracedReview!.status, "Accepted");
  assert.ok(explanation!.findings.some((f) => f.id === finding.id && f.reviewId === review.id), "the Finding appears, linked to its Review");
});
