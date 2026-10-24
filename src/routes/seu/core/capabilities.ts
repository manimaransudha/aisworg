import { seuCapabilitiesDB, type SeuCapabilityWithCode } from "../../../dblayer/seuCapabilitiesDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { capabilityFulfilmentsDB } from "../../../dblayer/capabilityFulfilmentsDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { dependencyDefinitionEngine } from "../../../domain/engine/dependencyDefinitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { findEligibleParticipants, getSeuCompetencyRequirements, resolveEligibilityPolicies } from "./participantEligibility.js";
import { createParticipant, transitionParticipant } from "./participants.js";
import { resolveAuthor } from "./attentionItems.js";
import type { CapabilityFulfilmentRow, EventRow, FulfilmentStrategy, ParticipantMasterRow, ParticipantRow, ParticipantType, SeuRow } from "../../../dblayer/seuTypes.js";

export interface FulfilCapabilityResult {
  fulfilment: CapabilityFulfilmentRow;
  participant: ParticipantRow;
  seuCapabilityId: string;
  capabilityCode: string;
  authorId: string;
}

async function loadContext(seuId: string, capabilityId: string): Promise<{ seu: SeuRow; seuCapability: SeuCapabilityWithCode }> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) throw new Error(`SEU not found: ${seuId}`);

  const { data: seuCapabilities } = await seuCapabilitiesDB.findBySeuId(seuId);
  const seuCapability = (seuCapabilities ?? []).find((c) => c.capability_id === capabilityId);
  if (!seuCapability) throw new Error(`capability ${capabilityId} is not required by SEU ${seuId}`);

  return { seu, seuCapability };
}

async function loadEligiblePool(seu: SeuRow, seuCapability: SeuCapabilityWithCode, excludeParticipantMasterIds: string[]): Promise<ParticipantMasterRow[]> {
  if (!seu.tenant_id) throw new Error(`SEU ${seu.id} has no owning tenant`);
  const competency = await getSeuCompetencyRequirements(seu);
  const requiredPolicies = await resolveEligibilityPolicies(seu);
  return findEligibleParticipants({ tenantId: seu.tenant_id, capabilityCode: seuCapability.capability_code, competency, requiredPolicyIds: requiredPolicies.map((p) => p.id), excludeParticipantMasterIds });
}

type ResolvedParticipant = { type: ParticipantType; displayName: string; participantMasterId: string };

async function resolveMasterParticipant(
  seu: SeuRow,
  seuCapability: SeuCapabilityWithCode,
  participantMasterId: string,
  excludeParticipantMasterIds: string[] = []
): Promise<ResolvedParticipant> {
  const { data: master } = await participantsMasterDB.findById(participantMasterId);
  if (!master) throw new Error(`Participant ${participantMasterId} not found`);
  const eligible = await loadEligiblePool(seu, seuCapability, excludeParticipantMasterIds);
  if (!eligible.some((p) => p.id === master.id)) {
    throw new Error(`Participant "${master.display_name}" is not eligible for Capability "${seuCapability.capability_code}"`);
  }
  return { type: master.type, displayName: master.display_name, participantMasterId: master.id };
}

async function fulfilOne(
  seu: SeuRow,
  seuCapability: SeuCapabilityWithCode,
  resolved: { type: ParticipantType; displayName: string; participantMasterId: string | null },
  actorId: string,
  authorBadge: string,
  strategyOverride?: FulfilmentStrategy
): Promise<FulfilCapabilityResult> {
  const participant = await createParticipant({
    seuId: seu.id,
    type: resolved.type,
    displayName: resolved.displayName,
    participantMasterId: resolved.participantMasterId,
    actorId,
    authorBadge,
  });

  const { authorId } = await resolveAuthor(seu.id, actorId);
  const { data: fulfilment, error: fulfilmentErr } = await capabilityFulfilmentsDB.create({
    seuCapabilityId: seuCapability.id,
    participantId: participant.id,
    fulfilmentStrategy: strategyOverride ?? resolved.type,
    authorId,
    authorBadge,
  });
  if (fulfilmentErr || !fulfilment) throw fulfilmentErr ?? new Error("failed to create capability fulfilment");

  await seuCapabilitiesDB.markFulfilled(seuCapability.id);

  const { data: fulfilledServices } = await servicesDB.findByCapabilityId(seuCapability.capability_id);
  for (const service of fulfilledServices ?? []) {
    await dependencyDefinitionEngine.evaluateAndPublishFromTransition({
      seuId: seu.id,
      entityType: "Capability",
      name: service.code,
      newState: "Fulfilled",
    });
  }

  return { fulfilment, participant, seuCapabilityId: seuCapability.id, capabilityCode: seuCapability.capability_code, authorId };
}

export async function requestCapabilityFulfilment(input: {
  seuId: string;
  capabilityId: string;
  participantMasterIds?: string[];
  actorId: string;
  authorBadge: string;
}): Promise<EventRow> {

  const { seu, seuCapability } = await loadContext(input.seuId, input.capabilityId);
  return eventBus.publish({
    eventType: "CapabilityRequested",
    originatingObjectType: "SEU",
    originatingObjectId: seu.id,
    seuId: seu.id,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge: input.authorBadge,
    payload: { capabilityId: seuCapability.capability_id, ...(input.participantMasterIds?.length ? { participantMasterIds: input.participantMasterIds } : {}) },
  });
}

