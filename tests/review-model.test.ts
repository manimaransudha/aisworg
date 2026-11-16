// Review Model — Plan (Phase 14, Ch.25). A Review is a governed evaluation that
// (1) never modifies the reviewed object (RM-001), (2) produces an immutable
// outcome at Completion (FR-25.5), and (3) is consumed by Governance via a
// Quality Gate (§11). The gate test uses an UNUSED transition triple
// (Deliverable Reviewed -> Baselined) so it exercises the gate logic without
// affecting any real Deliverable flow on the shared dev database. Run against
// the real dev database.
import "dotenv/config";
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { getSystemActor } from "../src/dblayer/constants.js";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { transitionReview } from "../src/routes/seu/core/reviews.js";
import { transitionFinding, convertFindingToObligation } from "../src/routes/seu/core/findings.js";
import { explainDeliverable } from "../src/routes/seu/core/traceability.js";
import { reviewsDB } from "../src/dblayer/reviewsDB.js";
import { findingsDB } from "../src/dblayer/findingsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { commissionedSeu } from "./webScenarios.js";
import { reviewGatesDB } from "../src/dblayer/reviewGatesDB.js";
import { qualityGateEngine } from "../src/domain/engine/qualityGateEngine.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { ensureWebAppTemplateFixture, commissionFromFormSync, createReviewAsRoot, createFindingAsRoot, getEmptyPoolTenantId, emptyParticipantPool } from "./testFixtures.js";
import { getTestDevelopmentPack, ensureQualityGateDefinition } from "./testFixtures.js";
import { TESTER_ALL_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";
import { deliverableByCode } from "./testFixtures.js";

// Other files leave fixture Participants in the tenant, and commissioning would fulfil a Capability with one of them. The pool is emptied for this file and restored when it finishes.
let restorePool: (() => Promise<void>) | undefined;
before(async () => {
  restorePool = await emptyParticipantPool(await getEmptyPoolTenantId());
});
after(async () => {
  await restorePool?.();
});

async function commissionSeu(prefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromFormSync({
    statement: `${prefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorId: TESTER_ALL_ID, requestedBy: TESTER_ALL_ID,
    // The empty-pool tenant keeps the Capability unfulfilled, so the Deliverable stays in Defined and the
    // "Review never modifies the reviewed object" check is not racing the governed Defined -> In Progress hop.
    tenantId: await getEmptyPoolTenantId(),
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : "assertion failed");
  if (!result.ok) throw new Error("unreachable");
  const detail = await getSeuDetailView(result.seu.id);
  const deliverable = (await deliverableByCode(detail, "requirements-analysis-model"));
  assert.ok(deliverable);
  return { seuId: result.seu.id, deliverable };
}

// Walk a Review Planned -> Prepared -> In Progress -> Completed(outcome) -> Accepted.
async function walkReviewToAccepted(reviewId: string, outcome: "Passed" | "Passed with Recommendations" | "Rework Required" | "Failed" | "Deferred" | "Not Applicable") {
  await transitionReview({ reviewId, targetState: "Prepared", actorId: TESTER_ALL_ID });
  await transitionReview({ reviewId, targetState: "In Progress", actorId: TESTER_ALL_ID });
  const completed = await transitionReview({ reviewId, targetState: "Completed", actorId: TESTER_ALL_ID, outcome });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : "assertion failed");
  await transitionReview({ reviewId, targetState: "Accepted", actorId: TESTER_ALL_ID });
}

test("a Review runs its full lifecycle without modifying the reviewed object; its outcome is set at Completion and is immutable", async () => {
  const { seuId, deliverable } = await commissionSeu("review-lifecycle");

  const stateBeforeReview = (await getSeuDetailView(seuId))?.deliverables.find((d) => d.id === deliverable.id)?.lifecycleState;
  const review = await createReviewAsRoot({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Architecture", name: "Architecture Review of Requirements Analysis Model" });
  assert.equal(review.status, "Planned");
  assert.equal(review.outcome, null, "a fresh Review has no outcome");

  // Completing without an outcome is refused.
  await transitionReview({ reviewId: review.id, targetState: "Prepared", actorId: TESTER_ALL_ID });
  await transitionReview({ reviewId: review.id, targetState: "In Progress", actorId: TESTER_ALL_ID });
  const noOutcome = await transitionReview({ reviewId: review.id, targetState: "Completed", actorId: TESTER_ALL_ID });
  assert.equal(noOutcome.ok, false);
  if (!noOutcome.ok) assert.equal(noOutcome.reason, "outcome_required");

  // Completing with an outcome sets it.
  const completed = await transitionReview({ reviewId: review.id, targetState: "Completed", actorId: TESTER_ALL_ID, outcome: "Passed with Recommendations" });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : "assertion failed");
  if (completed.ok) assert.equal(completed.review.outcome, "Passed with Recommendations");

  // The reviewed Deliverable is untouched by the Review (RM-001).
  const detail = await getSeuDetailView(seuId);
  assert.equal(detail?.deliverables.find((d) => d.id === deliverable.id)?.lifecycleState, stateBeforeReview, "a Review must never modify the reviewed object");

  // Outcome survives further lifecycle transitions unchanged (immutable).
  await transitionReview({ reviewId: review.id, targetState: "Accepted", actorId: TESTER_ALL_ID });
  await transitionReview({ reviewId: review.id, targetState: "Archived", actorId: TESTER_ALL_ID });
  const { data: finalRow } = await reviewsDB.findById(review.id);
  assert.equal(finalRow?.outcome, "Passed with Recommendations", "the outcome is immutable across later transitions");
  assert.equal(finalRow?.status, "Archived");
});

test("requires_accepted_review Quality Gate blocks a transition until an Accepted, passing Review against the required Review Gate exists (CR-059)", async () => {
  // The Quality Gate is a Quality Gate Definition that a Pack of the SEU's Template lists, so the composition settles it into the EBM and
  // qualityGateEngine.evaluate, which reads the EBM only, finds it. A requires_accepted_review gate names its Review Gate by the code in
  // `deliverableName`, and the same name limits the gate to the Deliverable of that code, so the Review Gate carries the code of the Deliverable.
  // The Review Gate exists before the Pack is published. The hop is run-scoped, so no other gate can match it.
  const corePack = await getTestDevelopmentPack();
  assert.ok(corePack, "core pack must be seeded");
  const run = randomUUID();
  const fromState = `test-from-${run}`;
  const toState = `test-to-${run}`;
  const reviewGateCode = `rm-gate-${run}`;
  const { data: reviewGate } = await reviewGatesDB.upsert({
    code: reviewGateCode,
    name: "Architecture Notebook Review",
    entityType: "Deliverable",
    fromState,
    toState,
    originatingPackId: corePack!.id,
    authorId: corePack!.authored_by,
    authorBadge: corePack!.author_badge,
  });
  assert.ok(reviewGate);
  // The Pack validation refuses a gate on a transition that does not exist, so the hop gets a Transition Definition, removed at the end.
  const verbRows = await pool.query<{ verb: string }>("SELECT verb FROM transition_definitions WHERE entity_type = 'Deliverable' AND verb IS NOT NULL LIMIT 1");
  assert.ok(verbRows.rows[0], "a seeded Deliverable edge names a verb");
  const { error: edgeError } = await transitionDefinitionsDB.upsert({ entityType: "Deliverable", fromState, toState, verb: verbRows.rows[0].verb });
  assert.ok(!edgeError, edgeError);
  const gateEntry = await ensureQualityGateDefinition({
    code: `rm-qg-${run}`, name: "Requires Architecture Review", category: "Exit", governedTransition: `Deliverable|${fromState}|${toState}`,
    criteriaType: "requires_accepted_review", deliverableName: reviewGateCode,
  });
  const gateScenario = await commissionedSeu("review-gate", "clean", { conflictSet: "review-model", gates: [gateEntry] });
  const seuId = gateScenario.seu.id;
  const { data: created, error: deliverableError } = await deliverablesDB.create({
    seuId, name: `review-gate ${run}`, code: reviewGateCode, state: fromState, authorId: gateScenario.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(created && !deliverableError, deliverableError);
  const deliverable = created;
  const { data: gateSeu } = await seusDB.findById(seuId);
  const evalGate = async () => qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluate({ entityType: "Deliverable", entityId: deliverable.id, seuId, fromState, toState, authorId: (await getSystemActor(seuId)).authorId, authorBadge: ROOT_ACTOR_BADGE, tenantId: gateSeu!.tenant_id }));

  assert.equal((await evalGate()).outcome, "Blocked", "no Review yet -> blocked");

  // A Failed Architecture review does NOT satisfy it.
  const failed = await createReviewAsRoot({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Architecture", name: "Arch review (fails)", reviewGateId: reviewGate!.id });
  await walkReviewToAccepted(failed.id, "Failed");
  assert.equal((await evalGate()).outcome, "Blocked", "an Accepted but Failed Review does not satisfy the gate");

  // A passing review NOT linked to this Review Gate does NOT satisfy it — the
  // FK match (CR-059) replaces the old free-text category comparison.
  const unlinkedReview = await createReviewAsRoot({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Code", name: "Code review (passes, unlinked)" });
  await walkReviewToAccepted(unlinkedReview.id, "Passed");
  assert.equal((await evalGate()).outcome, "Blocked", "a passing Review not linked to the required Review Gate does not satisfy it");

  // An Accepted + passing Review linked to the required Review Gate satisfies it.
  const arch = await createReviewAsRoot({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Architecture", name: "Arch review (passes)", reviewGateId: reviewGate!.id });
  await walkReviewToAccepted(arch.id, "Passed");
  assert.equal((await evalGate()).outcome, "Approved", "an Accepted, passing Review linked to the required Review Gate satisfies the gate");
  await pool.query("DELETE FROM transition_definitions WHERE entity_type = 'Deliverable' AND from_state = $1 AND to_state = $2", [fromState, toState]);
});

test("Findings: a High-severity Finding auto-surfaces an Attention Item; a Finding resolves and can be converted to an Obligation", async () => {
  const { seuId, deliverable } = await commissionSeu("review-findings");
  const review = await createReviewAsRoot({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Security", name: "Security Review" });

  // A Low-severity finding does not auto-raise Attention.
  const low = await createFindingAsRoot({ reviewId: review.id, severity: "Low", title: "Minor naming nit" });
  assert.equal(low.status, "Open");
  const afterLow = (await attentionItemsDB.findBySeuId(seuId)).data ?? [];
  assert.equal(afterLow.some((a) => a.title.includes("Minor naming nit")), false, "a Low finding does not auto-surface Attention");

  // A High-severity finding auto-surfaces an Attention Item (Decision C).
  const high = await createFindingAsRoot({ reviewId: review.id, severity: "High", title: "Unvalidated input on enrollment endpoint", description: "SQL injection risk" });
  const openException = await attentionItemsDB.findOpenByRelatedObject(seuId, "Action Required", "Deliverable", deliverable.id);
  assert.ok(openException, "a High finding auto-surfaces an Attention Item");

  // The finding does NOT auto-create an Obligation.
  assert.equal(high.obligation_id, null, "a Finding is not auto-converted to an Obligation");

  // Manual conversion creates and links an Obligation.
  const converted = await convertFindingToObligation({ findingId: high.id, category: "Security", actorId: TESTER_ALL_ID });
  assert.equal(converted.ok, true, !converted.ok ? JSON.stringify(converted) : "assertion failed");
  if (converted.ok) {
    assert.ok(converted.obligationId);
    const { data: linked } = await findingsDB.findById(high.id);
    assert.equal(linked?.obligation_id, converted.obligationId, "the Finding is linked to the Obligation it was converted into");
  }

  // Double conversion is refused.
  const again = await convertFindingToObligation({ findingId: high.id, actorId: TESTER_ALL_ID });
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.reason, "already_converted");

  // Conversion moves the Finding to Converted (CR-133); a Converted Finding has no resolve hop.
  assert.equal((await findingsDB.findById(high.id)).data?.status, "Converted");
  const resolveConverted = await transitionFinding({ findingId: high.id, targetState: "Resolved", actorId: TESTER_ALL_ID });
  assert.equal(resolveConverted.ok, false);
  if (!resolveConverted.ok) assert.equal(resolveConverted.reason, "no_transition_definition");

  // An Open finding can be resolved.
  const resolved = await transitionFinding({ findingId: low.id, targetState: "Resolved", actorId: TESTER_ALL_ID });
  assert.equal(resolved.ok, true, !resolved.ok ? JSON.stringify(resolved) : "assertion failed");
  if (resolved.ok) assert.equal(resolved.finding.status, "Resolved");
});

test("Traceability (Ch.25 §14): a Deliverable's explanation lists the Reviews that evaluated it and the Findings they produced", async () => {
  const { seuId, deliverable } = await commissionSeu("review-traceability");
  const review = await createReviewAsRoot({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Design", name: "Design Review" });
  await walkReviewToAccepted(review.id, "Passed with Recommendations");
  const finding = await createFindingAsRoot({ reviewId: review.id, severity: "Medium", title: "Consider caching the catalogue query" });

  const explanation = await explainDeliverable(deliverable.id);
  assert.ok(explanation);
  const tracedReview = explanation!.reviews.find((r) => r.id === review.id);
  assert.ok(tracedReview, "the Review appears in the Deliverable's traceability");
  assert.equal(tracedReview!.outcome, "Passed with Recommendations");
  assert.equal(tracedReview!.status, "Accepted");
  assert.ok(explanation!.findings.some((f) => f.id === finding.id && f.reviewId === review.id), "the Finding appears, linked to its Review");
});
