import { seuCapabilitiesDB, type SeuCapabilityWithCode } from "../../../dblayer/seuCapabilitiesDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { capabilityFulfilmentsDB } from "../../../dblayer/capabilityFulfilmentsDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { dependencyDefinitionEngine } from "../../../domain/engine/dependencyDefinitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory } from "./ontology.js";
import { findEligibleParticipants, getSeuCompetencyRequirements, resolveEligibilityPolicies } from "./participantEligibility.js";
import { transitionParticipant } from "./participants.js";
import { resolveAuthor } from "./attentionItems.js";
import type { CapabilityFulfilmentRow, FulfilmentStrategy, ParticipantRow, ParticipantType, SeuRow } from "../../../dblayer/seuTypes.js";

export interface FulfilCapabilityResult {
  fulfilment: CapabilityFulfilmentRow;
  participant: ParticipantRow;
  seuCapabilityId: string;
  capabilityCode: string;
}

async function loadContext(seuId: string, capabilityId: string): Promise<{ seu: SeuRow; seuCapability: SeuCapabilityWithCode }> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) throw new Error(`SEU not found: ${seuId}`);

  const { data: seuCapabilities } = await seuCapabilitiesDB.findBySeuId(seuId);
  const seuCapability = (seuCapabilities ?? []).find((c) => c.capability_id === capabilityId);
  if (!seuCapability) throw new Error(`capability ${capabilityId} is not required by SEU ${seuId}`);

  return { seu, seuCapability };
}

async function resolveMasterParticipant(
  seu: SeuRow,
  seuCapability: SeuCapabilityWithCode,
  participantMasterId: string,
  excludeParticipantMasterIds: string[] = []
): Promise<{ type: ParticipantType; displayName: string; participantMasterId: string }> {
  const { data: master } = await participantsMasterDB.findById(participantMasterId);
  if (!master) throw new Error(`Participant ${participantMasterId} not found`);
  if (!seu.tenant_id) throw new Error(`SEU ${seu.id} has no owning tenant`);
  const competency = await getSeuCompetencyRequirements(seu);
  const requiredPolicies = await resolveEligibilityPolicies(seu);
  const eligible = await findEligibleParticipants({ tenantId: seu.tenant_id, capabilityCode: seuCapability.capability_code, competency, requiredPolicyIds: requiredPolicies.map((p) => p.id), excludeParticipantMasterIds });
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
  const { data: participant, error: participantErr } = await participantsDB.create({
    seuId: seu.id,
    type: resolved.type,
    displayName: resolved.displayName,
    participantId: resolved.participantMasterId,
  });
  if (participantErr || !participant) throw participantErr ?? new Error("failed to create participant");

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

  await eventBus.publish({
    eventType: "ParticipantCreated",
    originatingObjectType: "Participant",
    originatingObjectId: participant.id,
    seuId: seu.id,
    correlationId: eventBus.newCorrelationId(),
    actorId: authorId,
    authorityBadge: authorBadge,
    payload: { participantType: resolved.type, participantMasterId: resolved.participantMasterId },
  });

  console.log(`[capabilities] fulfilOne complete seuId=${seu.id} capabilityId=${seuCapability.capability_id} participantId=${participant.id} at t=${Date.now()}`);
  await eventBus.publish({
    eventType: "CapabilityFulfilled",
    originatingObjectType: "SEU",
    originatingObjectId: seu.id,
    seuId: seu.id,
    correlationId: eventBus.newCorrelationId(),
    actorId: authorId,
    authorityBadge: authorBadge,
    payload: { capabilityId: seuCapability.capability_id, participantId: participant.id },
  });

  return { fulfilment, participant, seuCapabilityId: seuCapability.id, capabilityCode: seuCapability.capability_code };
}

export async function fulfilCapability(input: {
  seuId: string;
  capabilityId: string;
  participantMasterId?: string;
  participantType?: ParticipantType;
  displayName?: string;
  actorId: string;
  authorBadge: string;
}): Promise<FulfilCapabilityResult> {
  const { seu, seuCapability } = await loadContext(input.seuId, input.capabilityId);

  if (input.participantMasterId) {
    const { data: excludeParticipantMasterIds } = await capabilityFulfilmentsDB.findReleasedParticipantMasterIds(seuCapability.id);
    const resolved = await resolveMasterParticipant(seu, seuCapability, input.participantMasterId, excludeParticipantMasterIds ?? []);
    return fulfilOne(seu, seuCapability, resolved, input.actorId, input.authorBadge);
  }
  if (input.participantType && input.displayName) {
    await assertCanonicalCategory("participant-types", input.participantType);
    return fulfilOne(seu, seuCapability, { type: input.participantType, displayName: input.displayName, participantMasterId: null }, input.actorId, input.authorBadge);
  }
  throw new Error("either participantMasterId or participantType+displayName is required");
}

export async function fulfilCapabilityWithParticipants(input: {
  seuId: string;
  capabilityId: string;
  participantMasterIds: string[];
  actorId: string;
  authorBadge: string;
}): Promise<FulfilCapabilityResult[]> {
  if (input.participantMasterIds.length === 0) throw new Error("at least one Participant is required");

  const { seu, seuCapability } = await loadContext(input.seuId, input.capabilityId);
  const strategy: FulfilmentStrategy | undefined = input.participantMasterIds.length > 1 ? "Composite" : undefined;
  const { data: excludeParticipantMasterIds } = await capabilityFulfilmentsDB.findReleasedParticipantMasterIds(seuCapability.id);

  const results: FulfilCapabilityResult[] = [];
  for (const participantMasterId of input.participantMasterIds) {
    const resolved = await resolveMasterParticipant(seu, seuCapability, participantMasterId, excludeParticipantMasterIds ?? []);
    results.push(await fulfilOne(seu, seuCapability, resolved, input.actorId, input.authorBadge, strategy));
  }
  return results;
}

export async function releaseParticipants(input: {
  seuId: string;
  capabilityId: string;
  participantIds: string[];
  actorRole: string;
  actorId?: string;
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
      const toReleased = await transitionParticipant({ participantId: participant.id, targetState: "Released", actorRole: input.actorRole, actorId: input.actorId });
      if (!toReleased.ok) throw new Error(`failed to release Participant ${participant.id}: ${toReleased.reason}`);
    }
    const toArchived = await transitionParticipant({ participantId: participant.id, targetState: "Archived", actorRole: input.actorRole, actorId: input.actorId });
    if (!toArchived.ok) throw new Error(`failed to archive Participant ${participant.id}: ${toArchived.reason}`);

    await capabilityFulfilmentsDB.revoke(fulfilment.id);
    released.push(toArchived.participant);
  }

  await seuCapabilitiesDB.markUnfulfilled(seuCapability.id);
  return released;
}