// Consumes CapabilityRequested: identifies the Participants (the Participants named by a manual pick, otherwise the
// whole eligible pool), fulfils the Capability with them, then publishes one CapabilityFulfilled for the request as
// its last statement. An empty pool publishes CapabilityUnavailable instead.
export async function fulfilRequestedCapability(event: EventRow): Promise<void> {
  const requested = event.payload as { capabilityId?: string; participantMasterIds?: string[] } | null;
  if (!event.seu_id || !requested?.capabilityId) throw new Error(`CapabilityRequested event ${event.id} carries no seuId/capabilityId`);
  const { seu, seuCapability } = await loadContext(event.seu_id, requested.capabilityId);
  const { data: excludeParticipantMasterIds } = await capabilityFulfilmentsDB.findReleasedParticipantMasterIds(seuCapability.id);

  const named = requested.participantMasterIds ?? [];
  const participants: ResolvedParticipant[] = named.length > 0
    ? await Promise.all(named.map((id) => resolveMasterParticipant(seu, seuCapability, id, excludeParticipantMasterIds ?? [])))
    : (await loadEligiblePool(seu, seuCapability, excludeParticipantMasterIds ?? [])).map((p) => ({ type: p.type, displayName: p.display_name, participantMasterId: p.id }));

  if (participants.length === 0) {
    await eventBus.publish({
      eventType: "CapabilityUnavailable",
      originatingObjectType: "SEU",
      originatingObjectId: seu.id,
      seuId: seu.id,
      correlationId: event.correlation_id,
      causationId: event.id,
      actorId: event.actor_id,
      authorityBadge: event.authority_badge,
      payload: { capabilityId: seuCapability.capability_id },
    });
    return;
  }

  const strategy: FulfilmentStrategy | undefined = participants.length > 1 ? "Composite" : undefined;
  const fulfilled: Array<{ result: FulfilCapabilityResult; resolved: ResolvedParticipant }> = [];
  for (const resolved of participants) {
    fulfilled.push({ result: await fulfilOne(seu, seuCapability, resolved, event.actor_id, event.authority_badge, strategy), resolved });
  }

  // Removed: createParticipant already publishes the Participant birth event; this second publish duplicated it.
  //   const { data: participantBirth, error: participantBirthError } = await transitionDefinitionsDB.findBirth("Participant");
  //   if (participantBirthError) throw participantBirthError;
  //   if (!participantBirth?.event_type) throw new Error("the Participant birth Transition Definition names no event");
  //   for (const { result, resolved } of fulfilled) {
  //     await eventBus.publish({
  //       eventType: participantBirth.event_type,
  //       originatingObjectType: "Participant",
  //       originatingObjectId: result.participant.id,
  //       seuId: seu.id,
  //       correlationId: event.correlation_id,
  //       causationId: event.id,
  //       actorId: result.authorId,
  //       authorityBadge: event.authority_badge,
  //       payload: { participantType: resolved.type, participantMasterId: resolved.participantMasterId },
  //     });
  //   }
  await eventBus.publish({
    eventType: "CapabilityFulfilled",
    originatingObjectType: "SEU",
    originatingObjectId: seu.id,
    seuId: seu.id,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id,
    authorityBadge: event.authority_badge,
    payload: { capabilityId: seuCapability.capability_id, participantIds: fulfilled.map((f) => f.result.participant.id) },
  });
}

export async function releaseParticipants(input: {
  seuId: string;
  capabilityId: string;
  participantIds: string[];
  actorId: string;
}): Promise<ParticipantRow[]> {
  if (input.participantIds.length === 0) throw new Error("at least one Participant is required");
  const { seuCapability } = await loadContext(input.seuId, input.capabilityId);

  const released: ParticipantRow[] = [];
  for (const participantId of input.participantIds) {
    const { data: participant } = await participantsDB.findById(participantId);
    if (!participant) throw new Error(`Participant not found: ${participantId}`);

    const { data: fulfilment } = await capabilityFulfilmentsDB.findActiveByParticipantId(participant.id);
    if (!fulfilment || fulfilment.seu_capability_id !== seuCapability.id) {
      throw new Error(`Participant ${participantId} has no active Capability Fulfilment for Capability "${seuCapability.capability_code}"`);
    }

    if (participant.state !== "Released") {
      const toReleased = await transitionParticipant({ participantId: participant.id, targetState: "Released", actorId: input.actorId });
      if (!toReleased.ok) throw new Error(`failed to release Participant ${participant.id}: ${toReleased.reason}`);
    }
    const toArchived = await transitionParticipant({ participantId: participant.id, targetState: "Archived", actorId: input.actorId });
    if (!toArchived.ok) throw new Error(`failed to archive Participant ${participant.id}: ${toArchived.reason}`);

    await capabilityFulfilmentsDB.revoke(fulfilment.id);
    released.push(toArchived.participant);
  }

  await seuCapabilitiesDB.markUnfulfilled(seuCapability.id);
  return released;
}
