// Ontology Model — Plan (Phase 17, Ch.18). Two edge concerns over a canonical
// core: write-path validation (a category must be a known canonical concept) and
// read-time label resolution (a tenant's alias, else the platform default). The
// core stores canonical codes only; neither the state machine, governance,
// dependency wiring, attestation, nor traceability ever sees a tenant label.
//
// CR-022 (owner: "Include tenant_id as part of Ontology. So platform ones
// will be visible to all + their own vocabulary"): a concept now belongs to a
// tenant (Platform's is canonical/shared; a tenant's own is theirs alone) —
// same shape Pack ownership already has. `OntologyActor` names who's asking:
// isRoot bypasses every scope check (sees/writes any tenant, same as
// everywhere else); everyone else reads Platform + their own tenant, and can
// only ever write their own.
import { ontologyDB, type OntologyViewer } from "../../../dblayer/ontologyDB.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";

export type OntologyActor = OntologyViewer;

export const CATEGORY_CONCEPT_TYPE: Record<string, string> = {
  Deliverable: "category:deliverable",
  Evidence: "category:evidence",
  Decision: "category:decision",
  Knowledge: "category:knowledge",
  Obligation: "category:obligation",
  // Ch.30 §7 — the illustrative Event Categories taxonomy (State/Governance/
  // Runtime/Integration/Administrative), a property of event_registry.category.
  EventType: "category:event-types",
  // CR-058 — Ch.26 §7's 5 categories (Entry/Exit/Release/Compliance/Operational).
  QualityGate: "category:quality-gate",
};

// Write-path enforcement (Ch.18 Decision 4): a category must be a canonical
// concept for its field. The canonical code is the string itself, so existing
// values pass; a genuinely novel value is rejected. A retired concept is
// treated the same as an unknown one — retirement means "no longer valid for
// new writes", matching the discipline everywhere else (retired nouns/verbs
// can't be assigned to new badges either). Throws on violation.
//
// `viewer` is optional and defaults to Platform-only visibility — every
// pre-CR-022 caller (Deliverable/Evidence/Decision/Knowledge/Obligation
// category checks) has no tenant/actor context available at its call site
// today (creating one of those doesn't thread a session or an owning tenant
// through), and none of those 5 concept types has ever had a tenant-owned row
// — so the default preserves their exact prior behaviour untouched. Pack's
// category/installationClassification checks (core/packs.ts) pass a real
// scope, since PackSeedInput already carries the Pack's own tenantId.
export async function assertCanonicalCategory(conceptType: string, value: string, viewer: OntologyViewer = { isRoot: false, tenantId: null }): Promise<void> {
  const { data: concept } = await ontologyDB.findConcept(conceptType, value, viewer);
  if (!concept || !concept.is_active) {
    const { data: allowed } = await ontologyDB.findConceptsByType(conceptType, viewer);
    const list = (allowed ?? []).map((c) => c.code).join(", ");
    throw new Error(`"${value}" is not a canonical ${conceptType} concept. Allowed: ${list || "(none registered)"}`);
  }
}

// --- Ontology Management CRUD (owner, 2026-08-18: "each of the concept_types
// should have a CRUD UI... any further additions will be data changes") ---
// No separate concept_types governance table (owner: "there will be no end to
// this") — CRUD lands directly on ontology_concepts; the only guard-rail is a
// naming convention (owner: "simple rules. small case no spaces"), enforced
// here rather than by a second table.
//
// CR-022 design note — engine-bound concept types (owner, 2026-08-19):
// "Think of it as platform provides a software engineering definition. Tenant
// can override it, but within the boundaries of what the EOOM wants to
// accomplish." A purely descriptive concept type (template-categories,
// deliverable-name) is safe for a tenant to extend freely — nothing in the
// engine pattern-matches its codes. A concept type that's the tenant-facing
// name for a REAL engine mechanism (e.g. a future "quality-gate-type") is
// different: the tenant's own code/label stays free (their own methodology,
// their own words), but it must resolve to one of a small, fixed set of real
// engine capabilities — carried as an explicit reference on the concept
// (e.g. `engine_capability`), never inferred by the engine pattern-matching
// the concept's own `code` string. That's the EOOM boundary: vocabulary is
// tenant-owned, the mechanics it must still satisfy are not. Not built —
// nothing today has an engine binding to attach it to (Quality Gates are the
// natural first candidate once Pack's contribution types become
// Ontology-driven rather than hardcoded structure) — recorded here so the
// principle is on file before it's needed.
const ONTOLOGY_CODE_RE = /^[a-z][a-z0-9-]*$/;

