import { profilesDB } from "../../../dblayer/profilesDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
import { generateFields, groupFieldsForDisplay, toSchemaRows, type FieldGroups, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { getAuthoringDraft } from "./sdkAuthoring.js";
import { listConceptsForType } from "./ontology.js";
import { ontologySourcesIn, type PackViewRef } from "./packView.js";
import type { ProfileRow } from "../../../dblayer/seuTypes.js";

export interface ProfileViewData {
  profile: ProfileRow;
  // The same tab set as the authoring page: the schema's x-groups and the Configuration Parameters tab.
  groups: FieldGroups;
  content: Record<string, unknown>;
  labels: Record<string, Record<string, string>>;
  // Referenced Packs, Templates, Capabilities and Deliverables, keyed by referential source and then by code.
  refs: Record<string, Record<string, PackViewRef>>;
  // The name of the Service or Policy behind each parameter override, keyed "<sourceType>::<sourceCode>".
  parameterSources: Record<string, string>;
}

// One Profile for the Registry view page. Returns null when the row does not exist or is not visible to the viewer's tenant.
export async function getProfileView(id: string, viewer: { isRoot: boolean; tenantId: string | null }): Promise<ProfileViewData | null> {
  const { data: profile, error } = await profilesDB.findById(id);
  if (error) throw error;
  if (!profile) return null;
  const platformTenantId = await getPlatformTenantId();
  if (!viewer.isRoot && profile.tenant_id !== platformTenantId && profile.tenant_id !== viewer.tenantId) return null;
  const { data: pinned } = profile.schema_definition_id ? await schemaDefinitionsDB.findById(profile.schema_definition_id) : { data: null };
  const schemaRow = pinned ?? (await schemaDefinitionsDB.findLatest("Profile")).data;
  if (!schemaRow) throw new Error("no schema_definitions grammar for Profile");
  const schema = schemaRow.schema as JsonSchemaDocument;
  const draft = await getAuthoringDraft("Profile", id);
  if (!draft) return null;
  const content = toSchemaRows(schema, draft.content);
  const fields = generateFields(schema, content);
  const labels: Record<string, Record<string, string>> = {};
  for (const source of ontologySourcesIn(fields)) {
    const concepts = await listConceptsForType(source, viewer);
    labels[source] = Object.fromEntries(concepts.map((c) => [c.code, c.default_label]));
  }
  const tenantId = viewer.tenantId ?? platformTenantId;
  // The codes held by a key of every list row, whichever list it is.
  const codesOf = (key: string): string[] =>
    Object.values(content).flatMap((rows) => (Array.isArray(rows) ? rows.map((r) => (r as Record<string, unknown>)?.[key]).filter((x): x is string => typeof x === "string") : []));
  const refs: Record<string, Record<string, PackViewRef>> = { "pack-code": {}, "template-code": {}, "capability-name": {}, "deliverable-name": {} };
  for (const code of new Set(codesOf("packCode"))) {
    const { data: own } = await packsDB.findActiveByCode(code, tenantId);
    const found = own ?? (await packsDB.findActiveByCode(code, platformTenantId)).data;
    if (found) refs["pack-code"][code] = { name: found.name, note: found.category, id: found.id };
  }
  if (typeof content.baseTemplateCode === "string" && content.baseTemplateCode) {
    const code = content.baseTemplateCode;
    const { data: own } = await templatesDB.findActiveByCode(code, tenantId);
    const found = own ?? (await templatesDB.findActiveByCode(code, platformTenantId)).data;
    if (found) refs["template-code"][code] = { name: found.name, note: null, id: found.id };
  }
  for (const code of new Set(codesOf("capabilityCode"))) {
    const { data: capability } = await capabilityDefinitionsDB.findActiveByCodeVisibleTo(code, viewer.tenantId);
    if (capability) refs["capability-name"][code] = { name: capability.default_label, note: capability.description, id: capability.id };
  }
  for (const code of new Set(codesOf("deliverableCode"))) {
    const { data: deliverable } = await deliverableDefinitionsDB.findActiveByCodeVisibleTo(code, viewer.tenantId);
    if (deliverable) refs["deliverable-name"][code] = { name: labels["deliverable-name"]?.[code] ?? code, note: deliverable.description, id: deliverable.id };
  }
  const parameterSources: Record<string, string> = {};
  for (const p of Array.isArray(content.exposedParameterOverrides) ? (content.exposedParameterOverrides as Array<Record<string, unknown>>) : []) {
    const type = String(p.sourceType ?? "");
    const code = String(p.sourceCode ?? "");
    const { data: source } = type === "service" ? await serviceDefinitionsDB.findActiveByCodeVisibleTo(code, tenantId) : type === "policy" ? await policyDefinitionsDB.findActiveByCodeVisibleTo(code, tenantId) : { data: null };
    if (source) parameterSources[`${type}::${code}`] = source.name;
  }
  return { profile, groups: groupFieldsForDisplay(schema, fields), content, labels, refs, parameterSources };
}
