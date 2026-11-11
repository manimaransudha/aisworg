import { profilesDB } from "../../../dblayer/profilesDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { baseTemplateDeliverables, extractExposedParameterOverrides, resolveEffectiveParameters } from "./profiles.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
import { generateFields, groupFieldsForDisplay, toSchemaRows, type FieldGroups, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { getAuthoringDraft } from "./sdkAuthoring.js";
import { listConceptsForType } from "./ontology.js";
import { ontologySourcesIn, type PackViewRef } from "./packView.js";
import { layoutDependencyGraph, type DependencyGraphLayout } from "./templateView.js";
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
  // The name of the Capability of each Service behind a parameter override, keyed "<sourceType>::<sourceCode>".
  parameterCapabilities: Record<string, string>;
  // Every parameter the base Template exposes, with the Profile's effect on it: omitted, overridden, or the Template's own value.
  parameters: ProfileViewParameter[];
  // The dependency graph drawn in columns, or null when the Profile has none.
  graph: DependencyGraphLayout | null;
}

export interface ProfileViewParameter {
  sourceType: string;
  sourceCode: string;
  parameterName: string;
  value: string;
  state: "omitted" | "overridden" | "template";
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
  // A Profile with no catalogue of its own shows its base Template's, as the authoring form does.
  const ownCatalogue = draft.content.deliverableCatalogue;
  const baseTemplateCode = typeof draft.content.baseTemplateCode === "string" ? draft.content.baseTemplateCode.trim() : "";
  const inherited = !(Array.isArray(ownCatalogue) && ownCatalogue.length > 0) && baseTemplateCode ? await baseTemplateDeliverables(baseTemplateCode, viewer.tenantId) : {};
  const content = toSchemaRows(schema, { ...draft.content, ...inherited });
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
    if (found) {
      const { data: tenant } = await tenantsDB.findById(found.tenant_id);
      refs["template-code"][code] = { name: found.name, note: tenant?.name ?? null, id: found.id };
    }
  }
  // Commented out: no Profile property has list rows with a capabilityCode or a deliverableCode key (the graph uses fromCapabilityCode, the knowledge
  // locations deliverableCodes, the catalogue code), so these two lookups never find a code. refs["capability-name"] and refs["deliverable-name"] stay empty.
  // for (const code of new Set(codesOf("capabilityCode"))) {
  //   const { data: capability } = await capabilityDefinitionsDB.findActiveByCodeVisibleTo(code, viewer.tenantId);
  //   if (capability) refs["capability-name"][code] = { name: capability.default_label, note: capability.description, id: capability.id };
  // }
  // for (const code of new Set(codesOf("deliverableCode"))) {
  //   const { data: deliverable } = await deliverableDefinitionsDB.findActiveByCodeVisibleTo(code, viewer.tenantId);
  //   if (deliverable) refs["deliverable-name"][code] = { name: labels["deliverable-name"]?.[code] ?? code, note: deliverable.description, id: deliverable.id };
  // }
  const rowCodes = (v: unknown, key: string): string[] => (Array.isArray(v) ? v.map((r) => (r as Record<string, unknown>)?.[key]).filter((x): x is string => typeof x === "string") : []);
  for (const code of new Set(rowCodes(content.deliverableCatalogue, "code"))) {
    const { data: deliverable } = await deliverableDefinitionsDB.findActiveByCodeVisibleTo(code, viewer.tenantId);
    if (deliverable) refs["deliverable-name"][code] = { name: labels["deliverable-name"]?.[code] ?? code, note: deliverable.description, id: deliverable.id };
  }
  const capabilityLabels = Object.fromEntries((await listConceptsForType("capability-name", viewer)).map((c) => [c.code, c.default_label]));
  const graph = layoutDependencyGraph(Array.isArray(content.dependencyGraph) ? (content.dependencyGraph as Array<Record<string, unknown>>) : [], rowCodes(content.deliverableCatalogue, "code"), (kind, code) =>
    kind === "Capability"
      ? { label: capabilityLabels[code] ?? code, href: null }
      : { label: labels["deliverable-name"]?.[code] ?? code, href: refs["deliverable-name"][code]?.id ? `/aisworg/seu/deliverable-definitions/${refs["deliverable-name"][code].id}` : null }
  );
  const parameterSources: Record<string, string> = {};
  const parameterCapabilities: Record<string, string> = {};
  const parameters: ProfileViewParameter[] = (await resolveEffectiveParameters(profile)).map((e) => ({
    sourceType: e.sourceType, sourceCode: e.sourceCode, parameterName: e.parameterName, value: e.notRequired ? "" : e.effectiveValue, state: e.notRequired ? "omitted" : e.overriddenByProfile ? "overridden" : "template",
  }));
  // An override whose parameter the Template does not carry a value for is still the Profile's own statement, so it is listed too.
  const listed = new Set(parameters.map((q) => `${q.sourceType}::${q.sourceCode}::${q.parameterName}`));
  for (const o of extractExposedParameterOverrides(profile.draft_content)) {
    if (listed.has(`${o.sourceType}::${o.sourceCode}::${o.parameterName}`)) continue;
    parameters.push({ sourceType: o.sourceType, sourceCode: o.sourceCode, parameterName: o.parameterName, value: o.notRequired ? "" : o.value, state: o.notRequired ? "omitted" : "overridden" });
  }
  // As the authoring form does, a Service Level is listed only when its Service makes a Deliverable of the Profile's catalogue.
  const catalogueCodes = new Set(rowCodes(content.deliverableCatalogue, "code"));
  const shown: ProfileViewParameter[] = [];
  for (const p of parameters) {
    const type = String(p.sourceType ?? "");
    const code = String(p.sourceCode ?? "");
    const { data: source } = type === "service" ? await serviceDefinitionsDB.findActiveByCodeVisibleTo(code, tenantId) : type === "policy" ? await policyDefinitionsDB.findActiveByCodeVisibleTo(code, tenantId) : { data: null };
    if (type === "service" && catalogueCodes.size > 0 && !(source && "outputs" in source && (source.outputs ?? []).some((d: string) => catalogueCodes.has(d)))) continue;
    shown.push(p);
    if (source) parameterSources[`${type}::${code}`] = source.name;
    if (type === "service" && source && "capability_code" in source) {
      const capabilityCode = String(source.capability_code ?? "");
      const { data: capability } = capabilityCode ? await capabilityDefinitionsDB.findActiveByCodeVisibleTo(capabilityCode, tenantId) : { data: null };
      if (capabilityCode) parameterCapabilities[`${type}::${code}`] = capability?.default_label ?? capabilityCode;
    }
  }
  return { profile, groups: groupFieldsForDisplay(schema, fields), content, labels, refs, parameterSources, parameterCapabilities, parameters: shown, graph };
}
