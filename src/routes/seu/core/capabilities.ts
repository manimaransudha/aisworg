// Ch.12 Capability Fulfilment — direct assignment, no Dispatch Engine
// (Build Plan §5 item 3).
import { seuCapabilitiesDB } from "../../../dblayer/seuCapabilitiesDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { capabilityFulfilmentsDB } from "../../../dblayer/capabilityFulfilmentsDB.js";
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

  await eventBus.publish({
    eventType: "CapabilityFulfilled",
    originatingObjectType: "SEU",
    originatingObjectId: input.seuId,
    correlationId: eventBus.newCorrelationId(),
    payload: { capabilityId: input.capabilityId, participantId: participant.id },
  });

  return { fulfilment, participant, seuCapabilityId: seuCapability.id, capabilityCode: seuCapability.capability_code };
}
