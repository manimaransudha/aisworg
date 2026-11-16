import { qualityGateDefinitionsDB } from "../../../dblayer/qualityGateDefinitionsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
import type { QualityGateDefinitionRow } from "../../../dblayer/seuTypes.js";
import { listConceptsForType } from "./ontology.js";

export interface QualityGateViewData {
  qualityGate: QualityGateDefinitionRow;
  // The Ontology label of each code the page shows, for the concept types it uses.
  labels: Record<string, Record<string, string>>;
}

const LABEL_CONCEPT_TYPES = ["category:quality-gate", "quality-gate-criteria-type", "category:evidence", "deliverable-name"];

// One Quality Gate Definition for the Registry view page. Returns null when the row does not exist or is not visible to the viewer's tenant.
export async function getQualityGateView(id: string, viewer: { isRoot: boolean; tenantId: string | null }): Promise<QualityGateViewData | null> {
  const { data: qualityGate, error } = await qualityGateDefinitionsDB.findById(id);
  if (error) throw error;
  if (!qualityGate) return null;
  const platformTenantId = await getPlatformTenantId();
  if (!viewer.isRoot && qualityGate.tenant_id !== platformTenantId && qualityGate.tenant_id !== viewer.tenantId) return null;
  const labels: Record<string, Record<string, string>> = {};
  for (const conceptType of LABEL_CONCEPT_TYPES) {
    const concepts = await listConceptsForType(conceptType, viewer);
    labels[conceptType] = Object.fromEntries(concepts.map((c) => [c.code, c.default_label]));
  }
  return { qualityGate, labels };
}
