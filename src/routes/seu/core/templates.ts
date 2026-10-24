import { templatesDB } from "../../../dblayer/templatesDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionEntity, publishTransition } from "../../../domain/engine/entityTransition.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { materialiseDependencyGraph, DEFAULT_DELIVERABLE_REQUIRED_STATE } from "../../../domain/engine/materialiseDependencyGraph.js";
import { dependencyDefinitionsDB } from "../../../dblayer/dependencyDefinitionsDB.js";
import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { checklistsDB } from "../../../dblayer/checklistsDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { resolveLabels, validateOntologyFieldsAgainstSchema, validateComposableFieldsAgainstSchema } from "./ontology.js";
import { listTransitionsForEntityType } from "./policyDefinitions.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { toSchemaRows, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import type { CapabilityRow, TemplateDeliverableSeed, TemplateDependencyGraphEntry, TemplateRow } from "../../../dblayer/seuTypes.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
import { nextAvailablePatchVersion as nextAvailableVersion, semverError } from "../../../utils/version.js";

export interface TemplateCandidate {
  id: string;
  code: string;
  name: string;
  satisfies: boolean;
  missingCapabilities: string[];
  requiredCapabilityCount: number;
}

export async function findCandidateTemplates(capabilityCodes: string[], viewerTenantId?: string | null): Promise<TemplateCandidate[]> {
  const { data: templates, error } = await templatesDB.findActiveVisibleTo(viewerTenantId ?? (await getPlatformTenantId()));
  if (error) throw error;

  const candidates: TemplateCandidate[] = [];
  for (const template of templates ?? []) {
    const { data: required } = await templatesDB.getRequiredCapabilities(template.id);
    const templateCodes = new Set((required ?? []).map((c) => c.code));
    const missingCapabilities = capabilityCodes.filter((code) => !templateCodes.has(code));
    candidates.push({
      id: template.id,
      code: template.code,
      name: template.name,
      satisfies: missingCapabilities.length === 0,
      missingCapabilities,
      requiredCapabilityCount: templateCodes.size,
    });
  }
  return candidates.sort((a, b) => a.requiredCapabilityCount - b.requiredCapabilityCount);
}

export interface TemplateSeedInput {
  code: string;
  name: string;
  templateVersion: string;
  compliancePackCodes?: string[];
  domainPackCodes?: string[];
  engineeringPackCodes?: string[];
  integrationPackCodes?: string[];
  organisationPackCodes?: string[];
  technologyPackCodes?: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
  dependencyGraph?: TemplateDependencyGraphEntry[];
  tenantId?: string;
  parentTemplateId?: string | null;
  exposedParameters?: ExposedParameter[];
  purpose?: string;
}

export interface ExposedParameter {
  sourceType: "service" | "policy" | "checklist" | "dependency";
  sourceCode: string;
  parameterName: string;
  value?: string;
  overridable: boolean;
}

export interface ExposableParameterCandidate {
  sourceType: "service" | "policy" | "checklist" | "dependency";
  sourceCode: string;
  sourceName: string;
  parameterName: string;
  parameterLabel: string;
  valueBearing: boolean;
  defaultValue?: string;
  valueOptions?: string[];
}

export function extractExposedParameters(draftContent: Record<string, unknown> | null): ExposedParameter[] | undefined {
  return Array.isArray(draftContent?.exposedParameters) ? (draftContent!.exposedParameters as ExposedParameter[]) : undefined;
}

const POLICY_APPLICABILITY_PARAMETERS: Array<{ name: string; label: string }> = [
  { name: "applicabilityEnvironments", label: "Applicable Environments" },
];

