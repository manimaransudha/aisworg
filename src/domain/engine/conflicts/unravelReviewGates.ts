import type { ComposedPacks } from "./composedPacks.js";

// A review gate of a composed Pack at one step.
export interface ReviewGateRow {
  packId: string;
  packCode: string;
  // The step the gate governs, as "Entity|from|to". It applies to every Deliverable at that step.
  step: string;
  // Every field of the gate except the step and the checklists.
  fields: Record<string, unknown>;
  // The checklists of the gate. Checklists are a union, so they are kept apart and never compared.
  checklistIds: string[];
  recommendedChecklistIds: string[];
}

export interface ReviewGatesUnraveled {
  gates: ReviewGateRow[];
}

// Gathers the review gates of the composed Packs. It decides nothing.
export function unravelReviewGates(input: { composedPacks: ComposedPacks }): ReviewGatesUnraveled {
  const gates: ReviewGateRow[] = [];
  for (const pack of input.composedPacks.packs) {
    for (const gate of pack.contributions?.reviewGates ?? []) {
      const { governedTransition, checklistIds, recommendedChecklistIds, ...fields } = gate;
      gates.push({ packId: pack.id, packCode: pack.code, step: governedTransition, fields, checklistIds: [...(checklistIds ?? [])].sort(), recommendedChecklistIds: [...(recommendedChecklistIds ?? [])].sort() });
    }
  }
  return { gates };
}
