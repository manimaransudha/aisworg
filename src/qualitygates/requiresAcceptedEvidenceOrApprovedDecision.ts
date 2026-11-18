import { evidenceDB } from "../dblayer/evidenceDB.js";
import { decisionsDB } from "../dblayer/decisionsDB.js";
import { QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_EVIDENCE_OR_APPROVED_DECISION } from "../dblayer/constants.js";
import type { QualityGateCriterionInput, QualityGateCriterionResult } from "./index.js";

const QUALIFYING_EVIDENCE_STATUSES = new Set(["Accepted", "Referenced"]);
const QUALIFYING_DECISION_STATUSES = new Set(["Approved", "Applied"]);

// The entity has Accepted Evidence of the gate's evidence category, or an approved Decision.
export async function requiresAcceptedEvidenceOrApprovedDecision(input: QualityGateCriterionInput): Promise<QualityGateCriterionResult> {
  const requiredCategory = (input.gate.criteria as { evidenceCategory?: string }).evidenceCategory;
  if (!requiredCategory) {
    return { satisfied: false, reason: `${QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_EVIDENCE_OR_APPROVED_DECISION} criteria has no evidenceCategory configured`, detail: {} };
  }
  const [{ data: evidence }, { data: decisions }] = await Promise.all([
    evidenceDB.findByRelatedObject(input.entityType, input.entityId),
    decisionsDB.findByRelatedObject(input.entityType, input.entityId),
  ]);
  const qualifyingEvidence = (evidence ?? []).filter((e) => QUALIFYING_EVIDENCE_STATUSES.has(e.status) && e.category === requiredCategory);
  const qualifyingDecisions = (decisions ?? []).filter((d) => QUALIFYING_DECISION_STATUSES.has(d.status));
  if (qualifyingEvidence.length === 0 && qualifyingDecisions.length === 0) {
    return { satisfied: false, reason: `no accepted Evidence of category "${requiredCategory}" or approved Decision found for this entity`, detail: { requiredCategory } };
  }
  return { satisfied: true, detail: { evidenceIds: qualifyingEvidence.map((e) => e.id), decisionIds: qualifyingDecisions.map((d) => d.id) } };
}
