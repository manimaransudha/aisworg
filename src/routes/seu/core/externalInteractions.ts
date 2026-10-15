import { externalInteractionsDB } from "../../../dblayer/externalInteractionsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine, gateRejection } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { raiseAttentionItem, resolveAuthor } from "./attentionItems.js";
import type { ExternalInteractionRow, InteractionDirection } from "../../../dblayer/seuTypes.js";

export async function createExternalInteraction(input: {
  seuId: string;
  deliverableId?: string | null;
  interactionType: string;
  direction: InteractionDirection;
  targetSystem: string;
  purpose?: string | null;
  actorId: string;
  authorBadge: string;
}): Promise<ExternalInteractionRow> {
  if (input.deliverableId) {
    const { data: deliverable } = await deliverablesDB.findById(input.deliverableId);
    if (!deliverable) throw new Error(`deliverable not found: ${input.deliverableId}`);
    if (deliverable.seu_id !== input.seuId) throw new Error(`deliverable ${input.deliverableId} does not belong to SEU ${input.seuId}`);
  }

  const { authorId } = await resolveAuthor(input.seuId, input.actorId);

  const { data: interaction, error } = await externalInteractionsDB.create({ ...input, authorId, authorBadge: input.authorBadge });
  if (error || !interaction) throw error ?? new Error("failed to create external interaction");

  await eventBus.publish({
    eventType: "InteractionCreated",
    originatingObjectType: "ExternalInteraction",
    originatingObjectId: interaction.id,
    seuId: input.seuId,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge: input.authorBadge,
    payload: { targetSystem: input.targetSystem, direction: input.direction },
  });

  return interaction;
}

export async function listExternalInteractionsBySeu(seuId: string): Promise<ExternalInteractionRow[]> {
  const { data } = await externalInteractionsDB.findBySeuId(seuId);
  return data ?? [];
}

export interface ExternalInteractionWithNextStates {
  interaction: ExternalInteractionRow;
  possibleNextStates: string[];
}

export async function listExternalInteractionsWithNextStates(seuId: string): Promise<ExternalInteractionWithNextStates[]> {
  const items = await listExternalInteractionsBySeu(seuId);
  return Promise.all(
    items.map(async (interaction) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("ExternalInteraction", interaction.status);
      return { interaction, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}

export type TransitionExternalInteractionResult =
  | { ok: true; interaction: ExternalInteractionRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string };

export async function transitionExternalInteraction(input: { interactionId: string; targetState: string; actorRole: string; actorId: string }): Promise<TransitionExternalInteractionResult> {
  const { data: interaction } = await externalInteractionsDB.findById(input.interactionId);
  if (!interaction) return { ok: false, reason: "not_found" };

  const fromState = interaction.status;

  if (!input.actorId) throw new Error("actorId is required to transition an ExternalInteraction");
  const gate = await transitionEngine.evaluateGoverned({
    entityType: "ExternalInteraction",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    entityId: interaction.id,
    context: { interaction },
    gateEntityId: interaction.id,
    gateSeuId: interaction.seu_id,
  });
  if (!gate.allowed) return gateRejection(gate, "ExternalInteraction", fromState, input.targetState);

  const { data: updated, error } = await externalInteractionsDB.updateStatus(interaction.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update external interaction status");

  await eventBus.publish({
    eventType: input.targetState === "Failed" ? "InteractionFailed" : "InteractionCompleted",
    originatingObjectType: "ExternalInteraction",
    originatingObjectId: interaction.id,
    seuId: interaction.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId,
    authorityBadge: gate.authorityBadge,
  });

  if (input.targetState === "Failed") {
    if (!input.actorId) throw new Error(`ExternalInteraction ${interaction.id} failure has no acting user to record as this Attention Item's author`);
    if (!gate.authorityBadge) throw new Error(`ExternalInteraction ${interaction.id} failure has no resolved authority badge to record as this Attention Item's author badge`);
    await raiseAttentionItem({
      seuId: interaction.seu_id,
      category: "Exception",
      priority: "High",
      title: `External Interaction with "${interaction.target_system}" failed`,
      description: `Interaction ${interaction.id} (${interaction.interaction_type}, ${interaction.direction} to/from "${interaction.target_system}") failed. Ch.36 §13: engineering state is unaffected — External Interactions never modify it directly — but this requires review before retrying.`,
      relatedObjectType: "ExternalInteraction",
      relatedObjectId: interaction.id,
      actorId: input.actorId,
      authorBadge: gate.authorityBadge,
    });
  }

  return { ok: true, interaction: updated, appliedTransition: { fromState, toState: input.targetState } };
}
