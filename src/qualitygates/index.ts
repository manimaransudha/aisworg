import {
  QUALITY_GATE_CRITERIA_NO_UNRESOLVED_OBLIGATIONS, QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_EVIDENCE_OR_APPROVED_DECISION,
  QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_REVIEW, QUALITY_GATE_CRITERIA_REQUIRES_ACTIVE_POLICY,
} from "../dblayer/constants.js";
import type { EvaluatedQualityGate, TransitionEntityType } from "../dblayer/seuTypes.js";
import { noUnresolvedObligations, noUnresolvedObligationsWaiverConfidence } from "./noUnresolvedObligations.js";
import { requiresAcceptedEvidenceOrApprovedDecision } from "./requiresAcceptedEvidenceOrApprovedDecision.js";
import { requiresAcceptedReview } from "./requiresAcceptedReview.js";
import { requiresActivePolicy } from "./requiresActivePolicy.js";

export interface QualityGateCriterionInput {
  gate: EvaluatedQualityGate;
  entityType: TransitionEntityType;
  entityId: string;
  seuId: string | null;
  // The hop the entity is making and the author of the evaluation. Policy evaluation, which the policy criterion calls, stores and publishes under them.
  fromState: string;
  toState: string;
  authorId: string;
  authorBadge: string;
}

// A criterion reports whether the entity satisfies the gate, with the objects it relied on in `detail`. It changes nothing. The engine records the outcome, looks for a waiver and publishes the event (CR-145).
export type QualityGateCriterionResult =
  | { satisfied: true; detail: Record<string, unknown> }
  | { satisfied: false; reason: string; detail: Record<string, unknown> };

// What a criterion knows of a waiver of its gate when it rates the waiver: whether a risk of the waiver has an Obligation control, and the confidence (0 to 100)
// of each supporting Evidence, Knowledge or Decision record. A record with no confidence level counts at a default percentage.
export interface WaiverConfidenceBasis {
  hasObligationControl: boolean;
  supportingRecordConfidences: number[];
}

// The confidence (0 to 100) of a waiver of the gate, by the rules of the criterion.
export type QualityGateWaiverConfidence = (basis: WaiverConfidenceBasis) => number;

export type QualityGateCriterion = (input: QualityGateCriterionInput) => Promise<QualityGateCriterionResult>;

// The criterion that decides a gate is registered here under the code of its criteria type (Ontology concept quality-gate-criteria-type).
const QUALITY_GATE_CRITERIA: Record<string, QualityGateCriterion> = {
  [QUALITY_GATE_CRITERIA_NO_UNRESOLVED_OBLIGATIONS]: noUnresolvedObligations,
  [QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_EVIDENCE_OR_APPROVED_DECISION]: requiresAcceptedEvidenceOrApprovedDecision,
  [QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_REVIEW]: requiresAcceptedReview,
  [QUALITY_GATE_CRITERIA_REQUIRES_ACTIVE_POLICY]: requiresActivePolicy,
};

// The rules that rate a waiver of a gate, registered under the code of its criteria type. A criteria type with no entry has no rule yet.
const QUALITY_GATE_WAIVER_CONFIDENCE: Record<string, QualityGateWaiverConfidence> = {
  [QUALITY_GATE_CRITERIA_NO_UNRESOLVED_OBLIGATIONS]: noUnresolvedObligationsWaiverConfidence,
};

export function findQualityGateWaiverConfidence(criteriaType: string | undefined): QualityGateWaiverConfidence | null {
  return (criteriaType && QUALITY_GATE_WAIVER_CONFIDENCE[criteriaType]) || null;
}

// The implementation of a criteria type, or null when none is registered for it.
export function findQualityGateCriterion(criteriaType: string | undefined): QualityGateCriterion | null {
  return (criteriaType && QUALITY_GATE_CRITERIA[criteriaType]) || null;
}