export function assertOntologyCodeFormat(label: string, value: string): void {
  if (!ONTOLOGY_CODE_RE.test(value)) {
    throw new Error(`${label} "${value}" must be lowercase, hyphenated, no spaces (e.g. "capability-name").`);
  }
}

// The admin page's list of concept_types is derived from the data itself, not
// a lookup table — whatever concept_type codes are visible to this viewer.
export async function listConceptTypes(viewer: OntologyViewer): Promise<string[]> {
  const { data } = await ontologyDB.listDistinctConceptTypes(viewer);
  return data ?? [];
}

export async function listConceptsForType(conceptType: string, viewer: OntologyViewer, includeInactive = true) {
  const { data } = await ontologyDB.findConceptsByType(conceptType, viewer, { includeInactive });
  return data ?? [];
}

// `actor.isRoot` may add to ANY tenant's vocabulary (Platform's by default —
// the natural "curate the canonical set" action for a root admin); everyone
// else always adds to their OWN tenant's vocabulary, full stop — `targetTenantId`
// is ignored for a non-root actor rather than trusted from the request.
export async function addConcept(input: { conceptType: string; code: string; defaultLabel: string; description?: string; targetTenantId?: string }, actor: OntologyActor) {
  const conceptType = input.conceptType.trim();
  const code = input.code.trim();
  const defaultLabel = input.defaultLabel.trim();
  const description = (input.description ?? "").trim();
  assertOntologyCodeFormat("concept type", conceptType);
  assertOntologyCodeFormat("code", code);
  if (!defaultLabel) throw new Error("label is required");
  // CR-049 — `deliverable-name` graduated out of plain CRUD into a real
  // authored entity (Deliverable Definition, its own deliverable_definitions
  // table + Draft->...->Active lifecycle) so a tenant's specialisation is a
  // tracked derivation of Platform's own concept, not an orphan row that
  // happens to share a string. A hand-added row here would bypass that
  // lineage entirely, undermining the whole point of the CR.
  if (conceptType === "deliverable-name") {
    throw new Error('Deliverable names are authored at /aisworg/seu/sdk/deliverable-authoring now, not added directly here — use "Inherit" there to derive from an existing Platform Deliverable Definition, or start a new one.');
  }
  const tenantId = actor.isRoot ? (input.targetTenantId ?? PLATFORM_TENANT_ID) : actor.tenantId;
  if (!tenantId) throw new Error("no tenant to add this concept to");
  const { data, error } = await ontologyDB.upsertConcept({ conceptType, code, defaultLabel, tenantId, description: description || null });
  if (error || !data) throw error ?? new Error("failed to add concept");
  return data;
}

// Same ownership rule as addConcept: root may retire any tenant's row; anyone
// else may only retire their OWN tenant's — never Platform's, never another
// tenant's, regardless of what's submitted.
export async function retireConcept(conceptType: string, code: string, targetTenantId: string, actor: OntologyActor) {
  if (!actor.isRoot && targetTenantId !== actor.tenantId) {
    throw new Error("you can only retire concepts in your own tenant's vocabulary");
  }
  const { data, error } = await ontologyDB.retireConcept(conceptType, code, targetTenantId);
  if (error) throw error;
  if (!data) throw new Error(`no such concept ${conceptType}/${code} for that tenant`);
  return data;
}

// Read-time resolution: the tenant's alias for a canonical code, else the
// platform default label (Platform's own concepts + this tenant's own).
// Runs at the edge (views / tenant-facing serialisers).
export async function resolveLabels(tenantId: string | null, conceptType: string): Promise<Record<string, string>> {
  const { data: concepts } = await ontologyDB.findConceptsByType(conceptType, { isRoot: false, tenantId });
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
  const { data: concept } = await ontologyDB.findConcept(input.conceptType, input.canonicalCode, { isRoot: false, tenantId: input.tenantId });
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
