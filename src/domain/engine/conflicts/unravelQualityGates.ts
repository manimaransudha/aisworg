import type { ComposedPacks } from "./composedPacks.js";

// A quality gate of a composed Pack for one Deliverable at one step. The fields of the gate are all that the Pack gives it, except where it applies.
export interface QualityGateRow {
  packId: string;
  packCode: string;
  // The Deliverable the gate is for, or "" when the gate names none.
  deliverable: string;
  // The step, as "Entity|from|to".
  step: string;
  // Every field of the gate except the step, the Deliverables and the checklists, with the lists in order.
  fields: Record<string, unknown>;
  // The checklists of the gate. Checklists are a union, so they are kept apart and never compared.
  checklistIds: string[];
  recommendedChecklistIds: string[];
}

export interface QualityGatesUnraveled {
  gates: QualityGateRow[];
}

const sorted = (values: string[] | undefined): string[] => [...(values ?? [])].sort();

// Gathers the quality gates of the composed Packs, one row for each Deliverable the gate names. It decides nothing.
export function unravelQualityGates(input: { composedPacks: ComposedPacks }): QualityGatesUnraveled {
  const gates: QualityGateRow[] = [];
  for (const pack of input.composedPacks.packs) {
    for (const gate of pack.contributions?.qualityGates ?? []) {
      const { governedTransition, deliverableName, applicabilityDeliverableNames, requiredPolicyCodes, checklistIds, recommendedChecklistIds, ...rest } = gate;
      const fields = { ...rest, requiredPolicyCodes: sorted(requiredPolicyCodes) };
      const deliverables = [...new Set([...(deliverableName ? [deliverableName] : []), ...(applicabilityDeliverableNames ?? [])])];
      for (const deliverable of deliverables.length > 0 ? deliverables : [""]) gates.push({ packId: pack.id, packCode: pack.code, deliverable, step: governedTransition, fields, checklistIds: sorted(checklistIds), recommendedChecklistIds: sorted(recommendedChecklistIds) });
    }
  }
  return { gates };
}