export async function deriveExposableParameterCandidates(
  packCodes: string[],
  viewerTenantId: string,
  dependencyGraph: TemplateDependencyGraphEntry[] = []
): Promise<ExposableParameterCandidate[]> {
  const candidates: ExposableParameterCandidate[] = [];
  const seen = new Set<string>();
  const add = (c: ExposableParameterCandidate) => {
    const key = `${c.sourceType}::${c.sourceCode}::${c.parameterName}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(c);
  };

  for (const entry of dependencyGraph) {
    const fromName = entry.fromType === "Capability" ? entry.fromCapabilityCode : entry.fromCode;
    const sourceCode = `${entry.toCode}::${entry.fromType}::${fromName ?? ""}`;
    add({
      sourceType: "dependency",
      sourceCode,
      sourceName: `"${entry.toCode}" requires ${entry.fromType} "${fromName ?? ""}"`,
      parameterName: "requiredState",
      parameterLabel: "Required State",
      valueBearing: true,
      defaultValue: entry.requiredState ?? "Approved",
    });
  }

  const capabilities = await deriveDedupedCapabilitiesFromPackCodes(packCodes);
  for (const capability of capabilities) {
    const { data: services } = await servicesDB.findByCapabilityId(capability.id);
    for (const service of services ?? []) {
      for (const metric of service.service_level ?? []) {
        add({ sourceType: "service", sourceCode: service.code, sourceName: service.name, parameterName: metric.code, parameterLabel: metric.label, valueBearing: true, defaultValue: String(metric.target) });
      }
    }
  }

  const policyApplicabilityValueOptions: Record<string, string[]> = {
    applicabilityEnvironments: Object.keys(await resolveLabels(viewerTenantId, "category:environment")),
  };
  for (const packCode of packCodes) {
    const { data: policyRows } = await policiesDB.findByPackCode(packCode);
    for (const policyRow of policyRows ?? []) {
      const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo(policyRow.code, viewerTenantId);
      if (!definition) continue;
      add({ sourceType: "policy", sourceCode: definition.code, sourceName: definition.name, parameterName: "constraintType", parameterLabel: "Constraint Type", valueBearing: true, defaultValue: definition.constraint_type, valueOptions: ["Policy", "Standard"] });
      for (const dim of POLICY_APPLICABILITY_PARAMETERS) {
        add({ sourceType: "policy", sourceCode: definition.code, sourceName: definition.name, parameterName: dim.name, parameterLabel: dim.label, valueBearing: false, valueOptions: policyApplicabilityValueOptions[dim.name] });
      }
      for (const cond of definition.conditions) {
        for (const row of cond.applicabilityDeliverables ?? []) {
          const entityType = definition.scope === "Eligibility" ? row.name : "Deliverable";
          add({
            sourceType: "policy",
            sourceCode: `${definition.code}::${row.name}`,
            sourceName: `${definition.name} (${row.name})`,
            parameterName: "transitions",
            parameterLabel: "Transitions",
            valueBearing: false,
            valueOptions: await listTransitionsForEntityType(entityType),
          });
        }
      }
    }
  }

  const dimensionLabelByCode = await resolveLabels(viewerTenantId, "checklist-configurable-dimension");
  const configurableValueOptions = Object.keys(await resolveLabels(viewerTenantId, "checklist-configurable-value"));
  for (const packCode of packCodes) {
    const { data: checklistRows } = await checklistsDB.findByPackCode(packCode);
    for (const checklist of checklistRows ?? []) {
      const keys = new Set((checklist.items ?? []).map((item) => item.configurableKey).filter((k): k is string => !!k?.trim()));
      for (const key of keys) {
        add({ sourceType: "checklist", sourceCode: checklist.id, sourceName: checklist.name, parameterName: key, parameterLabel: dimensionLabelByCode[key] ?? key, valueBearing: false, valueOptions: configurableValueOptions });
      }
    }
  }

  return candidates;
}

export async function deriveOverridableParameterCandidates(baseTemplateCode: string, viewerTenantId: string): Promise<ExposableParameterCandidate[]> {
  const { data: template } = await templatesDB.findActiveByCode(baseTemplateCode, viewerTenantId);
  if (!template) return [];
  const exposed = extractExposedParameters(template.draft_content as Record<string, unknown> | null) ?? [];
  const overridableKeys = new Set(exposed.filter((e) => e.overridable).map((e) => `${e.sourceType}::${e.sourceCode}::${e.parameterName}`));
  if (overridableKeys.size === 0) return [];
  const { data: mandatoryCodes } = await templatesDB.getMandatoryPackCodes(template.id);
  const packCodes = [...new Set(mandatoryCodes ?? [])];
  const dependencyGraph = await getDependencyGraphContent(template.id, viewerTenantId);
  const candidates = await deriveExposableParameterCandidates(packCodes, viewerTenantId, dependencyGraph);
  return candidates.filter((c) => overridableKeys.has(`${c.sourceType}::${c.sourceCode}::${c.parameterName}`));
}

export type TemplateValidationResult = { ok: true } | { ok: false; errors: string[] };


export const PACK_SELECTION_SLOTS: Array<{ field: keyof TemplateSeedInput; listKind: string; packCategory: string }> = [
  { field: "compliancePackCodes", listKind: "compliance", packCategory: "Compliance" },
  { field: "domainPackCodes", listKind: "domain", packCategory: "Domain" },
  { field: "engineeringPackCodes", listKind: "engineering", packCategory: "Engineering" },
  { field: "integrationPackCodes", listKind: "integration", packCategory: "Integration" },
  { field: "organisationPackCodes", listKind: "organisation", packCategory: "Organisation" },
  { field: "technologyPackCodes", listKind: "technology", packCategory: "Technology" },
];

function collectAllPackCodes(seed: TemplateSeedInput): string[] {
  return [...new Set(PACK_SELECTION_SLOTS.flatMap((slot) => (seed[slot.field] as string[] | undefined) ?? []))];
}

export async function deriveCapabilityCodesFromPackCodes(packCodes: string[]): Promise<string[]> {
  const packIds: string[] = [];
  for (const code of packCodes) {
    const { data: pack } = await packsDB.findActiveByCode(code);
    if (pack) packIds.push(pack.id);
  }
  if (packIds.length === 0) return [];
  const { data: capabilities } = await capabilitiesDB.findByOriginatingPackIds(packIds);
  return [...new Set((capabilities ?? []).map((c) => c.code))];
}

const MAX_LINEAGE_HOPS = 20;
async function isRenameOf(childName: string, parentName: string, tenantId: string): Promise<boolean> {
  if (childName === parentName) return true;
  const { data: resolved } = await deliverableDefinitionsDB.findActiveByCode(childName, tenantId);
  let current = resolved ?? null;
  for (let hop = 0; current?.parent_deliverable_definition_id && hop < MAX_LINEAGE_HOPS; hop++) {
    const { data: ancestor } = await deliverableDefinitionsDB.findById(current.parent_deliverable_definition_id);
    if (!ancestor) return false;
    if (ancestor.code === parentName) return true;
    current = ancestor;
  }
  return false;
}

function findDeliverableDependencyCycle(dependencyGraph: TemplateDependencyGraphEntry[]): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const entry of dependencyGraph) {
    if (entry.fromType !== "Deliverable" || !entry.fromCode) continue;
    const list = adjacency.get(entry.fromCode) ?? [];
    list.push(entry.toCode);
    adjacency.set(entry.fromCode, list);
  }

  const UNVISITED = 0, IN_PROGRESS = 1, DONE = 2;
  const state = new Map<string, number>();
  const path: string[] = [];

  function visit(node: string): string[] | null {
    state.set(node, IN_PROGRESS);
    path.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const nextState = state.get(next) ?? UNVISITED;
      if (nextState === IN_PROGRESS) {
        return path.slice(path.indexOf(next)).concat(next);
      }
      if (nextState === UNVISITED) {
        const found = visit(next);
        if (found) return found;
      }
    }
    path.pop();
    state.set(node, DONE);
    return null;
  }

  for (const node of adjacency.keys()) {
    if ((state.get(node) ?? UNVISITED) === UNVISITED) {
      const found = visit(node);
      if (found) return found;
    }
  }
  return null;
}

export async function validateTemplateSeed(seed: TemplateSeedInput, options?: { skipComposableChecks?: boolean }): Promise<TemplateValidationResult> {
  const errors: string[] = [];
  if (!seed.name?.trim()) errors.push("name is required");
  const templateVersionError = semverError("templateVersion", seed.templateVersion);
  if (templateVersionError) errors.push(templateVersionError);
  const templateOntologyViewer = { isRoot: false, tenantId: seed.tenantId ?? (await getPlatformTenantId()) };
  const { data: templateSchemaRow } = await schemaDefinitionsDB.findLatest("Template");
  if (templateSchemaRow) {
    const templateSchema = templateSchemaRow.schema as JsonSchemaDocument;
    const ontologyContent = { code: seed.code, deliverableCatalogue: seed.deliverableCatalogue };
    errors.push(...(await validateOntologyFieldsAgainstSchema(templateSchema, ontologyContent, templateOntologyViewer)));
    if (!options?.skipComposableChecks) {
      errors.push(...(await validateComposableFieldsAgainstSchema(templateSchema, ontologyContent, templateOntologyViewer)));
    }
  }

  for (const slot of PACK_SELECTION_SLOTS) {
    const codes = (seed[slot.field] as string[] | undefined) ?? [];
    for (const code of codes) {
      const { data: pack } = await packsDB.findByCode(code);
      if (!pack) errors.push(`${String(slot.field)} references unknown Pack code "${code}"`);
      else if (pack.category !== slot.packCategory) errors.push(`${String(slot.field)} references Pack "${code}" whose category is "${pack.category}", not "${slot.packCategory}"`);
    }
  }

  const derivedCapabilityCodes = await deriveCapabilityCodesFromPackCodes(collectAllPackCodes(seed));

  const seenDeliverableCodes = new Set<string>((seed.deliverableCatalogue ?? []).map((entry) => entry.code).filter((code) => !!code?.trim()));

  for (const entry of seed.dependencyGraph ?? []) {
    if (!seenDeliverableCodes.has(entry.toCode)) {
      errors.push(`dependencyGraph entry toCode "${entry.toCode}" does not match a deliverableCatalogue entry`);
    }
    if (entry.fromType === "Deliverable") {
      if (!entry.fromCode || !seenDeliverableCodes.has(entry.fromCode)) {
        errors.push(`dependencyGraph entry (toCode "${entry.toCode}") fromCode "${entry.fromCode}" does not match a deliverableCatalogue entry`);
      }
    } else if (entry.fromType === "Capability") {
      if (!entry.fromCapabilityCode || !derivedCapabilityCodes.includes(entry.fromCapabilityCode)) {
        errors.push(`dependencyGraph entry (toCode "${entry.toCode}") fromCapabilityCode "${entry.fromCapabilityCode}" is not among the Capabilities the selected Packs contribute`);
      }
    } else {
      errors.push(`dependencyGraph entry (toCode "${entry.toCode}") has an unrecognised fromType "${entry.fromType}"`);
    }
  }

  errors.push(...(await validateTemplateOnSave(seed)));

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

// The sanity checks the schema cannot carry (CR-128). They run when the form is saved and again when the Template is created.
// Save is not a transition: there is no gate, only an error message.
export async function validateTemplateOnSave(seed: TemplateSeedInput): Promise<string[]> {
  const errors: string[] = [];
  const seenDeliverableCodes = new Set<string>();
  for (const entry of seed.deliverableCatalogue ?? []) {
    if (!entry.code?.trim()) { errors.push("deliverableCatalogue entry is missing a code"); continue; }
    if (seenDeliverableCodes.has(entry.code)) errors.push(`deliverableCatalogue entry "${entry.code}" is a duplicate — codes must be unique within one Template's catalogue`);
    seenDeliverableCodes.add(entry.code);
  }

  const cycle = findDeliverableDependencyCycle(seed.dependencyGraph ?? []);
  if (cycle) {
    errors.push(`dependencyGraph has a circular dependency: ${cycle.join(" → ")}`);
  }

  if (seed.parentTemplateId) {
    const { data: parent } = await templatesDB.findById(seed.parentTemplateId);
    if (!parent) {
      errors.push(`parentTemplateId "${seed.parentTemplateId}" not found`);
    } else {
      if (seed.code !== parent.code) {
        errors.push(`an inherited Template must keep its parent's code ("${parent.code}") — Derived Templates shall not modify parent Templates (Ch.6 §9)`);
      }
      const { data: parentMandatory } = await templatesDB.getMandatoryPackCodes(parent.id);
      const allSeedPackCodes = collectAllPackCodes(seed);
      const missing = (parentMandatory ?? []).filter((code) => !allSeedPackCodes.includes(code));
      if (missing.length > 0) {
        errors.push(`an inherited Template must keep all of its parent's mandatory Packs — missing: ${missing.join(", ")}`);
      }

      const LOCKED_RELATIONSHIP_KINDS = new Set(["implementation", "decomposition"]);
      const parentGraph = await getDependencyGraphContent(parent.id, parent.tenant_id);
      const lockedParentEdges = parentGraph.filter((e) => LOCKED_RELATIONSHIP_KINDS.has(e.relationshipKind ?? "dependency"));
      if (lockedParentEdges.length > 0) {
        const tenantId = seed.tenantId ?? (await getPlatformTenantId());
        const candidateChildEdges = (seed.dependencyGraph ?? []).filter((e) => LOCKED_RELATIONSHIP_KINDS.has(e.relationshipKind ?? "dependency"));
        const consumed = new Set<number>();
        for (const parentEdge of lockedParentEdges) {
          let matched = false;
          for (let i = 0; i < candidateChildEdges.length; i++) {
            if (consumed.has(i)) continue;
            const childEdge = candidateChildEdges[i];
            if (childEdge.relationshipKind !== parentEdge.relationshipKind) continue;
            if ((childEdge.requiredState ?? DEFAULT_DELIVERABLE_REQUIRED_STATE) !== parentEdge.requiredState) continue;
            if (!childEdge.fromCode || !(await isRenameOf(childEdge.fromCode, parentEdge.fromCode ?? "", tenantId))) continue;
            if (!(await isRenameOf(childEdge.toCode, parentEdge.toCode, tenantId))) continue;
            consumed.add(i);
            matched = true;
            break;
          }
          if (!matched) {
            errors.push(`an inherited Template must keep its parent's "${parentEdge.relationshipKind}" edge ("${parentEdge.fromCode}" → "${parentEdge.toCode}") unaltered — either end may be renamed to your own specialised Deliverable Definition, but the edge itself cannot be dropped or restructured`);
          }
        }
      }
    }
  }
  return errors;
}

