// Ch.12 Capability Fulfilment — direct assignment, no Dispatch Engine
// (Build Plan §5 item 3).
import { seuCapabilitiesDB } from "../../../dblayer/seuCapabilitiesDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { capabilityFulfilmentsDB } from "../../../dblayer/capabilityFulfilmentsDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { dependencyDefinitionEngine } from "../../../domain/engine/dependencyDefinitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { CapabilityFulfilmentRow, ParticipantRow, ParticipantType } from "../../../dblayer/seuTypes.js";

export interface FulfilCapabilityResult {
  fulfilment: CapabilityFulfilmentRow;
  participant: ParticipantRow;
  seuCapabilityId: string;
  capabilityCode: string;
}

export async function fulfilCapability(input: {
  seuId: string;
  capabilityId: string;
  participantType: ParticipantType;
  displayName: string;
}): Promise<FulfilCapabilityResult> {
  const { data: seuCapabilities } = await seuCapabilitiesDB.findBySeuId(input.seuId);
  const seuCapability = (seuCapabilities ?? []).find((c) => c.capability_id === input.capabilityId);
  if (!seuCapability) throw new Error(`capability ${input.capabilityId} is not required by SEU ${input.seuId}`);

  const { data: participant, error: participantErr } = await participantsDB.create({
    seuId: input.seuId,
    type: input.participantType,
    displayName: input.displayName,
  });
  if (participantErr || !participant) throw participantErr ?? new Error("failed to create participant");

  const { data: fulfilment, error: fulfilmentErr } = await capabilityFulfilmentsDB.create({
    seuCapabilityId: seuCapability.id,
    participantId: participant.id,
    fulfilmentStrategy: input.participantType,
  });
  if (fulfilmentErr || !fulfilment) throw fulfilmentErr ?? new Error("failed to create capability fulfilment");

  await seuCapabilitiesDB.markFulfilled(seuCapability.id);

  // CR-042 — dependency_definitions Capability-type rows are keyed by
  // Service code, not the bare Capability code (materialiseDependencyGraph
  // already expands one fromCapabilityCode into one row per Service that
  // Capability provides), so push-evaluation fires once per Service here.
  const { data: fulfilledServices } = await servicesDB.findByCapabilityId(input.capabilityId);
  for (const service of fulfilledServices ?? []) {
    await dependencyDefinitionEngine.evaluateAndPublishFromTransition({
      seuId: input.seuId,
      entityType: "Capability",
      name: service.code,
      newState: "Fulfilled",
    });
  }

  // Ch.13 §16 — about the Participant now existing, not about the
  // Capability being fulfilled (CapabilityFulfilled, published right below,
  // unchanged) — two different facts from the same call.
  await eventBus.publish({
    eventType: "ParticipantCreated",
    originatingObjectType: "Participant",
    originatingObjectId: participant.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { seuId: input.seuId, participantType: input.participantType },
  });

  await eventBus.publish({
    eventType: "CapabilityFulfilled",
    originatingObjectType: "SEU",
    originatingObjectId: input.seuId,
    correlationId: eventBus.newCorrelationId(),
    payload: { capabilityId: input.capabilityId, participantId: participant.id },
  });

  return { fulfilment, participant, seuCapabilityId: seuCapability.id, capabilityCode: seuCapability.capability_code };
}
