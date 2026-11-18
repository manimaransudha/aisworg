import { reviewsDB } from "../dblayer/reviewsDB.js";
import { QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_REVIEW } from "../dblayer/constants.js";
import type { QualityGateCriterionInput, QualityGateCriterionResult } from "./index.js";

const QUALIFYING_REVIEW_OUTCOMES = new Set(["Passed", "Passed with Recommendations"]);

// The entity has an Accepted Review with a passing outcome against the gate's Review Gate.
export async function requiresAcceptedReview(input: QualityGateCriterionInput): Promise<QualityGateCriterionResult> {
  const reviewGateId = (input.gate.criteria as { reviewGateId?: string }).reviewGateId;
  if (!reviewGateId) return { satisfied: false, reason: `${QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_REVIEW} criteria has no reviewGateId configured`, detail: {} };
  const { data: reviews } = await reviewsDB.findByRelatedObject(input.entityType, input.entityId);
  const qualifying = (reviews ?? []).filter(
    (r) => r.status === "Accepted" && r.outcome != null && QUALIFYING_REVIEW_OUTCOMES.has(r.outcome) && r.review_gate_id === reviewGateId
  );
  if (qualifying.length === 0) return { satisfied: false, reason: "no Accepted, passing Review found for this entity against the required Review Gate", detail: { reviewGateId } };
  return { satisfied: true, detail: { reviewGateId, reviewIds: qualifying.map((r) => r.id) } };
}