export type PackSelectionsByCategory = Pick<TemplateSeedInput, "compliancePackCodes" | "domainPackCodes" | "engineeringPackCodes" | "integrationPackCodes" | "organisationPackCodes" | "technologyPackCodes">;

export async function getPackSelectionsByCategory(templateId: string): Promise<PackSelectionsByCategory> {
  const { data: allCodes } = await templatesDB.getMandatoryPackCodes(templateId);
  const result: PackSelectionsByCategory = {};
  for (const slot of PACK_SELECTION_SLOTS) result[slot.field as keyof PackSelectionsByCategory] = [];
  const { data: categories } = await packsDB.findCategoriesByCodes(allCodes ?? []);
  const categoryByCode = new Map((categories ?? []).map((c) => [c.code, c.category]));
  for (const code of allCodes ?? []) {
    const slot = PACK_SELECTION_SLOTS.find((s) => s.packCategory === categoryByCode.get(code));
    if (slot) (result[slot.field as keyof PackSelectionsByCategory] as string[]).push(code);
  }
  return result;
}

export async function getDependencyGraphContent(templateId: string, tenantId: string): Promise<TemplateDependencyGraphEntry[]> {
  const { data: rows } = await dependencyDefinitionsDB.findByOwner("Template", templateId);
  const labelByCode = await resolveLabels(tenantId, "deliverable-name");
  const codeByLabel = new Map(Object.entries(labelByCode).map(([code, label]) => [label, code]));
  const toCode = (label: string) => codeByLabel.get(label) ?? label;
  return (rows ?? []).map((r) => ({
    toCode: toCode(r.to_name),
    fromType: r.from_entity_type as "Deliverable" | "Capability",
    fromCode: r.from_entity_type === "Deliverable" ? toCode(r.from_name ?? "") : (r.from_name ?? ""),
    requiredState: r.from_state,
    relationshipKind: r.relationship_kind,
  }));
}

