import type { ComposedPacks } from "./composedPacks.js";

// An Obligation definition of a composed Pack for one Deliverable at one step.
export interface ObligationDefinitionRow {
  packId: string;
  packCode: string;
  deliverable: string;
  // The step, as "Entity|from|to".
  step: string;
  // Every field of the definition, and the governing condition it has for this Deliverable. The Deliverables and steps it applies to are not fields.
  fields: Record<string, unknown>;
}

export interface ObligationDefinitionsUnraveled {
  definitions: ObligationDefinitionRow[];
}

// Gathers the Obligation definitions of the composed Packs, one row for each Deliverable and step a definition applies to. It decides nothing.
export function unravelObligationDefinitions(input: { composedPacks: ComposedPacks }): ObligationDefinitionsUnraveled {
  const definitions: ObligationDefinitionRow[] = [];
  for (const pack of input.composedPacks.packs) {
    for (const definition of pack.contributions?.obligationDefinitions ?? []) {
      const { applicabilityDeliverables, ...content } = definition;
      for (const applicability of applicabilityDeliverables ?? []) {
        for (const step of applicability.transitions ?? []) {
          definitions.push({ packId: pack.id, packCode: pack.code, deliverable: applicability.name, step, fields: { ...content, governingCondition: applicability.governingCondition ?? null } });
        }
      }
    }
  }
  return { definitions };
}
