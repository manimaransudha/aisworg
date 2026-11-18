import { obligationsDB } from "../dblayer/obligationsDB.js";
import {
  RESOLVED_OBLIGATION_STATUSES, WAIVER_CONFIDENCE_TIER_EXPIRY, WAIVER_CONFIDENCE_TIER_EXPIRY_RECORDS, WAIVER_CONFIDENCE_TIER_OBLIGATION, WAIVER_CONFIDENCE_TIER_OBLIGATION_RECORDS,
} from "../dblayer/constants.js";
import type { QualityGateCriterionInput, QualityGateCriterionResult, WaiverConfidenceBasis } from "./index.js";

// The entity has no Obligation that is still open.
export async function noUnresolvedObligations(input: QualityGateCriterionInput): Promise<QualityGateCriterionResult> {
  const { data: obligations, error } = await obligationsDB.findByRelatedObject(input.entityType, input.entityId);
  if (error) throw error;
  const unresolved = (obligations ?? []).filter((o) => !RESOLVED_OBLIGATION_STATUSES.has(o.status));
  if (unresolved.length === 0) return { satisfied: true, detail: { resolvedObligationIds: (obligations ?? []).map((o) => o.id) } };
  return {
    satisfied: false,
    reason: `${unresolved.length} unresolved Obligation(s) (${unresolved.map((o) => o.title).join(", ")})`,
    detail: { unresolvedObligationIds: unresolved.map((o) => o.id) },
  };
}

// The confidence of a waiver of this gate. The tier comes from what backs the waiver: an expiry only, or a risk with an Obligation control, each with or without
// supporting records. Supporting records lift the tier and scale it by the lowest confidence among them, so a tier 2 waiver backed by 10% Evidence is 5%.
export function noUnresolvedObligationsWaiverConfidence(basis: WaiverConfidenceBasis): number {
  const supported = basis.supportingRecordConfidences.length > 0;
  const tier = basis.hasObligationControl
    ? (supported ? WAIVER_CONFIDENCE_TIER_OBLIGATION_RECORDS : WAIVER_CONFIDENCE_TIER_OBLIGATION)
    : (supported ? WAIVER_CONFIDENCE_TIER_EXPIRY_RECORDS : WAIVER_CONFIDENCE_TIER_EXPIRY);
  return supported ? (tier * Math.min(...basis.supportingRecordConfidences)) / 100 : tier;
}