export async function deriveDedupedCapabilitiesFromPackCodes(packCodes: string[]): Promise<CapabilityRow[]> {
  const packIds: string[] = [];
  for (const code of packCodes) {
    const { data: pack } = await packsDB.findActiveByCode(code);
    if (pack) packIds.push(pack.id);
  }
  if (packIds.length === 0) return [];
  const { data: capabilities } = await capabilitiesDB.findByOriginatingPackIds(packIds);
  const byCode = new Map<string, CapabilityRow>();
  for (const capability of capabilities ?? []) {
    if (!byCode.has(capability.code)) byCode.set(capability.code, capability);
  }
  return [...byCode.values()];
}

async function materialisePackSelectionsAndCapabilities(templateId: string, seed: TemplateSeedInput, authorId: string, authorBadge: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  for (const slot of PACK_SELECTION_SLOTS) {
    const { error: selectionError } = await templatesDB.setPackSelection(templateId, slot.listKind, (seed[slot.field] as string[] | undefined) ?? [], authorId, authorBadge);
    if (selectionError) throw selectionError;
  }
  const capabilities = await deriveDedupedCapabilitiesFromPackCodes(collectAllPackCodes(seed));
  const { error: capabilityError } = await templatesDB.setRequiredCapabilities(templateId, capabilities.map((c) => c.id), authorId, authorBadge);
  if (capabilityError) throw capabilityError;
  const candidates = await deriveExposableParameterCandidates(collectAllPackCodes(seed), seed.tenantId ?? (await getPlatformTenantId()), seed.dependencyGraph ?? []);
  const existingByKey = new Map((seed.exposedParameters ?? []).map((e) => [`${e.sourceType}::${e.sourceCode}::${e.parameterName}`, e]));
  const exposedParameters: ExposedParameter[] = candidates.map((c) => {
    const saved = existingByKey.get(`${c.sourceType}::${c.sourceCode}::${c.parameterName}`);
    return { sourceType: c.sourceType, sourceCode: c.sourceCode, parameterName: c.parameterName, value: saved?.value ?? c.defaultValue, overridable: saved ? saved.overridable : true };
  });
  const { error } = await templatesDB.setDraftContent(templateId, { ...seed, exposedParameters });
  if (error) throw error;
  return { ok: true };
}

