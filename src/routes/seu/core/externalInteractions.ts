// Ch.36 External Interaction Model — Post-MVP Phase 8. Lifecycle transitions
// reuse the same generic transitionEngine every other entity type already
// uses (Ch.29 §10), extended to a tenth entity type. No real Interaction
// Adapter exists yet (Ch.36 §10) — this is the record-keeping/traceability
// model the chapter itself scopes separately from "communication protocols;
// API technologies... implementation concerns" (Ch.36 §2). Recording an
// interaction here is presently a manual, human-entered act (e.g. "I emailed
// the customer for approval," "I opened a PR on GitHub by hand") — a real,
// honest MVP instance of "External Interaction exists as a governed,
// traceable record," not a simulated integration.
import { externalInteractionsDB } from "../../../dblayer/externalInteractionsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { raiseAttentionItem } from "./attentionItems.js";
import type { ExternalInteractionRow, InteractionDirection } from "../../../dblayer/seuTypes.js";

export async function createExternalInteraction(input: {
  seuId: string;
  deliverableId?: string | null;
  interactionType: string;
  direction: InteractionDirection;
  targetSystem: string;
  purpose?: string | null;
}): Promise<ExternalInteractionRow> {
  if (input.deliverableId) {
    const { data: deliverable } = await deliverablesDB.findById(input.deliverableId);
    if (!deliverable) throw new Error(`deliverable not found: ${input.deliverableId}`);
    if (deliverable.seu_id !== input.seuId) throw new Error(`deliverable ${input.deliverableId} does not belong to SEU ${input.seuId}`);
  }

  const { data: interaction, error } = await externalInteractionsDB.create(input);
  if (error || !interaction) throw error ?? new Error("failed to create external interaction");

  await eventBus.publish({
    eventType: "InteractionCreated",
    originatingObjectType: "ExternalInteraction",
    originatingObjectId: interaction.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { seuId: input.seuId, targetSystem: input.targetSystem, direction: input.direction },
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
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition"; detail: string };

// Ch.36 §13: "Interaction failures shall... generate Attention Items where
// appropriate" — the concrete cross-chapter link back to Ch.34. A transition
// to 'Failed' automatically raises one (category "Exception," matching
// Ch.34 §7's own definition: "Engineering execution cannot proceed").
export async function transitionExternalInteraction(input: { interactionId: string; targetState: string; actorRole: string }): Promise<TransitionExternalInteractionResult> {
  const { data: interaction } = await externalInteractionsDB.findById(input.interactionId);
  if (!interaction) return { ok: false, reason: "not_found" };

  const fromState = interaction.status;
  const gate = await transitionEngine.evaluate({
    entityType: "ExternalInteraction",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    context: { interaction },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for ExternalInteraction ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires role ${gate.requiredRole}, actor has ${gate.actorRole}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const { data: updated, error } = await externalInteractionsDB.updateStatus(interaction.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update external interaction status");

  await eventBus.publish({
    eventType: input.targetState === "Failed" ? "InteractionFailed" : "InteractionCompleted",
    originatingObjectType: "ExternalInteraction",
    originatingObjectId: interaction.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
  });

  if (input.targetState === "Failed") {
    await raiseAttentionItem({
      seuId: interaction.seu_id,
      category: "Exception",
      priority: "High",
      title: `External Interaction with "${interaction.target_system}" failed`,
      description: `Interaction ${interaction.id} (${interaction.interaction_type}, ${interaction.direction} to/from "${interaction.target_system}") failed. Ch.36 §13: engineering state is unaffected — External Interactions never modify it directly — but this requires review before retrying.`,
      relatedObjectType: "ExternalInteraction",
      relatedObjectId: interaction.id,
    });
  }

  return { ok: true, interaction: updated, appliedTransition: { fromState, toState: input.targetState } };
}
