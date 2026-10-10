import { evidenceDB } from "../../../dblayer/evidenceDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine } from "../../../domain/engine/qualityGateEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory } from "./ontology.js";
import { resolveAuthor } from "./attentionItems.js";
import type { EvidenceRow, EvidenceRelationshipRow, EvidenceValidationAssessment, TransitionEntityType } from "../../../dblayer/seuTypes.js";

async function assertRelatedObjectExists(relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<void> {
  if (relatedObjectType !== "Deliverable") return;
  const { data: deliverable } = await deliverablesDB.findById(relatedObjectId);
  if (!deliverable) throw new Error(`deliverable not found: ${relatedObjectId}`);
}

async function resolveAuthorIds(seuId: string, actorId: string): Promise<{ participantId: string; masterId: string }> {
  const { data: master } = await participantsMasterDB.findById(actorId);
  if (!master) throw new Error(`No superuser provisioned.`);
  const { data: participant } = await participantsDB.findBySeuIdAndParticipantMasterId(seuId, master.id);
  if (!participant) throw new Error(`actor ${actorId} has no participant engagement in SEU ${seuId}`);
  return { participantId: participant.id, masterId: master.id };
}

async function resolveAuthorMasterId(actorId: string): Promise<string> {
  const { data: master } = await participantsMasterDB.findById(actorId);
  if (!master) throw new Error(`No superuser provisioned.`);
  return master.id;
}

export async function createEvidence(input: {
  seuId: string;
  relatedObjectType: TransitionEntityType;
  relatedObjectId: string;
  category: string;
  title: string;
  description?: string | null;
  source?: string | null;
  supersedesEvidenceId?: string | null;
  actorId: string;
  authorBadge: string;
}): Promise<EvidenceRow> {
  await assertCanonicalCategory("category:evidence", input.category);
  await assertRelatedObjectExists(input.relatedObjectType, input.relatedObjectId);
  if (input.supersedesEvidenceId) {
    const { data: predecessor } = await evidenceDB.findById(input.supersedesEvidenceId);
    if (!predecessor) throw new Error(`evidence not found: ${input.supersedesEvidenceId}`);
  }

  const { participantId: authorId, masterId: authorMasterId } = await resolveAuthorIds(input.seuId, input.actorId);

  const { data: evidence, error } = await evidenceDB.create({
    seuId: input.seuId,
    relatedObjectType: input.relatedObjectType,
    relatedObjectId: input.relatedObjectId,
    category: input.category,
    title: input.title,
    description: input.description,
    source: input.source,
    supersedesEvidenceId: input.supersedesEvidenceId,
    authorId,
    authorBadge: input.authorBadge,
    authorMasterId,
  });
  if (error || !evidence) throw error ?? new Error("failed to create evidence");

  await eventBus.publish({
    eventType: "EvidenceCollected",
    originatingObjectType: "Evidence",
    originatingObjectId: evidence.id,
    seuId: input.seuId,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge: input.authorBadge,
    payload: { relatedObjectType: input.relatedObjectType, relatedObjectId: input.relatedObjectId, category: input.category },
  });

  if (input.supersedesEvidenceId) {
    await eventBus.publish({
      eventType: "EvidenceSuperseded",
      originatingObjectType: "Evidence",
      originatingObjectId: evidence.id,
      seuId: input.seuId,
      correlationId: eventBus.newCorrelationId(),
      actorId: input.actorId,
      authorityBadge: input.authorBadge,
      payload: { supersedesEvidenceId: input.supersedesEvidenceId, versionEvent: "VersionSuperseded" },
    });
  }

  return evidence;
}

export async function listEvidenceBySeu(seuId: string): Promise<EvidenceRow[]> {
  const { data } = await evidenceDB.findBySeuId(seuId);
  return data ?? [];
}

export async function listEvidenceRelationships(evidenceId: string): Promise<EvidenceRelationshipRow[]> {
  const { data } = await evidenceDB.findRelationshipsByEvidenceId(evidenceId);
  return data ?? [];
}

export async function listEvidenceLinkedToSeu(seuId: string): Promise<EvidenceRow[]> {
  const { data } = await evidenceDB.findLinkedToSeu(seuId);
  return data ?? [];
}

export async function findEvidenceSupersededBy(evidenceId: string): Promise<EvidenceRow[]> {
  const { data } = await evidenceDB.findSupersededBy(evidenceId);
  return data ?? [];
}

export type LinkEvidenceResult = { ok: true } | { ok: false; reason: "not_found" | "invalid"; detail?: string };

export async function linkEvidenceToObject(evidenceId: string, relatedObjectType: TransitionEntityType, relatedObjectId: string, actorId: string, authorBadge: string): Promise<LinkEvidenceResult> {
  const { data: evidence } = await evidenceDB.findById(evidenceId);
  if (!evidence) return { ok: false, reason: "not_found" };

  try {
    await assertRelatedObjectExists(relatedObjectType, relatedObjectId);
  } catch (err) {
    return { ok: false, reason: "invalid", detail: (err as Error).message };
  }

  const authorMasterId = await resolveAuthorMasterId(actorId);
  const { error } = await evidenceDB.addRelationship(evidenceId, relatedObjectType, relatedObjectId, authorMasterId, authorBadge);
  if (error) return { ok: false, reason: "invalid", detail: error.message };

  const { data: seuLinks } = await evidenceDB.findRelationshipsByEvidenceId(evidenceId);
  const seuId = seuLinks?.find((r) => r.related_object_type === "SEU")?.related_object_id ?? null;

  await eventBus.publish({
    eventType: "EvidenceLinked",
    originatingObjectType: "Evidence",
    originatingObjectId: evidence.id,
    seuId,
    correlationId: eventBus.newCorrelationId(),
    actorId,
    authorityBadge: authorBadge,
    payload: { relatedObjectType, relatedObjectId },
  });

  return { ok: true };
}

const CONFIDENCE_RANK: Record<string, number> = { Fail: 0, "Not Assessed": 0, Partial: 1, Pass: 2 };
function computeConfidenceLevel(assessments: EvidenceValidationAssessment[]): string | null {
  if (assessments.length === 0) return null;
  const worst = Math.min(...assessments.map((a) => CONFIDENCE_RANK[a.status] ?? 0));
  if (worst === 0) return "Low";
  if (worst === 1) return "Medium";
  return "High";
}

export type RecordValidationAssessmentResult = { ok: true; evidence: EvidenceRow } | { ok: false; reason: "not_found" };

export async function recordValidationAssessment(input: { evidenceId: string; dimension: string; status: string; notes?: string | null }): Promise<RecordValidationAssessmentResult> {
  await assertCanonicalCategory("evidence-validation-dimension", input.dimension);
  await assertCanonicalCategory("evidence-validation-status", input.status);

  const { data: existing } = await evidenceDB.findById(input.evidenceId);
  if (!existing) return { ok: false, reason: "not_found" };

  const assessment: EvidenceValidationAssessment = {
    dimension: input.dimension,
    status: input.status,
    notes: input.notes ?? null,
    assessedAt: new Date().toISOString(),
  };
  const confidenceLevel = computeConfidenceLevel([...existing.validation_dimensions, assessment]);

  const { data: updated, error } = await evidenceDB.appendValidationAssessment(input.evidenceId, assessment, confidenceLevel);
  if (error || !updated) throw error ?? new Error("failed to record validation assessment");

  return { ok: true, evidence: updated };
}

export interface EvidenceWithNextStates {
  evidence: EvidenceRow;
  possibleNextStates: string[];
}

export async function listEvidenceWithNextStates(seuId: string): Promise<EvidenceWithNextStates[]> {
  const items = await listEvidenceBySeu(seuId);
  return Promise.all(
    items.map(async (evidence) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Evidence", evidence.status);
      return { evidence, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}

export type TransitionEvidenceResult =
  | { ok: true; evidence: EvidenceRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string };

export async function transitionEvidence(input: { evidenceId: string; targetState: string; actorRole: string; actorId?: string }): Promise<TransitionEvidenceResult> {
  const { data: evidence } = await evidenceDB.findById(input.evidenceId);
  if (!evidence) return { ok: false, reason: "not_found" };

  const { data: relationships } = await evidenceDB.findRelationshipsByEvidenceId(evidence.id);
  const seuId = relationships?.find((r) => r.related_object_type === "SEU")?.related_object_id ?? null;

  const fromState = evidence.status;

  const gate = await transitionEngine.evaluate({
    entityType: "Evidence",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId ?? "",
    entityId: evidence.id,
    context: { evidence },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Evidence ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    if (gate.reason === "not_submitted") return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge ${gate.submitBadge})` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  if (!input.actorId) throw new Error("actorId is required to transition Evidence");
  if (!gate.authorityBadge) throw new Error(`no authority badge resolved for Evidence ${fromState} -> ${input.targetState} — Transition Definition declares no verb`);
  if (!seuId) throw new Error(`Evidence ${evidence.id} has no SEU relationship — cannot resolve a governed author for its Quality Gate evaluation`);
  const { authorId } = await resolveAuthor(seuId, input.actorId);
  const qualityGateResult = await qualityGateEngine.evaluate({
    entityType: "Evidence",
    entityId: evidence.id,
    seuId,
    fromState,
    toState: input.targetState,
    authorId,
    authorBadge: gate.authorityBadge,
  });
  if (qualityGateResult.outcome === "Blocked") {
    return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${qualityGateResult.gate.name}" blocked: ${qualityGateResult.reason}` };
  }

  const { data: updated, error } = await evidenceDB.updateStatus(evidence.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update evidence status");

  await eventBus.publish({
    eventType: gate.eventType ?? "EvidenceTransitioned",
    originatingObjectType: "Evidence",
    originatingObjectId: evidence.id,
    seuId,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });

  return { ok: true, evidence: updated, appliedTransition: { fromState, toState: input.targetState } };
}