// The value of an exposed parameter is one the parameter allows. A row for a parameter the selected Packs do not carry is not an
// error here: the unravel step rebuilds the list from the parameters the Packs carry and drops it (CR-128).
export async function validateExposedParameterValues(seed: TemplateSeedInput): Promise<string[]> {
  const errors: string[] = [];
  const candidates = await deriveExposableParameterCandidates(collectAllPackCodes(seed), seed.tenantId ?? (await getPlatformTenantId()), seed.dependencyGraph ?? []);
  for (const row of seed.exposedParameters ?? []) {
    const candidate = candidates.find((c) => c.sourceType === row.sourceType && c.sourceCode === row.sourceCode && c.parameterName === row.parameterName);
    if (candidate?.valueOptions && row.value && !candidate.valueOptions.includes(row.value)) {
      errors.push(`exposedParameters "${row.parameterName}" on ${row.sourceType} "${row.sourceCode}" has value "${row.value}" — must be one of ${candidate.valueOptions.join(", ")}`);
    }
  }
  return errors;
}

export type PublishTemplateResult = { ok: true; templateId: string } | { ok: false; errors: string[] };

export async function createTemplateDraft(seed: TemplateSeedInput, actorId: string): Promise<{ ok: true; draft: TemplateRow } | { ok: false; errors: string[] }> {
  const validation = await validateTemplateSeed(seed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const tenantId = seed.tenantId ?? (await getPlatformTenantId());

  if (!actorId) return { ok: false, errors: ["publishTemplate requires a real actorId to author the Draft"] };
  const { data: templateMaster } = await participantsMasterDB.findById(actorId);
  if (!templateMaster) return { ok: false, errors: [`No superuser provisioned.`] };

  const { data: templateSchema } = await schemaDefinitionsDB.findLatest("Template");
  if (!templateSchema) return { ok: false, errors: [`no schema_definitions grammar for Template`] };
  const birth = await transitionEngine.beginBirth({ entityType: "Template", actorId });
  const { data: draft, error } = await templatesDB.createDraft({
    code: seed.code,
    name: seed.name,
    templateVersion: seed.templateVersion,
    status: birth.initialState as TemplateRow["status"],
    authoredBy: templateMaster.id,
    authorBadge: birth.authorityBadge,
    tenantId,
    parentTemplateId: seed.parentTemplateId,
    draftContent: toSchemaRows(templateSchema.schema as JsonSchemaDocument, { ...seed }),
    schemaDefinitionId: templateSchema.id,
  });
  if (error || !draft) return { ok: false, errors: [(error ?? new Error("failed to create template draft")).message] };

  await eventBus.publish({
    eventType: birth.eventType,
    originatingObjectType: "Template",
    originatingObjectId: draft.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    actorId: templateMaster.id,
    authorityBadge: birth.authorityBadge,
    payload: { code: draft.code, templateVersion: draft.template_version },
  });
  return { ok: true, draft };
}

// Moves a Template to Active and deprecates the Active version it replaces, both through the generic transition.
export async function activateTemplateSupersedingPrevious(template: TemplateRow, actorId: string): Promise<{ ok: true; template: TemplateRow } | { ok: false; errors: string[] }> {
  const { data: previousActive } = await templatesDB.findActiveByCode(template.code, template.tenant_id);
  const activated = await transitionEntity({ entityType: "Template", entityId: template.id, targetState: "Active", actorId });
  if (!activated.ok) return { ok: false, errors: [`transition to "Active" failed: ${"detail" in activated ? activated.detail : activated.reason}`] };
  await publishTransition(activated);
  if (previousActive && previousActive.id !== template.id) {
    const deprecated = await transitionEntity({ entityType: "Template", entityId: previousActive.id, targetState: "Deprecated", actorId });
    if (deprecated.ok) await publishTransition(deprecated);
  }
  return { ok: true, template: activated.row as TemplateRow };
}

// Walks a Template from Draft, Validated or Published to Active, one transition at a time.
export async function advanceTemplateToActive(template: TemplateRow, actorId: string): Promise<{ ok: true; template: TemplateRow } | { ok: false; errors: string[] }> {
  let current = template;
  for (const targetState of ["Validated", "Published"]) {
    if (current.status === "Active") break;
    if (targetState === "Validated" && current.status !== "Draft") continue;
    if (targetState === "Published" && current.status !== "Validated") continue;
    const result = await transitionEntity({ entityType: "Template", entityId: current.id, targetState, actorId });
    if (!result.ok) return { ok: false, errors: [`transition to "${targetState}" failed: ${"detail" in result ? result.detail : result.reason}`] };
    await publishTransition(result);
    current = result.row as TemplateRow;
  }
  if (current.status !== "Published") return { ok: false, errors: [`Template "${current.code}" is ${current.status} and cannot be advanced to Active`] };
  return activateTemplateSupersedingPrevious(current, actorId);
}

export async function publishTemplate(input: { seed: TemplateSeedInput; actorId: string }): Promise<PublishTemplateResult> {
  const created = await createTemplateDraft(input.seed, input.actorId);
  if (!created.ok) return created;
  const advanced = await advanceTemplateToActive(created.draft, input.actorId);
  if (!advanced.ok) return advanced;
  return { ok: true, templateId: advanced.template.id };
}

async function nextAvailablePatchVersion(code: string, fromVersion: string, tenantId: string): Promise<string> {
  return nextAvailableVersion(fromVersion, async (candidate) => !!(await templatesDB.findByCodeAndVersion(code, candidate, tenantId)).data);
}

export async function copyTemplateAsNewDraft(templateId: string, actorId: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await templatesDB.findById(templateId);
  if (!source) return { ok: false, errors: ["Template not found"] };
  const nextVersion = await nextAvailablePatchVersion(source.code, source.template_version, source.tenant_id);
  const packSelections = await getPackSelectionsByCategory(source.id);
  const purpose = typeof (source.draft_content as Record<string, unknown> | null)?.purpose === "string" ? (source.draft_content as Record<string, unknown>).purpose : undefined;
  const draftContent = {
    code: source.code,
    name: source.name,
    purpose,
    exposedParameters: extractExposedParameters(source.draft_content as Record<string, unknown> | null),
    ...Object.fromEntries(PACK_SELECTION_SLOTS.map((slot) => [slot.field, ((packSelections[slot.field as keyof PackSelectionsByCategory] as string[] | undefined) ?? []).map((packCode) => ({ packCode }))])),
    deliverableCatalogue: source.deliverable_catalogue,
  };
  const { data: copySchema } = source.schema_definition_id ? { data: { id: source.schema_definition_id } } : await schemaDefinitionsDB.findLatest("Template");
  if (!copySchema) return { ok: false, errors: [`no schema_definitions grammar for Template`] };
  const { data: copyMaster } = await participantsMasterDB.findById(actorId);
  if (!copyMaster) return { ok: false, errors: [`No superuser provisioned.`] };
  const birth = await transitionEngine.beginBirth({ entityType: "Template", actorId });
  const { data: newDraft, error } = await templatesDB.createDraft({
    code: source.code,
    name: source.name,
    templateVersion: nextVersion,
    status: birth.initialState as TemplateRow["status"],
    authoredBy: copyMaster.id,
    authorBadge: birth.authorityBadge,
    draftContent,
    tenantId: source.tenant_id,
    parentTemplateId: source.parent_template_id,
    schemaDefinitionId: copySchema.id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Template")).message] };
  await eventBus.publish({
    eventType: birth.eventType,
    originatingObjectType: "Template",
    originatingObjectId: newDraft.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    actorId: copyMaster.id,
    authorityBadge: birth.authorityBadge,
    payload: { code: newDraft.code, templateVersion: newDraft.template_version },
  });
  return { ok: true, draftId: newDraft.id };
}

export async function materialiseTemplateDraft(templateId: string, seed: TemplateSeedInput, authorId: string, authorBadge: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const { error: catalogueError } = await templatesDB.setDeliverableCatalogue(templateId, seed.deliverableCatalogue ?? []);
  if (catalogueError) throw catalogueError;
  const result = await materialisePackSelectionsAndCapabilities(templateId, seed, authorId, authorBadge);
  if (!result.ok) return result;
  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  await materialiseDependencyGraph({
    owningEntityType: "Template",
    owningEntityId: templateId,
    deliverableCatalogue: seed.deliverableCatalogue ?? [],
    dependencyGraph: seed.dependencyGraph ?? [],
    tenantId: seed.tenantId || PLATFORM_TENANT_ID,
    authorId,
    authorBadge,
  });
  return { ok: true };
}

export interface TemplateWithNextStates {
  template: TemplateRow;
  possibleNextStates: string[];
}

export async function listTemplatesWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<TemplateWithNextStates[]> {
  const { data: templates } = viewer && !viewer.isRoot ? await templatesDB.findAllVisibleTo(viewer.tenantId) : await templatesDB.findAll();
  return Promise.all(
    (templates ?? []).map(async (template) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Template", template.status);
      return { template, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
