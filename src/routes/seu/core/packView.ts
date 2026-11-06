import { packsDB } from "../../../dblayer/packsDB.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
import { generateFields, groupFieldsForDisplay, toSchemaRows, type FieldGroups, type GeneratedField, type JsonSchemaDocument, type ReferentialListItemField } from "../../../domain/sdk/formGenerator.js";
import { getAuthoringDraft } from "./sdkAuthoring.js";
import { listConceptsForType } from "./ontology.js";
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import type { PackRow, PolicyDefinitionRow } from "../../../dblayer/seuTypes.js";

// A referenced entity shown by its name, with its code muted under it and a note (description or purpose) when it has one.
export interface PackViewRef { name: string; note: string | null; id?: string; mandatory?: boolean }

// A Policy Definition the Pack adopts, in the order the Pack lists it.
export interface PackViewPolicy {
  name: string;
  description: string | null;
  category: string | null;
  constraintType: string | null;
  scope: string | null;
  environments: string[];
  conditions: Array<{ statement: string; severity: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PackViewData {
  pack: PackRow;
  // The same tab set as the authoring page: the schema's x-groups, Dependencies, and one tab per contribution type.
  groups: FieldGroups;
  content: Record<string, unknown>;
  // Ontology display names per concept type, for every Ontology-backed field the tabs show.
  labels: Record<string, Record<string, string>>;
  // Referenced Service Definitions, Policy Definitions and Packs, keyed by the field's referential source and then by code.
  refs: Record<string, Record<string, PackViewRef>>;
  policies: PackViewPolicy[];
}

function ontologySourcesOf(itemFields: ReferentialListItemField[], into: Set<string>): void {
  for (const f of itemFields) {
    if (f.ontology && f.referentialSource) into.add(f.referentialSource);
    if (f.nestedItemFields) ontologySourcesOf(f.nestedItemFields, into);
  }
}

export function ontologySourcesIn(fields: GeneratedField[]): Set<string> {
  const sources = new Set<string>();
  for (const f of fields) {
    if ((f.kind === "referential-select" || f.kind === "referential-multi-select") && f.ontology && f.referentialSource) sources.add(f.referentialSource);
    if (f.kind === "referential-list") ontologySourcesOf(f.itemFields, sources);
  }
  return sources;
}

// One Pack for the Registry view page. Returns null when the row does not exist or is not visible to the viewer's tenant.
export async function getPackView(id: string, viewer: { isRoot: boolean; tenantId: string | null }): Promise<PackViewData | null> {
  const { data: pack, error } = await packsDB.findById(id);
  if (error) throw error;
  if (!pack) return null;
  const platformTenantId = await getPlatformTenantId();
  if (!viewer.isRoot && pack.tenant_id !== platformTenantId && pack.tenant_id !== viewer.tenantId) return null;
  const { data: pinned } = pack.schema_definition_id ? await schemaDefinitionsDB.findById(pack.schema_definition_id) : { data: null };
  const schemaRow = pinned ?? (await schemaDefinitionsDB.findLatest("Pack")).data;
  if (!schemaRow) throw new Error("no schema_definitions grammar for Pack");
  const schema = schemaRow.schema as JsonSchemaDocument;
  const draft = await getAuthoringDraft("Pack", id);
  if (!draft) return null;
  const content = toSchemaRows(schema, draft.content);
  const fields = generateFields(schema, content);
  const labels: Record<string, Record<string, string>> = {};
  for (const source of ontologySourcesIn(fields)) {
    const concepts = await listConceptsForType(source, viewer);
    labels[source] = Object.fromEntries(concepts.map((c) => [c.code, c.default_label]));
  }
  const tenantId = viewer.tenantId ?? platformTenantId;
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const rowCodes = (v: unknown, key: string): string[] => (Array.isArray(v) ? v.map((r) => (r as Record<string, unknown>)?.[key]).filter((x): x is string => typeof x === "string") : []);
  const refs: Record<string, Record<string, PackViewRef>> = { "service-definition": {}, "capability-name": {}, policy: {}, "pack-code": {} };
  for (const code of new Set(rowCodes(content.contributionServices, "code"))) {
    const { data: service } = await serviceDefinitionsDB.findActiveByCodeVisibleTo(code, tenantId);
    if (service) refs["service-definition"][code] = { name: service.name, note: service.purpose, id: service.id };
  }
  for (const code of new Set(rowCodes(content.contributionCapabilities, "code"))) {
    const { data: capability } = await capabilityDefinitionsDB.findActiveByCodeVisibleTo(code, viewer.tenantId);
    if (capability) refs["capability-name"][code] = { name: capability.default_label, note: capability.description, id: capability.id };
  }
  const policyRows = new Map<string, PolicyDefinitionRow>();
  const policyRefs = new Set([...strings(content.contributionPolicies), ...(Array.isArray(content.contributionQualityGates) ? content.contributionQualityGates.flatMap((g) => strings((g as Record<string, unknown>).requiredPolicyCodes)) : [])]);
  for (const ref of policyRefs) {
    const { data: policy } = UUID.test(ref) ? await policyDefinitionsDB.findById(ref) : await policyDefinitionsDB.findActiveByCodeVisibleTo(ref, tenantId);
    if (policy) {
      refs.policy[ref] = { name: policy.name, note: policy.description };
      policyRows.set(ref, policy);
    }
  }
  const policies: PackViewPolicy[] = strings(content.contributionPolicies).map((ref) => {
    const p = policyRows.get(ref);
    return p
      ? { name: p.name, description: p.description, category: p.category, constraintType: p.constraint_type, scope: p.scope, environments: p.applicability_environments ?? [], conditions: (p.conditions ?? []).map((cond) => ({ statement: cond.statement, severity: cond.severity })) }
      : { name: ref, description: null, category: null, constraintType: null, scope: null, environments: [], conditions: [] };
  });
  for (const code of new Set([...rowCodes(content.dependencies, "packCode"), ...rowCodes(content.compositionSources, "packCode")])) {
    const { data: own } = await packsDB.findActiveByCode(code, tenantId);
    const found = own ?? (await packsDB.findActiveByCode(code, platformTenantId)).data;
    if (found) refs["pack-code"][code] = { name: found.name, note: null };
  }
  return { pack, groups: groupFieldsForDisplay(schema, fields), content, labels, refs, policies };
}
