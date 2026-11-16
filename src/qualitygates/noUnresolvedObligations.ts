import { obligationsDB } from "../dblayer/obligationsDB.js";
import { RESOLVED_OBLIGATION_STATUSES } from "../dblayer/constants.js";
import type { QualityGateCriterionInput, QualityGateCriterionResult } from "./index.js";

// The entity has no Obligation that is still open.
export async function noUnresolvedObligations(input: QualityGateCriterionInput): Promise<QualityGateCriterionResult> {
  const { data: obligations } = await obligationsDB.findByRelatedObject(input.entityType, input.entityId);
  const unresolved = (obligations ?? []).filter((o) => !RESOLVED_OBLIGATION_STATUSES.has(o.status));
  if (unresolved.length === 0) return { satisfied: true };
  return {
    satisfied: false,
    reason: `${unresolved.length} unresolved Obligation(s) (${unresolved.map((o) => o.title).join(", ")})`,
    detail: { unresolvedObligationIds: unresolved.map((o) => o.id) },
  };
}
