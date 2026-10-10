import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { qualityGatesDB } from "../../dblayer/qualityGatesDB.js";
import { policiesDB } from "../../dblayer/policiesDB.js";
import { participantsMasterDB } from "../../dblayer/participantsMasterDB.js";
import { participantsDB } from "../../dblayer/participantsDB.js";
import { eventBus } from "./eventBus.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow, EbmCompositionReport, EbmComposedPack, SeuRow } from "../../dblayer/seuTypes.js";

interface CompositionCompletedPayload {
  seuId: string;
  authorBadge: string;
}

async function resolveAuthorParticipantId(seuId: string, actorId: string): Promise<string> {
  const { data: master } = await participantsMasterDB.findById(actorId);
  if (!master) throw new Error(`No superuser provisioned.`);
  const { data: participant } = await participantsDB.findBySeuIdAndParticipantMasterId(seuId, master.id);
  if (!participant) throw new Error(`actor ${actorId} has no participant engagement in SEU ${seuId}`);
  return participant.id;
}

async function failComposition(seuId: string, event: EventRow, authorBadge: string, reason: string): Promise<void> {
  await seusDB.updateLifecycleState(seuId, "Failed");
  await eventBus.publish({
    eventType: "CommissionFailed",
    originatingObjectType: "SEU",
    originatingObjectId: seuId,
    seuId,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id,
    authorityBadge: authorBadge,
    payload: { stage: "compose_ebm", reason },
  });
}

export const compositionCompletedHandler: EventHandler = async (event: EventRow) => {
  const { seuId, authorBadge } = event.payload as unknown as CompositionCompletedPayload;
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) {
    logger.error(`[compositionCompleted] SEU not found: ${seuId}`);
    return;
  }
  if (!event.actor_id) {
    logger.error(`[compositionCompleted] no actor_id on CompositionCompleted event for SEU ${seuId}`);
    return;
  }
  try {
    await runComposition(seu, event, authorBadge);
  } catch (err) {
    await failComposition(seuId, event, authorBadge, (err as Error).message);
  }
};

async function runComposition(seu: SeuRow, event: EventRow, authorBadge: string): Promise<void> {
  const seuId = seu.id;
  const authorId = await resolveAuthorParticipantId(seuId, event.actor_id!);
  const stashed = seu.composition_report as {
    composedPacks?: EbmComposedPack[];
    compositionReport?: EbmCompositionReport;
    unraveled?: { pool: unknown[]; competencyRequirements?: Record<string, string[]> };
    resolvedCompositionConflicts?: Record<string, unknown>;
  } | null;

  const behaviors = {
    pool: stashed?.unraveled?.pool ?? [],
    resolvedCompositionConflicts: stashed?.resolvedCompositionConflicts ?? {},
    competencyRequirements: stashed?.unraveled?.competencyRequirements ?? {},
  };

  const composedPackIds = (stashed?.composedPacks ?? []).map((p) => p.packId);
  const [{ data: applicableQualityGates }, { data: composedPolicies }] = await Promise.all([
    qualityGatesDB.findByPackIds(composedPackIds),
    policiesDB.findByPackIds(composedPackIds),
  ]);
  const transitionPolicies = (composedPolicies ?? []).filter((p) => p.scope === "Transition");
  const seuScopedPolicies = transitionPolicies.filter((p) => p.governed_transition?.startsWith("SEU|"));
  const entityScopedPolicies = transitionPolicies.filter((p) => !p.governed_transition?.startsWith("SEU|"));

  const { data: ebm, error: ebmErr } = await ebmsDB.create({
    seuId,
    templateId: seu.template_id,
    profileId: seu.profile_id,
    authorId,
    authorBadge,
    composedPacks: stashed?.composedPacks ?? [],
    compositionReport: stashed?.compositionReport ?? { warnings: [], conflicts: [], parameterConflicts: [], resolutions: [] },
    behaviors,
    applicableQualityGateIds: (applicableQualityGates ?? []).map((g) => g.id),
    applicablePolicyIds: entityScopedPolicies.map((p) => p.id),
    seuScopedPolicyIds: seuScopedPolicies.map((p) => p.id),
  });
  if (ebmErr || !ebm) {
    await eventBus.publish({
      eventType: "CommissionFailed",
      originatingObjectType: "SEU",
      originatingObjectId: seuId,
      seuId,
      correlationId: event.correlation_id,
      causationId: event.id,
      actorId: event.actor_id,
      authorityBadge: authorBadge,
      payload: { stage: "compose_ebm", reason: (ebmErr ?? new Error("failed to create EBM")).message },
    });
    return;
  }

  await seusDB.setActiveEbm(seuId, ebm.id);
  await eventBus.publish({
    eventType: "EBMCreated",
    originatingObjectType: "EBM",
    originatingObjectId: ebm.id,
    seuId,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id,
    authorityBadge: authorBadge,
    payload: { seuScopedPolicyIds: ebm.seu_scoped_policy_ids },
  });
}
