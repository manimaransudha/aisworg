// Ontology Model — Plan (Phase 17, Ch.18). Two edge concerns over a canonical
// core: write-path validation (a category must be a known canonical concept) and
// read-time label resolution (a tenant's alias, else the platform default). The
// core stores canonical codes only; neither the state machine, governance,
// dependency wiring, attestation, nor traceability ever sees a tenant label.
import { ontologyDB } from "../../../dblayer/ontologyDB.js";

export const CATEGORY_CONCEPT_TYPE: Record<string, string> = {
  Deliverable: "category:deliverable",
  Evidence: "category:evidence",
  Decision: "category:decision",
  Knowledge: "category:knowledge",
  Obligation: "category:obligation",
};

// Write-path enforcement (Ch.18 Decision 4): a category must be a canonical
// concept for its field. The canonical code is the string itself, so existing
// values pass; a genuinely novel value is rejected. Throws on violation.
export async function assertCanonicalCategory(conceptType: string, value: string): Promise<void> {
  const { data: concept } = await ontologyDB.findConcept(conceptType, value);
  if (!concept) {
    const { data: allowed } = await ontologyDB.findConceptsByType(conceptType);
    const list = (allowed ?? []).map((c) => c.code).join(", ");
    throw new Error(`"${value}" is not a canonical ${conceptType} concept. Allowed: ${list || "(none registered)"}`);
  }
}

// Read-time resolution: the tenant's alias for a canonical code, else the
// platform default label. Runs at the edge (views / tenant-facing serialisers).
export async function resolveLabels(tenantId: string | null, conceptType: string): Promise<Record<string, string>> {
  const { data: concepts } = await ontologyDB.findConceptsByType(conceptType);
  const labels: Record<string, string> = {};
  for (const c of concepts ?? []) labels[c.code] = c.default_label;
  if (tenantId) {
    const { data: aliases } = await ontologyDB.findAliasesByTenant(tenantId);
    for (const a of aliases ?? []) if (a.concept_type === conceptType) labels[a.canonical_code] = a.display_label;
  }
  return labels;
}

// Resolve a single code to its tenant-facing label.
export async function resolveLabel(tenantId: string | null, conceptType: string, code: string): Promise<string> {
  const labels = await resolveLabels(tenantId, conceptType);
  return labels[code] ?? code;
}

// Tenant alias management.
export async function setAlias(input: { tenantId: string; conceptType: string; canonicalCode: string; displayLabel: string }) {
  const { data: concept } = await ontologyDB.findConcept(input.conceptType, input.canonicalCode);
  if (!concept) throw new Error(`cannot alias unknown concept ${input.conceptType}/${input.canonicalCode}`);
  const { data, error } = await ontologyDB.upsertAlias(input);
  if (error || !data) throw error ?? new Error("failed to set alias");
  return data;
}

export async function clearAlias(tenantId: string, conceptType: string, canonicalCode: string) {
  await ontologyDB.deleteAlias(tenantId, conceptType, canonicalCode);
}

export async function listAliases(tenantId: string) {
  const { data } = await ontologyDB.findAliasesByTenant(tenantId);
  return data ?? [];
}
