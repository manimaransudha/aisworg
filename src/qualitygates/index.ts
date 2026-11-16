import {
  QUALITY_GATE_CRITERIA_NO_UNRESOLVED_OBLIGATIONS, QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_EVIDENCE_OR_APPROVED_DECISION,
  QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_REVIEW, QUALITY_GATE_CRITERIA_REQUIRES_ACTIVE_POLICY,
} from "../dblayer/constants.js";
import type { EvaluatedQualityGate, TransitionEntityType } from "../dblayer/seuTypes.js";
import { noUnresolvedObligations } from "./noUnresolvedObligations.js";
import { requiresAcceptedEvidenceOrApprovedDecision } from "./requiresAcceptedEvidenceOrApprovedDecision.js";
import { requiresAcceptedReview } from "./requiresAcceptedReview.js";
import { requiresActivePolicy } from "./requiresActivePolicy.js";

export interface QualityGateCriterionInput {
  gate: EvaluatedQualityGate;
  entityType: TransitionEntityType;
  entityId: string;
  seuId: string | null;
  context: Record<string, unknown>;
}

// A criterion reports whether the entity satisfies the gate. It changes nothing. The engine records the outcome, looks for a waiver and publishes the event (CR-145).
export type QualityGateCriterionResult =
  | { satisfied: true }
  | { satisfied: false; reason: string; detail: Record<string, unknown> };

export type QualityGateCriterion = (input: QualityGateCriterionInput) => Promise<QualityGateCriterionResult>;

// The criterion that decides a gate is registered here under the code of its criteria type (Ontology concept quality-gate-criteria-type).
const QUALITY_GATE_CRITERIA: Record<string, QualityGateCriterion> = {
  [QUALITY_GATE_CRITERIA_NO_UNRESOLVED_OBLIGATIONS]: noUnresolvedObligations,
  [QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_EVIDENCE_OR_APPROVED_DECISION]: requiresAcceptedEvidenceOrApprovedDecision,
  [QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_REVIEW]: requiresAcceptedReview,
  [QUALITY_GATE_CRITERIA_REQUIRES_ACTIVE_POLICY]: requiresActivePolicy,
};

// The implementation of a criteria type, or null when none is registered for it.
export function findQualityGateCriterion(criteriaType: string | undefined): QualityGateCriterion | null {
  return (criteriaType && QUALITY_GATE_CRITERIA[criteriaType]) || null;
}
