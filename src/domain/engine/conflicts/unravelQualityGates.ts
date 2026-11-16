import { qualityGateDefinitionsDB } from "../../../dblayer/qualityGateDefinitionsDB.js";
import type { QualityGateDefinitionRow } from "../../../dblayer/seuTypes.js";
import type { ComposedPacks } from "./composedPacks.js";

// A quality gate of a composed Pack for one Deliverable at one step. The fields of the gate come from its Quality Gate Definition. Where it applies, its Checklists and its Policies come from the Pack's entry.
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

// The text fields of the form that the definition keeps in its content and not in a column.
const CONTENT_FIELDS = ["participant", "assurance", "classification", "outputContract", "externalEvidence", "statement", "prompt"] as const;

// Gathers the quality gates of the composed Packs, one row for each Deliverable the gate names. It decides nothing. A code with no definition is left out.
export function unravelQualityGates(input: { composedPacks: ComposedPacks; definitions: QualityGateDefinitionRow[] }): QualityGatesUnraveled {
  const definitionByCode = new Map(input.definitions.map((d) => [d.code, d]));
  const gates: QualityGateRow[] = [];
  for (const pack of input.composedPacks.packs) {
    for (const entry of pack.contributions?.qualityGates ?? []) {
      const definition = definitionByCode.get(entry.qualityCode);
      if (!definition) continue;
      const content = (definition.draft_content ?? {}) as Record<string, unknown>;
      const fields: Record<string, unknown> = {
        code: definition.code,
        name: definition.name,
        category: definition.category,
        criteriaType: definition.criteria_type,
        evidenceCategory: definition.evidence_category ?? undefined,
        requiredPolicyCodes: sorted(entry.requiredPolicyCodes),
      };
      for (const field of CONTENT_FIELDS) if (content[field] !== undefined) fields[field] = content[field];
      const checklists = entry.checklists ?? [];
      gates.push({
        packId: pack.id, packCode: pack.code, deliverable: entry.deliverableName ?? "", step: entry.governedTransition, fields,
        checklistIds: sorted(checklists.filter((c) => c.mandatory === true).map((c) => c.checklistId)),
        recommendedChecklistIds: sorted(checklists.filter((c) => c.mandatory !== true).map((c) => c.checklistId)),
      });
    }
  }
  return { gates };
}

// The same, reading the Active definitions of the Platform and of the viewer's tenant.
export async function unravelQualityGatesFor(input: { composedPacks: ComposedPacks }, viewerTenantId: string): Promise<QualityGatesUnraveled> {
  const codes = [...new Set(input.composedPacks.packs.flatMap((pack) => (pack.contributions?.qualityGates ?? []).map((entry) => entry.qualityCode)))];
  const { data: definitions } = codes.length > 0 ? await qualityGateDefinitionsDB.findActiveByCodesVisibleTo(codes, viewerTenantId) : { data: [] };
  return unravelQualityGates({ composedPacks: input.composedPacks, definitions: definitions ?? [] });
}
