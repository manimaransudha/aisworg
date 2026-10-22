import { packsDB } from "../../../dblayer/packsDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import {
  activatePackSupersedingPrevious, validatePackSeed, packMetadataFromSeed, findActiveCompositionSource, packCodeVersionSummaries,
  type PackSeedInput,
} from "./packs.js";
import { activateTemplateSupersedingPrevious, validateTemplateOnSave, validateTemplateSeed, getPackSelectionsByCategory, getDependencyGraphContent, PACK_SELECTION_SLOTS, type TemplateSeedInput, type PackSelectionsByCategory } from "./templates.js";
import { activateProfileSupersedingPrevious, validateProfileOnSave, validateProfileSeed, getProfilePackSelections, CONFIGURATION_PARAMETER_FIELDS, type ProfileSeedInput } from "./profiles.js";
import {
  activateDeliverableDefinitionSupersedingPrevious, validateDeliverableDefinitionSeed,
  inheritedDeliverableDefinitionContent,
  type DeliverableDefinitionSeedInput,
} from "./deliverableDefinitions.js";
import {
  validateServiceDefinitionSeed,
  inheritedServiceDefinitionContent,
  type ServiceDefinitionSeedInput,
} from "./serviceDefinitions.js";
import {
  validatePolicyDefinitionSeed,
  inheritedPolicyDefinitionContent,
  type PolicyDefinitionSeedInput,
} from "./policyDefinitions.js";
import {
  validateCapabilityDefinitionSeed,
  inheritedCapabilityDefinitionContent,
  type CapabilityDefinitionSeedInput,
} from "./capabilityDefinitions.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { emitConceptCreated, proposeComposableOntologyValues } from "./ontology.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import type { JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { compositionEngine, type CompositionSource } from "../../../domain/engine/compositionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { listCurrentTransitionDefinitions } from "./transitionDefinitions.js";
import type { CapabilityDefinitionRow, CapabilityRole, DeliverableDefinitionRow, PolicyDefinitionRow, ServiceDefinitionRow, EvidenceDefinition, PackRow, PolicyCondition, ProfileRow, SchemaDefinitionEntityKind, ServiceLevelExpectation, TemplateRow, TransitionEntityType } from "../../../dblayer/seuTypes.js";
import { nextActionsFor, transitionEntity, publishTransition } from "../../../domain/engine/entityTransition.js";
import { packContent } from "../../../domain/engine/entityAdapters.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { randomUUID } from "node:crypto";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { getPlatformTenantId, INITIAL_VERSION, AUTHORING_KIND_ENTITY_TYPE } from "../../../dblayer/constants.js";
 

export function toPackSeedInput(content: Record<string, unknown>): PackSeedInput {
  const legacy = (typeof content.contributions === "object" && content.contributions ? content.contributions : {}) as Record<string, unknown[]>;
  const arr = (flatKey: string, legacyKey: string): unknown[] => {
    const flat = content[flatKey];
    if (Array.isArray(flat) && flat.length) return flat;
    return Array.isArray(legacy[legacyKey]) ? (legacy[legacyKey] as unknown[]) : [];
  };
  const contributions = {
    capabilities: arr("contributionCapabilities", "capabilities"),
    services: normalizeServiceContributions(arr("contributionServices", "services")),
    authorityRules: arr("contributionAuthorityRules", "authorityRules"),
    policies: arr("contributionPolicies", "policies"),
    qualityGates: arr("contributionQualityGates", "qualityGates"),
    checklists: arr("contributionChecklists", "checklists"),
    reviewGates: arr("contributionReviewGates", "reviewGates"),
    obligationDefinitions: arr("contributionObligationDefinitions", "obligationDefinitions"),
    engineeringCapital: arr("contributionEngineeringCapital", "engineeringCapital"),
    competencies: arr("contributionCompetencies", "competencies"),
  } as unknown as PackSeedInput["contributions"];
  return {
    ...(content as unknown as PackSeedInput),
    code: typeof content.code === "string" ? content.code.trim() : "",
    packVersion: typeof content.packVersion === "string" && content.packVersion.trim() ? (content.packVersion as string) : "0.1.0",
    contributions,
    dependencies: (content.dependencies as PackSeedInput["dependencies"]) ?? [],
  };
}

function normalizeReferentialCodes(raw: unknown, itemFieldName: string): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && itemFieldName in entry) return String((entry as Record<string, unknown>)[itemFieldName] ?? "");
      return "";
    })
    .filter((code) => code !== "");
}
function normalizePackCodes(raw: unknown): string[] {
  return normalizeReferentialCodes(raw, "packCode");
}
function normalizeFeatureFlagCodes(raw: unknown): string[] {
  return normalizeReferentialCodes(raw, "featureCode");
}

function normalizeServiceContributions(raw: unknown): Array<{ code: string; serviceDefinitionId: string; serviceLevel: Array<{ code: string; target: number }> }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const levels = Array.isArray(e.serviceLevel) ? e.serviceLevel : [];
    return {
      code: typeof e.code === "string" ? e.code : "",
      serviceDefinitionId: typeof e.serviceDefinitionId === "string" ? e.serviceDefinitionId : "",
      serviceLevel: levels
        .filter((sl): sl is Record<string, unknown> => typeof sl === "object" && sl !== null)
        .map((sl) => ({ code: typeof sl.code === "string" ? sl.code : "", target: typeof sl.target === "number" ? sl.target : Number(sl.target) }))
        .filter((sl) => sl.code && !Number.isNaN(sl.target)),
    };
  });
}

export function toTemplateSeedInput(content: Record<string, unknown>): TemplateSeedInput {
  return {
    ...(content as unknown as TemplateSeedInput),
    code: typeof content.code === "string" && content.code.trim() ? (content.code as string) : randomUUID(),
    templateVersion: typeof content.templateVersion === "string" && content.templateVersion.trim() ? (content.templateVersion as string) : "0.1.0",
    compliancePackCodes: normalizePackCodes(content.compliancePackCodes),
    domainPackCodes: normalizePackCodes(content.domainPackCodes),
    engineeringPackCodes: normalizePackCodes(content.engineeringPackCodes),
    integrationPackCodes: normalizePackCodes(content.integrationPackCodes),
    organisationPackCodes: normalizePackCodes(content.organisationPackCodes),
    technologyPackCodes: normalizePackCodes(content.technologyPackCodes),
    deliverableCatalogue: Array.isArray(content.deliverableCatalogue) ? (content.deliverableCatalogue as TemplateSeedInput["deliverableCatalogue"]) : [],
    dependencyGraph: Array.isArray(content.dependencyGraph) ? (content.dependencyGraph as TemplateSeedInput["dependencyGraph"]) : [],
    exposedParameters: Array.isArray(content.exposedParameters) ? (content.exposedParameters as TemplateSeedInput["exposedParameters"]) : [],
  };
}

export function toProfileSeedInput(content: Record<string, unknown>): ProfileSeedInput {
  return {
    ...(content as unknown as ProfileSeedInput),
    code: typeof content.code === "string" && content.code.trim() ? (content.code as string) : randomUUID(),
    profileVersion: typeof content.profileVersion === "string" && content.profileVersion.trim() ? (content.profileVersion as string) : "0.1.0",
    compositionOptions: (content.compositionOptions as Record<string, unknown>) ?? {},
    optionalPackCodes: normalizePackCodes(content.optionalPackCodes),
    technologyPackCodes: normalizePackCodes(content.technologyPackCodes),
    domainPackCodes: normalizePackCodes(content.domainPackCodes),
    compliancePackCodes: normalizePackCodes(content.compliancePackCodes),
    integrationPackCodes: normalizePackCodes(content.integrationPackCodes),
    engineeringPackCodes: normalizePackCodes(content.engineeringPackCodes),
    organisationPackCodes: normalizePackCodes(content.organisationPackCodes),
    featureFlagCodes: normalizeFeatureFlagCodes(content.featureFlagCodes),
    additionalCapabilityCodes: normalizeReferentialCodes(content.additionalCapabilityCodes, "capabilityCode"),
    deploymentTargets: (content.deploymentTargets as Record<string, unknown>) ?? {},
    participatingOrganisationCodes: normalizeReferentialCodes(content.participatingOrganisationCodes, "organisationCode"),
    environmentConfiguration: (content.environmentConfiguration as Record<string, unknown>) ?? {},
    exposedParameterOverrides: Array.isArray(content.exposedParameterOverrides) ? (content.exposedParameterOverrides as ProfileSeedInput["exposedParameterOverrides"]) : [],
  };
}

export function toDeliverableDefinitionSeedInput(content: Record<string, unknown>): DeliverableDefinitionSeedInput {
  return {
    code: typeof content.code === "string" ? content.code : "",
    description: typeof content.description === "string" ? content.description : undefined,
    definitionVersion: typeof content.definitionVersion === "string" && content.definitionVersion.trim() ? content.definitionVersion.trim() : INITIAL_VERSION,
  };
}

function toServiceLevelExpectations(value: unknown): ServiceLevelExpectation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v): ServiceLevelExpectation => ({
      code: typeof v.code === "string" ? v.code : "",
      label: typeof v.label === "string" ? v.label : "",
      target_level: v.target_level === "maximum" || v.target_level === "exact" ? v.target_level : "minimum",
      target: typeof v.target === "number" ? v.target : Number(v.target) || 0,
      units: typeof v.units === "string" ? v.units : "",
    }))
    .filter((v) => v.code || v.label);
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function toServiceDefinitionSeedInput(content: Record<string, unknown>): ServiceDefinitionSeedInput {
  return {
    code: typeof content.code === "string" ? content.code : "",
    name: typeof content.name === "string" ? content.name : "",
    capabilityCode: typeof content.capabilityCode === "string" ? content.capabilityCode : "",
    purpose: typeof content.purpose === "string" ? content.purpose : undefined,
    inputs: toStringArray(content.inputs),
    outputs: toStringArray(content.outputs),
    serviceLevel: toServiceLevelExpectations(content.serviceLevel),
    governance: typeof content.governance === "string" ? content.governance : undefined,
    success: typeof content.success === "string" ? content.success : undefined,
    consumers: toStringArray(content.consumers),
    version: typeof content.version === "string" && content.version.trim() ? content.version.trim() : INITIAL_VERSION,
  };
}

function toApplicabilityDeliverables(value: unknown): PolicyCondition["applicabilityDeliverables"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => (row && typeof row === "object" ? (row as Record<string, unknown>) : {}))
    .map((row) => ({
      name: typeof row.name === "string" ? row.name : "",
      transitions: Array.isArray(row.transitions) ? row.transitions.filter((t): t is string => typeof t === "string") : [],
      governingCondition: toPolicyGoverningCondition(row.governingCondition),
    }))
    .filter((row) => row.name.trim() !== "");
}

function toEvidenceDefinition(value: unknown): EvidenceDefinition {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    title: typeof v.title === "string" ? v.title : "",
    category: typeof v.category === "string" ? v.category : "",
    description: typeof v.description === "string" ? v.description : "",
    collectionMethod: typeof v.collectionMethod === "string" ? v.collectionMethod : "",
  };
}

function toPolicyRelatedObligations(value: unknown): PolicyCondition["relatedObligations"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      category: typeof v.category === "string" ? v.category : "",
      title: typeof v.title === "string" ? v.title : "",
      description: typeof v.description === "string" ? v.description : "",
      origin: typeof v.origin === "string" ? v.origin : "",
      priority: typeof v.priority === "string" ? v.priority : "",
      severity: typeof v.severity === "string" ? v.severity : "",
      completionCriteria: typeof v.completionCriteria === "string" ? v.completionCriteria : "",
      requiredEvidence: toEvidenceDefinition(v.requiredEvidence),
    }))
    .filter((row) => row.category.trim() !== "");
}

function toPolicyExceptionRules(value: unknown): PolicyCondition["exceptionRules"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      identifier: typeof v.identifier === "string" && v.identifier.trim() ? v.identifier.trim() : randomUUID(),
      exceptionStatement: typeof v.exceptionStatement === "string" ? v.exceptionStatement : "",
      duration: typeof v.duration === "string" ? v.duration : "",
      exceptionScope: typeof v.exceptionScope === "string" ? v.exceptionScope : "",
      exceptionApprovers: Array.isArray(v.exceptionApprovers) ? v.exceptionApprovers.filter((a): a is string => typeof a === "string") : [],
      exceptionComposition: (v.exceptionComposition === "all" || v.exceptionComposition === "any" ? v.exceptionComposition : "") as "all" | "any" | "",
      reviewRequirements: typeof v.reviewRequirements === "string" ? v.reviewRequirements : "",
    }))
    .filter((row) => row.exceptionStatement.trim() !== "");
}

function toPolicyGoverningCondition(value: unknown): Record<string, unknown> | null {
  const parsed = typeof value === "string" ? safeJsonParse(value) : value;
  if (!parsed || typeof parsed !== "object") return null;
  const v = parsed as Record<string, unknown>;
  const type = typeof v.type === "string" ? v.type.trim() : "";
  if (!type) return null;
  if (type === "always_true") return { type: "always_true" };
  const field = typeof v.field === "string" ? v.field.trim() : "";
  if (type === "field_in") {
    const values = Array.isArray(v.values)
      ? v.values.filter((x): x is string => typeof x === "string")
      : typeof v.values === "string"
        ? v.values.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    return { type, field, values };
  }
  if (type === "comparison" || type === "threshold") {
    const operator = typeof v.operator === "string" ? v.operator : "";
    const compareValue = typeof v.value === "string" || typeof v.value === "number" ? v.value : "";
    return { type, field, operator, value: compareValue };
  }
  return null;
}

function toPolicyConditions(value: unknown): PolicyCondition[] {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      statement: typeof v.statement === "string" ? v.statement : "",
      severity: typeof v.severity === "string" ? v.severity : "",
      applicabilityDeliverables: toApplicabilityDeliverables(v.applicabilityDeliverables),
      requiredEvidence: toEvidenceDefinition(v.requiredEvidence),
      relatedObligations: toPolicyRelatedObligations(v.relatedObligations),
      exceptionRules: toPolicyExceptionRules(v.exceptionRules),
    }))
    .filter((row) => row.statement.trim() !== "");
}

export function toPolicyDefinitionSeedInput(content: Record<string, unknown>): PolicyDefinitionSeedInput {
  return {
    code: typeof content.code === "string" ? content.code : "",
    name: typeof content.name === "string" ? content.name : "",
    description: typeof content.description === "string" ? content.description : undefined,
    category: typeof content.category === "string" ? content.category : "",
    constraintType: content.constraintType === "Standard" ? "Standard" : "Policy",
    applicabilityEnvironments: Array.isArray(content.applicabilityEnvironments) ? content.applicabilityEnvironments.filter((c): c is string => typeof c === "string") : [],
    conditions: toPolicyConditions(typeof content.conditions === "string" ? safeJsonParse(content.conditions) : content.conditions),
    scope: content.scope === "Eligibility" ? "Eligibility" : content.scope === "Transition" ? "Transition" : undefined,
    version: typeof content.version === "string" && content.version.trim() ? content.version.trim() : INITIAL_VERSION,
  };
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function toCapabilityRoles(value: unknown): CapabilityRole[] {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      name: typeof v.name === "string" ? v.name : "",
      worktypes: Array.isArray(v.worktypes) ? v.worktypes.filter((w): w is string => typeof w === "string") : [],
    }))
    .filter((row) => row.name.trim() !== "");
}

export function toCapabilityDefinitionSeedInput(content: Record<string, unknown>): CapabilityDefinitionSeedInput {
  return {
    code: typeof content.code === "string" ? content.code : "",
    defaultLabel: typeof content.defaultLabel === "string" ? content.defaultLabel : "",
    description: typeof content.description === "string" ? content.description : undefined,
    category: typeof content.category === "string" ? content.category : "",
    roles: toCapabilityRoles(typeof content.roles === "string" ? safeJsonParse(content.roles) : content.roles),
    version: typeof content.version === "string" && content.version.trim() ? content.version.trim() : INITIAL_VERSION,
  };
}

export async function validateAuthoredContent(kind: SchemaDefinitionEntityKind, content: Record<string, unknown>): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  if (kind === "Pack") return validatePackSeed(toPackSeedInput(content));
  if (kind === "Template") return validateTemplateSeed(toTemplateSeedInput(content));
  if (kind === "Profile") return validateProfileSeed(toProfileSeedInput(content));
  if (kind === "Deliverable") return validateDeliverableDefinitionSeed(toDeliverableDefinitionSeedInput(content));
  if (kind === "Service") return validateServiceDefinitionSeed(toServiceDefinitionSeedInput(content));
  if (kind === "Policy") return validatePolicyDefinitionSeed(toPolicyDefinitionSeedInput(content));
  if (kind === "Capability") return validateCapabilityDefinitionSeed(toCapabilityDefinitionSeedInput(content));
  return { ok: false, errors: [`no validator wired for kind "${kind}"`] };
}

const packRowToContent = packContent;

const NEVER_COMPOSABLE_FIELDS = new Set(["compositionStrategy", "compositionSources", "packVersion", "tenantId"]);

function isEmptyFieldValue(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

export function composableFieldsFromPack(pack: PackRow, opts: { includeIdentity: boolean }): Record<string, unknown> {
  const content = packRowToContent(pack);
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    if (NEVER_COMPOSABLE_FIELDS.has(key)) continue;
    if (key === "code" && !opts.includeIdentity) continue;
    if (isEmptyFieldValue(value)) continue;
    fields[key] = value;
  }
  return fields;
}

export interface AuthoringDraftSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface AuthoringDraft {
  id: string;
  code: string;
  name: string;
  status: string;
  content: Record<string, unknown>;
}

export type AuthoringResult = { ok: true; draftId: string } | { ok: false; errors: string[] };
export type AuthoringActionResult = { ok: true } | { ok: false; errors: string[] };

function toSummary(r: { id: string; code: string; name: string; status: string; created_at: string }): AuthoringDraftSummary {
  return { id: r.id, code: r.code, name: r.name, status: r.status, createdAt: r.created_at };
}

export async function listTenantAuthoringRows(kind: SchemaDefinitionEntityKind, viewer: { isRoot: boolean; tenantId: string | null }): Promise<AuthoringDraftSummary[]> {
  const visible = viewer.isRoot || !viewer.tenantId;
  if (kind === "Pack") {
    const { data } = visible ? await packsDB.findAll() : await packsDB.findAllVisibleTo(viewer.tenantId as string);
    return (data ?? []).map(toSummary);
  }
  if (kind === "Template") {
    const { data } = visible ? await templatesDB.findAll() : await templatesDB.findAllVisibleTo(viewer.tenantId as string);
    return (data ?? []).map(toSummary);
  }
  if (kind === "Profile") {
    const { data } = visible ? await profilesDB.findAll() : await profilesDB.findAllVisibleTo(viewer.tenantId as string);
    return (data ?? []).map(toSummary);
  }
  if (kind === "Deliverable") {
    const { data } = visible ? await deliverableDefinitionsDB.findAll() : await deliverableDefinitionsDB.findAllVisibleTo(viewer.tenantId as string);
    return (data ?? []).map((d) => toSummary({ id: d.id, code: d.code, name: d.code, status: d.status, created_at: d.created_at }));
  }
  if (kind === "Service") {
    const { data } = visible ? await serviceDefinitionsDB.findAll() : await serviceDefinitionsDB.findAllVisibleTo(viewer.tenantId as string);
    return (data ?? []).map((s) => toSummary({ id: s.id, code: s.code, name: s.name, status: s.status, created_at: s.created_at }));
  }
  if (kind === "Policy") {
    const { data } = visible ? await policyDefinitionsDB.findAll() : await policyDefinitionsDB.findAllVisibleTo(viewer.tenantId as string);
    return (data ?? []).map((p) => toSummary({ id: p.id, code: p.code, name: p.name, status: p.status, created_at: p.created_at }));
  }
  if (kind === "Capability") {
    const { data } = visible ? await capabilityDefinitionsDB.findAll() : await capabilityDefinitionsDB.findAllVisibleTo(viewer.tenantId as string);
    return (data ?? []).map((c) => toSummary({ id: c.id, code: c.code, name: c.default_label, status: c.status, created_at: c.created_at }));
  }
  return [];
}

export interface AuthoringRowAction {
  verb: string;
  toState: string;
  endpoint: "publish" | "transition";
  requiresComment: boolean;
}

// The transition entity type of an authoring kind: the kind itself, unless it is named differently in AUTHORING_KIND_ENTITY_TYPE.
export function entityTypeForKind(kind: SchemaDefinitionEntityKind): TransitionEntityType {
  return (AUTHORING_KIND_ENTITY_TYPE as Partial<Record<string, TransitionEntityType>>)[kind] ?? (kind as TransitionEntityType);
}

async function canonicalForwardEdges(kind: SchemaDefinitionEntityKind): Promise<Set<string>> {
  const allTds = await listCurrentTransitionDefinitions();
  const byFromState = new Map<string, Array<{ toState: string }>>();
  for (const d of allTds) {
    if (d.entityType !== entityTypeForKind(kind) || !d.isActive || !d.verb) continue;
    if (!byFromState.has(d.fromState)) byFromState.set(d.fromState, []);
    byFromState.get(d.fromState)!.push({ toState: d.toState });
  }
  const edges = new Set<string>();
  const visited = new Set(["Draft"]);
  let current = "Draft";
  for (;;) {
    const next = (byFromState.get(current) ?? []).find((e) => !visited.has(e.toState));
    if (!next) break;
    edges.add(`${current}->${next.toState}`);
    visited.add(next.toState);
    current = next.toState;
  }
  return edges;
}

async function possibleRowActions(kind: SchemaDefinitionEntityKind, status: string): Promise<AuthoringRowAction[]> {
  const canonical = await canonicalForwardEdges(kind);
  const { data } = await transitionDefinitionsDB.findPossibleNextTransitions(entityTypeForKind(kind), status);
  return (data ?? [])
    .filter((t) => t.verb)
    .map((t) => ({
      verb: t.verb as string,
      toState: t.toState,
      endpoint: (canonical.has(`${status}->${t.toState}`) ? "publish" : "transition") as "publish" | "transition",
      requiresComment: kind === "Pack" && t.toState === "Draft",
    }));
}

export async function computeRowActions(kind: SchemaDefinitionEntityKind, status: string, actorId: string): Promise<AuthoringRowAction[]> {
  if (kind === "Capability" || kind === "Service" || kind === "Pack" || kind === "Template" || kind === "Profile" || kind === "Policy" || kind === "Deliverable") {
    const next = await nextActionsFor(entityTypeForKind(kind), status, actorId);
    return next.map((n) => ({ verb: n.verb, toState: n.toState, endpoint: "transition" as const, requiresComment: n.requiresComment }));
  }
  const actions = await possibleRowActions(kind, status);
  const { isRoot, badgeTypes } = await badgeAuthorityEngine.getHeldBadges(actorId);
  return actions.filter((a) => isRoot || badgeTypes.has(`${entityTypeForKind(kind).toLowerCase()}_${a.verb}`));
}

export async function requiredBadgeForRowAction(kind: SchemaDefinitionEntityKind, status: string, target: { endpoint: "publish" } | { endpoint: "transition"; toState: string }): Promise<string[] | null> {
  const actions = await possibleRowActions(kind, status);
  const action = target.endpoint === "publish" ? actions.find((a) => a.endpoint === "publish") : actions.find((a) => a.toState === target.toState);
  if (!action) return null;
  const canonical = `${entityTypeForKind(kind).toLowerCase()}_${action.verb}`;
  return [canonical];
}

function toPackCodeRows(codes: string[] | undefined): Array<{ packCode: string }> {
  return (codes ?? []).map((packCode) => ({ packCode }));
}
function packSelectionsToFormShape<T extends Record<string, string[] | undefined>>(selections: T): { [K in keyof T]: Array<{ packCode: string }> } {
  const out = {} as { [K in keyof T]: Array<{ packCode: string }> };
  for (const key of Object.keys(selections) as Array<keyof T>) out[key] = toPackCodeRows(selections[key]);
  return out;
}

export async function getAuthoringDraft(kind: SchemaDefinitionEntityKind, id: string): Promise<AuthoringDraft | null> {
  if (kind === "Pack") {
    const { data: pack } = await packsDB.findById(id);
    if (!pack) return null;
    return { id: pack.id, code: pack.code, name: pack.name, status: pack.status, content: packRowToContent(pack) };
  }
  if (kind === "Template") {
    const { data: t } = await templatesDB.findById(id);
    if (!t) return null;
    const materialised = t.status === "Draft" || t.status === "Validated" ? {} : {
      ...packSelectionsToFormShape(await getPackSelectionsByCategory(t.id)),
      deliverableCatalogue: t.deliverable_catalogue,
      dependencyGraph: await getDependencyGraphContent(t.id, t.tenant_id),
    };
    return { id: t.id, code: t.code, name: t.name, status: t.status, content: { code: t.code, name: t.name, ...(t.draft_content ?? {}), ...materialised, templateVersion: t.template_version, tenantId: t.tenant_id, parentTemplateId: t.parent_template_id, schemaVersion: t.schema_definition_id } };
  }
  if (kind === "Profile") {
    const { data: p } = await profilesDB.findById(id);
    if (!p) return null;
    const materialised = p.status === "Draft" || p.status === "Validated" ? {} : packSelectionsToFormShape(await getProfilePackSelections(p.id));
    return { id: p.id, code: p.code, name: p.name, status: p.status, content: { code: p.code, name: p.name, ...(p.draft_content ?? {}), ...materialised, profileVersion: p.profile_version, tenantId: p.tenant_id, parentProfileId: p.parent_profile_id, schemaVersion: p.schema_definition_id } };
  }
  if (kind === "Deliverable") {
    const { data: d } = await deliverableDefinitionsDB.findById(id);
    if (!d) return null;
    return { id: d.id, code: d.code, name: d.code, status: d.status, content: { ...(d.draft_content ?? {}), code: d.code, description: d.description ?? "", definitionVersion: d.version, tenantId: d.tenant_id, parentDeliverableDefinitionId: d.parent_deliverable_definition_id, schemaVersion: d.schema_definition_id } };
  }
  if (kind === "Service") {
    const { data: s } = await serviceDefinitionsDB.findById(id);
    if (!s) return null;
    return {
      id: s.id, code: s.code, name: s.name, status: s.status,
      content: {
        ...(s.draft_content ?? {}), code: s.code, name: s.name, capabilityCode: s.capability_code,
        purpose: s.purpose ?? "", inputs: s.inputs ?? "", outputs: s.outputs ?? "", serviceLevel: s.service_level,
        governance: s.governance ?? "", success: s.success ?? "", consumers: s.consumers, version: s.version,
        tenantId: s.tenant_id, parentServiceDefinitionId: s.parent_service_definition_id, schemaVersion: s.schema_definition_id,
      },
    };
  }
  if (kind === "Policy") {
    const { data: p } = await policyDefinitionsDB.findById(id);
    if (!p) return null;
    return {
      id: p.id, code: p.code, name: p.name, status: p.status,
      content: {
        ...(p.draft_content ?? {}), code: p.code, name: p.name, description: p.description ?? "", category: p.category, constraintType: p.constraint_type,
        applicabilityEnvironments: p.applicability_environments,
        conditions: p.conditions, version: p.version,
        scope: p.scope,
        tenantId: p.tenant_id, parentPolicyDefinitionId: p.parent_policy_definition_id, schemaVersion: p.schema_definition_id,
      },
    };
  }
  if (kind === "Capability") {
    const { data: c } = await capabilityDefinitionsDB.findById(id);
    if (!c) return null;
    return {
      id: c.id, code: c.code, name: c.default_label, status: c.status,
      content: {
        ...(c.draft_content ?? {}), code: c.code, defaultLabel: c.default_label, description: c.description ?? "", category: c.category, roles: c.roles, version: c.version,
        tenantId: c.tenant_id, parentCapabilityDefinitionId: c.parent_capability_definition_id, schemaVersion: c.schema_definition_id,
      },
    };
  }
  return null;
}

export async function listInheritableTemplates(viewerTenantId: string): Promise<Array<{ id: string; code: string; name: string; templateVersion: string }>> {
  const { data: templates } = await templatesDB.findActiveVisibleTo(viewerTenantId);
  return (templates ?? []).map((t) => ({ id: t.id, code: t.code, name: t.name, templateVersion: t.template_version })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function inheritedTemplateContent(parentTemplateId: string, viewerTenantId: string): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  const { data: parent } = await templatesDB.findById(parentTemplateId);
  if (!parent) return { ok: false, error: "parent Template not found" };
  if (parent.status !== "Active") return { ok: false, error: "a Template can only be inherited from an Active Version" };
  if (parent.tenant_id !== PLATFORM_TENANT_ID && parent.tenant_id !== viewerTenantId) {
    return { ok: false, error: "parent Template is not visible to this tenant" };
  }
  const packSelections = await getPackSelectionsByCategory(parent.id);
  const purpose = typeof (parent.draft_content as Record<string, unknown> | null)?.purpose === "string" ? (parent.draft_content as Record<string, unknown>).purpose : undefined;
  return {
    ok: true,
    content: {
      code: parent.code,
      name: parent.name,
      purpose,
      ...Object.fromEntries(PACK_SELECTION_SLOTS.map((slot) => [slot.field, ((packSelections[slot.field as keyof PackSelectionsByCategory] as string[] | undefined) ?? []).map((packCode) => ({ packCode }))])),
      deliverableCatalogue: parent.deliverable_catalogue,
    },
  };
}

const BRANCHABLE_PACK_STATUSES = new Set(["Published", "Active", "Retired", "Archived"]);
export async function inheritedPackVersionContent(fromPackId: string, viewerTenantId: string): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const { data: source } = await packsDB.findById(fromPackId);
  if (!source) return { ok: false, error: "source Pack not found" };
  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  if (source.tenant_id !== viewerTenantId && source.tenant_id !== PLATFORM_TENANT_ID) return { ok: false, error: "source Pack is not this tenant's own" };
  if (!BRANCHABLE_PACK_STATUSES.has(source.status)) return { ok: false, error: `a Pack can only be branched from Published, Active, Retired, or Archived (this one is ${source.status})` };
  const summaries = await packCodeVersionSummaries(viewerTenantId);
  const c = source.contributions ?? {};
  return {
    ok: true,
    content: {
      code: source.code,
      name: source.name,
      category: source.category,
      packVersion: summaries[source.code]?.nextVersion ?? INITIAL_VERSION,
      installationClassification: source.installation_classification,
      contributionCapabilities: c.capabilities ?? [],
      contributionServices: c.services ?? [],
      contributionAuthorityRules: c.authorityRules ?? [],
      contributionPolicies: c.policies ?? [],
      contributionQualityGates: c.qualityGates ?? [],
      contributionChecklists: c.checklists ?? [],
      contributionReviewGates: c.reviewGates ?? [],
      contributionObligationDefinitions: c.obligationDefinitions ?? [],
      contributionEngineeringCapital: c.engineeringCapital ?? [],
      contributionCompetencies: c.competencies ?? [],
      dependencies: source.dependencies,
      compositionSources: source.composition_sources,
    },
  };
}

export async function listInheritableProfiles(viewerTenantId: string): Promise<Array<{ id: string; code: string; name: string; profileVersion: string }>> {
  const { data: profiles } = await profilesDB.findActiveVisibleTo(viewerTenantId);
  return (profiles ?? []).map((p) => ({ id: p.id, code: p.code, name: p.name, profileVersion: p.profile_version })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function inheritedProfileContent(parentProfileId: string, viewerTenantId: string): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const { data: parent } = await profilesDB.findById(parentProfileId);
  if (!parent) return { ok: false, error: "parent Profile not found" };
  if (parent.status !== "Active") return { ok: false, error: "a Profile can only be inherited from an Active Version" };
  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  if (parent.tenant_id !== PLATFORM_TENANT_ID && parent.tenant_id !== viewerTenantId) {
    return { ok: false, error: "parent Profile is not visible to this tenant" };
  }
  const { data: template } = await templatesDB.findById(parent.base_template_id);
  const packSelections = packSelectionsToFormShape(await getProfilePackSelections(parent.id));
  const priorContent = (parent.draft_content ?? {}) as Record<string, unknown>;
  const content: Record<string, unknown> = {
    code: parent.code,
    name: parent.name,
    baseTemplateCode: template?.code ?? "",
    environment: parent.environment,
    description: typeof priorContent.description === "string" ? priorContent.description : "",
    compositionOptions: typeof priorContent.compositionOptions === "object" && priorContent.compositionOptions ? priorContent.compositionOptions : {},
    featureFlagCodes: Array.isArray(priorContent.featureFlagCodes) ? priorContent.featureFlagCodes : [],
    additionalCapabilityCodes: Array.isArray(priorContent.additionalCapabilityCodes) ? priorContent.additionalCapabilityCodes : [],
    deploymentTargets: typeof priorContent.deploymentTargets === "object" && priorContent.deploymentTargets ? priorContent.deploymentTargets : {},
    participatingOrganisationCodes: Array.isArray(priorContent.participatingOrganisationCodes) ? priorContent.participatingOrganisationCodes : [],
    environmentConfiguration: typeof priorContent.environmentConfiguration === "object" && priorContent.environmentConfiguration ? priorContent.environmentConfiguration : {},
    ...packSelections,
  };
  for (const cp of CONFIGURATION_PARAMETER_FIELDS) {
    const priorValue = priorContent[cp.field as string];
    if (typeof priorValue === "string") content[cp.field as string] = priorValue;
  }
  content.exposedParameterOverrides = Array.isArray(priorContent.exposedParameterOverrides) ? priorContent.exposedParameterOverrides : [];
  return { ok: true, content };
}

async function withDefaultTemplatePurpose(content: Record<string, unknown>, code: string, tenantId?: string): Promise<Record<string, unknown>> {
  if (typeof content.purpose === "string" && content.purpose.trim()) return content;
  const { data: concept } = await ontologyDB.findConcept("template-categories", code, { isRoot: false, tenantId: tenantId ?? (await getPlatformTenantId()) });
  if (!concept?.description) return content;
  return { ...content, purpose: concept.description };
}

async function emitConceptCreatedForCompetencies(packId: string, packCode: string, competencies: Array<{ dimension?: string; value?: string }> | undefined, ctx: { actorId: string; badge: string; tenantId?: string }): Promise<void> {
  for (const comp of competencies ?? []) {
    if (!comp.dimension?.trim() || !comp.value?.trim()) continue;
    await emitConceptCreated({ originatingObjectType: "Pack", originatingObjectId: packId, originatingEntityCode: packCode, code: comp.value, conceptType: comp.dimension.toLowerCase(), ...ctx });
  }
}

// The form posts a service by code only. The Pack records the id of the Active Service Definition that code names for
// the tenant, so it pins that exact version. An entry that already carries an id keeps it.
async function stampServiceDefinitionIds(seed: PackSeedInput, tenantId: string): Promise<void> {
  for (const svc of seed.contributions.services ?? []) {
    if (svc.serviceDefinitionId || !svc.code) continue;
    const { data: definition } = await serviceDefinitionsDB.findActiveByCodeVisibleTo(svc.code, tenantId);
    if (definition) svc.serviceDefinitionId = definition.id;
  }
}

export async function createAuthoringDraft(input: { kind: SchemaDefinitionEntityKind; actorId: string; authorBadge: string; tenantId?: string; parentTemplateId?: string; parentProfileId?: string; parentDeliverableDefinitionId?: string; parentServiceDefinitionId?: string; parentPolicyDefinitionId?: string; parentCapabilityDefinitionId?: string; content: Record<string, unknown>; schemaDefinitionId: string }): Promise<AuthoringResult> {
  const authoredBy = input.actorId;
  if (input.kind === "Pack") {
    const seed = toPackSeedInput(input.content);
    await stampServiceDefinitionIds(seed, input.tenantId ?? (await getPlatformTenantId()));
    const { data: packMaster } = await participantsMasterDB.findById(authoredBy);
    if (!packMaster) return { ok: false, errors: [`No superuser provisioned.`] };
    const birth = await transitionEngine.beginBirth({ entityType: "Pack", actorId: input.actorId });
    const { data: pack, error } = await packsDB.create({
      code: seed.code,
      name: (seed.name as string) || "(untitled Pack)",
      category: seed.category,
      packVersion: seed.packVersion,
      installationClassification: seed.installationClassification,
      contributions: seed.contributions,
      dependencies: seed.dependencies,
      compositionSources: seed.compositionSources,
      metadata: packMetadataFromSeed(seed),
      status: birth.initialState as PackRow["status"],
      authoredBy: packMaster.id,
      authorBadge: birth.authorityBadge,
      tenantId: input.tenantId ?? (await getPlatformTenantId()),
      schemaDefinitionId: input.schemaDefinitionId,
    });
    if (error || !pack) return { ok: false, errors: [(error ?? new Error("failed to create Pack draft")).message] };
    const { data: packSchema } = await schemaDefinitionsDB.findById(input.schemaDefinitionId);
    if (packSchema) {
      await proposeComposableOntologyValues(packSchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "Pack", originatingObjectId: pack.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: birth.authorityBadge, tenantId: input.tenantId });
    }
    await emitConceptCreatedForCompetencies(pack.id, seed.code, seed.contributions.competencies, { actorId: input.actorId, badge: birth.authorityBadge, tenantId: input.tenantId });
    await eventBus.publish({
      eventType: birth.eventType,
      originatingObjectType: "Pack",
      originatingObjectId: pack.id,
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      payload: { code: pack.code, packVersion: pack.pack_version },
      actorId: input.actorId,
      authorityBadge: birth.authorityBadge,
    });
    return { ok: true, draftId: pack.id };
  }
  if (input.kind === "Template") {
    let parentTenantCheckError: string | null = null;
    let code = typeof input.content.code === "string" && input.content.code.trim() ? input.content.code.trim() : randomUUID();
    if (input.parentTemplateId) {
      const inherited = await inheritedTemplateContent(input.parentTemplateId, input.tenantId ?? (await getPlatformTenantId()));
      if (!inherited.ok) parentTenantCheckError = inherited.error;
      else code = inherited.content.code as string;
    }
    if (parentTenantCheckError) return { ok: false, errors: [parentTenantCheckError] };
    const templateVersion = typeof input.content.templateVersion === "string" && input.content.templateVersion.trim() ? input.content.templateVersion.trim() : INITIAL_VERSION;
    const tenantId = input.tenantId ?? (await getPlatformTenantId());
    const draftContent = await withDefaultTemplatePurpose({ ...input.content, code }, code, tenantId);
    const { data: templateMaster } = await participantsMasterDB.findById(authoredBy);
    if (!templateMaster) return { ok: false, errors: [`No superuser provisioned.`] };
    const birth = await transitionEngine.beginBirth({ entityType: "Template", actorId: input.actorId });
    const { data: t, error } = await templatesDB.createDraft({ code, name: (draftContent.name as string) || "(untitled Template)", templateVersion, status: birth.initialState as TemplateRow["status"], authoredBy: templateMaster.id, authorBadge: birth.authorityBadge, draftContent, tenantId, parentTemplateId: input.parentTemplateId ?? null, schemaDefinitionId: input.schemaDefinitionId });
    if (error || !t) return { ok: false, errors: [(error ?? new Error("failed to create Template draft")).message] };
    const { data: templateSchema } = await schemaDefinitionsDB.findById(input.schemaDefinitionId);
    if (templateSchema) {
      await proposeComposableOntologyValues(templateSchema.schema as JsonSchemaDocument, draftContent, { originatingObjectType: "Template", originatingObjectId: t.id, originatingEntityCode: code, actorId: input.actorId, badge: birth.authorityBadge, tenantId });
    }
    await eventBus.publish({
      eventType: birth.eventType,
      originatingObjectType: "Template",
      originatingObjectId: t.id,
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      payload: { code: t.code, templateVersion: t.template_version },
      actorId: input.actorId,
      authorityBadge: birth.authorityBadge,
    });
    return { ok: true, draftId: t.id };
  }
  if (input.kind === "Profile") {
    let parentProfileTenantCheckError: string | null = null;
    let code = typeof input.content.code === "string" && input.content.code.trim() ? input.content.code.trim() : randomUUID();
    const tenantId = input.tenantId ?? (await getPlatformTenantId());
    if (input.parentProfileId) {
      const inherited = await inheritedProfileContent(input.parentProfileId, tenantId);
      if (!inherited.ok) parentProfileTenantCheckError = inherited.error;
      else code = inherited.content.code as string;
    }
    if (parentProfileTenantCheckError) return { ok: false, errors: [parentProfileTenantCheckError] };

    const baseTemplateCode = (input.content.baseTemplateCode as string)?.trim();
    if (!baseTemplateCode) return { ok: false, errors: ["a base Template code is required to start a Profile draft"] };
    const { data: template } = await templatesDB.findByCode(baseTemplateCode);
    if (!template) return { ok: false, errors: [`baseTemplateCode "${baseTemplateCode}" not found`] };

    const profileVersion = typeof input.content.profileVersion === "string" && input.content.profileVersion.trim() ? input.content.profileVersion.trim() : INITIAL_VERSION;

    const { data: profileMaster } = await participantsMasterDB.findById(authoredBy);
    if (!profileMaster) return { ok: false, errors: [`No superuser provisioned.`] };
    const birth = await transitionEngine.beginBirth({ entityType: "Profile", actorId: input.actorId });
    const { data: p, error } = await profilesDB.createDraft({
      code,
      name: (input.content.name as string) || "(untitled Profile)",
      baseTemplateId: template.id,
      environment: (input.content.environment as string) || "development",
      status: birth.initialState as ProfileRow["status"],
      authoredBy: profileMaster.id,
      authorBadge: birth.authorityBadge,
      draftContent: { ...input.content, code },
      profileVersion,
      tenantId,
      parentProfileId: input.parentProfileId ?? null,
      schemaDefinitionId: input.schemaDefinitionId,
    });
    if (error || !p) return { ok: false, errors: [(error ?? new Error("failed to create Profile draft")).message] };
    const { data: profileSchema } = await schemaDefinitionsDB.findById(input.schemaDefinitionId);
    if (profileSchema) {
      await proposeComposableOntologyValues(profileSchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "Profile", originatingObjectId: p.id, originatingEntityCode: code, actorId: input.actorId, badge: birth.authorityBadge, tenantId });
    }
    await eventBus.publish({
      eventType: birth.eventType,
      originatingObjectType: "Profile",
      originatingObjectId: p.id,
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      payload: { code: p.code, profileVersion: p.profile_version },
      actorId: input.actorId,
      authorityBadge: birth.authorityBadge,
    });
    return { ok: true, draftId: p.id };
  }
  if (input.kind === "Deliverable") {
    const seed = toDeliverableDefinitionSeedInput(input.content);
    const tenantId = input.tenantId ?? (await getPlatformTenantId());
    if (input.parentDeliverableDefinitionId) {
      const inherited = await inheritedDeliverableDefinitionContent(input.parentDeliverableDefinitionId);
      if (!inherited.ok) return { ok: false, errors: [inherited.error] };
      if (!seed.code) seed.code = inherited.content.code as string;
      if (!seed.description) seed.description = inherited.content.description as string;
    }
    const validation = await validateDeliverableDefinitionSeed({ ...seed, tenantId, parentDeliverableDefinitionId: input.parentDeliverableDefinitionId }, undefined);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    const { data: deliverableMaster } = await participantsMasterDB.findById(authoredBy);
    if (!deliverableMaster) return { ok: false, errors: [`No superuser provisioned.`] };
    const birth = await transitionEngine.beginBirth({ entityType: "DeliverableDefinition", actorId: input.actorId });
    const { data: d, error } = await deliverableDefinitionsDB.createDraft({
      code: seed.code,
      description: seed.description ?? null,
      version: seed.definitionVersion,
      status: birth.initialState as DeliverableDefinitionRow["status"],
      authoredBy: deliverableMaster.id,
      authorBadge: birth.authorityBadge,
      draftContent: input.content,
      tenantId,
      parentDeliverableDefinitionId: input.parentDeliverableDefinitionId ?? null,
      schemaDefinitionId: input.schemaDefinitionId,
    });
    if (error || !d) return { ok: false, errors: [(error ?? new Error("failed to create Deliverable Definition draft")).message] };
    const { data: deliverableSchema } = await schemaDefinitionsDB.findById(input.schemaDefinitionId);
    if (deliverableSchema) {
      await proposeComposableOntologyValues(deliverableSchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "DeliverableDefinition", originatingObjectId: d.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: birth.authorityBadge, tenantId });
    }
    await eventBus.publish({
      eventType: birth.eventType,
      originatingObjectType: "DeliverableDefinition",
      originatingObjectId: d.id,
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      actorId: deliverableMaster.id,
      authorityBadge: birth.authorityBadge,
      versionEvent: birth.versionEvent,
      payload: { code: d.code, version: d.version },
      tenantId,
    });
    return { ok: true, draftId: d.id };
  }
  if (input.kind === "Service") {
    const seed = toServiceDefinitionSeedInput(input.content);
    const tenantId = input.tenantId ?? (await getPlatformTenantId());
    if (input.parentServiceDefinitionId) {
      const inherited = await inheritedServiceDefinitionContent(input.parentServiceDefinitionId);
      if (!inherited.ok) return { ok: false, errors: [inherited.error] };
      if (!seed.code) seed.code = inherited.content.code as string;
      if (!seed.name) seed.name = inherited.content.name as string;
      if (!seed.capabilityCode) seed.capabilityCode = inherited.content.capabilityCode as string;
      if (!seed.purpose) seed.purpose = inherited.content.purpose as string;
    }
    const validation = await validateServiceDefinitionSeed({ ...seed, tenantId, parentServiceDefinitionId: input.parentServiceDefinitionId }, undefined);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    const { data: serviceMaster } = await participantsMasterDB.findById(authoredBy);
    if (!serviceMaster) return { ok: false, errors: [`No superuser provisioned.`] };
    const birth = await transitionEngine.beginBirth({ entityType: "Service", actorId: input.actorId });
    const { data: s, error } = await serviceDefinitionsDB.createDraft({
      code: seed.code,
      name: seed.name,
      capabilityCode: seed.capabilityCode,
      purpose: seed.purpose ?? null,
      inputs: seed.inputs ?? [],
      outputs: seed.outputs ?? [],
      serviceLevel: seed.serviceLevel ?? [],
      governance: seed.governance ?? null,
      success: seed.success ?? null,
      consumers: seed.consumers ?? [],
      version: seed.version,
      status: birth.initialState as ServiceDefinitionRow["status"],
      authoredBy: serviceMaster.id,
      authorBadge: birth.authorityBadge,
      draftContent: input.content,
      tenantId,
      parentServiceDefinitionId: input.parentServiceDefinitionId ?? null,
      schemaDefinitionId: input.schemaDefinitionId,
    });
    if (error || !s) return { ok: false, errors: [(error ?? new Error("failed to create Service Definition draft")).message] };
    await eventBus.publish({
      eventType: birth.eventType,
      originatingObjectType: "Service",
      originatingObjectId: s.id,
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      actorId: serviceMaster.id,
      authorityBadge: birth.authorityBadge,
      versionEvent: birth.versionEvent,
      payload: { code: s.code, version: s.version },
      tenantId,
    });
    return { ok: true, draftId: s.id };
  }
  if (input.kind === "Policy") {
    const seed = toPolicyDefinitionSeedInput(input.content);
    const tenantId = input.tenantId ?? (await getPlatformTenantId());
    if (input.parentPolicyDefinitionId) {
      const inherited = await inheritedPolicyDefinitionContent(input.parentPolicyDefinitionId);
      if (!inherited.ok) return { ok: false, errors: [inherited.error] };
      if (!seed.code) seed.code = inherited.content.code as string;
      if (!seed.name) seed.name = inherited.content.name as string;
      if (!seed.category) seed.category = inherited.content.category as string;
    }
    const validation = await validatePolicyDefinitionSeed({ ...seed, tenantId, parentPolicyDefinitionId: input.parentPolicyDefinitionId }, undefined, true);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    const { data: policyMaster } = await participantsMasterDB.findById(authoredBy);
    if (!policyMaster) return { ok: false, errors: [`No superuser provisioned.`] };
    const birth = await transitionEngine.beginBirth({ entityType: "Policy", actorId: input.actorId });
    const { data: p, error } = await policyDefinitionsDB.createDraft({
      code: seed.code,
      name: seed.name,
      description: seed.description ?? null,
      category: seed.category,
      constraintType: seed.constraintType,
      applicabilityEnvironments: seed.applicabilityEnvironments ?? [],
      conditions: seed.conditions ?? [],
      scope: seed.scope,
      version: seed.version,
      status: birth.initialState as PolicyDefinitionRow["status"],
      authoredBy: policyMaster.id,
      authorBadge: birth.authorityBadge,
      draftContent: input.content,
      tenantId,
      parentPolicyDefinitionId: input.parentPolicyDefinitionId ?? null,
      schemaDefinitionId: input.schemaDefinitionId,
    });
    if (error || !p) return { ok: false, errors: [(error ?? new Error("failed to create Policy Definition draft")).message] };
    const { data: policySchema } = await schemaDefinitionsDB.findById(input.schemaDefinitionId);
    if (policySchema) {
      await proposeComposableOntologyValues(policySchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "Policy", originatingObjectId: p.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: birth.authorityBadge, tenantId });
    }
    await eventBus.publish({
      eventType: birth.eventType,
      originatingObjectType: "Policy",
      originatingObjectId: p.id,
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      actorId: policyMaster.id,
      authorityBadge: birth.authorityBadge,
      versionEvent: birth.versionEvent,
      payload: { code: p.code, version: p.version },
      tenantId,
    });
    return { ok: true, draftId: p.id };
  }
  if (input.kind === "Capability") {
    const seed = toCapabilityDefinitionSeedInput(input.content);
    const tenantId = input.tenantId ?? (await getPlatformTenantId());;
    if (input.parentCapabilityDefinitionId) {
      const inherited = await inheritedCapabilityDefinitionContent(input.parentCapabilityDefinitionId);
      if (!inherited.ok) return { ok: false, errors: [inherited.error] };
      if (!seed.code) seed.code = inherited.content.code as string;
      if (!seed.defaultLabel) seed.defaultLabel = inherited.content.defaultLabel as string;
    }
    const validation = await validateCapabilityDefinitionSeed({ ...seed, tenantId, parentCapabilityDefinitionId: input.parentCapabilityDefinitionId }, undefined);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    const { data: capabilityMaster } = await participantsMasterDB.findById(authoredBy);
    if (!capabilityMaster) return { ok: false, errors: [`No superuser provisioned.`] };
    const birth = await transitionEngine.beginBirth({ entityType: "Capability", actorId: input.actorId });
    const { data: c, error } = await capabilityDefinitionsDB.createDraft({
      code: seed.code,
      defaultLabel: seed.defaultLabel,
      description: seed.description ?? null,
      category: seed.category,
      roles: seed.roles ?? [],
      version: seed.version,
      status: birth.initialState as CapabilityDefinitionRow["status"],
      authoredBy: capabilityMaster.id,
      authorBadge: birth.authorityBadge,
      draftContent: input.content,
      tenantId,
      parentCapabilityDefinitionId: input.parentCapabilityDefinitionId ?? null,
      schemaDefinitionId: input.schemaDefinitionId,
    });
    if (error || !c) return { ok: false, errors: [(error ?? new Error("failed to create Capability Definition draft")).message] };
    const { data: capabilitySchema } = await schemaDefinitionsDB.findById(input.schemaDefinitionId);
    if (capabilitySchema) {
      await proposeComposableOntologyValues(capabilitySchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "Capability", originatingObjectId: c.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: birth.authorityBadge, tenantId });
    }
    await eventBus.publish({
      eventType: birth.eventType,
      originatingObjectType: "Capability",
      originatingObjectId: c.id,
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      actorId: capabilityMaster.id,
      authorityBadge: birth.authorityBadge,
      versionEvent: birth.versionEvent,
      payload: { code: c.code, version: c.version },
      tenantId,
    });
    return { ok: true, draftId: c.id };
  }
  return { ok: false, errors: [`kind "${input.kind}" is not authorable`] };
}

export async function saveAuthoringDraft(input: { kind: SchemaDefinitionEntityKind; id: string; content: Record<string, unknown>; actorId: string }): Promise<AuthoringActionResult> {
  if (input.kind === "Pack") {
    const { data: existingPack } = await packsDB.findById(input.id);
    if (!existingPack) return { ok: false, errors: ["draft not found or no longer editable (only Draft rows can be saved)"] };
    const seed = toPackSeedInput({ ...input.content });
    await stampServiceDefinitionIds(seed, existingPack.tenant_id);
    const { data, error } = await packsDB.updateDraftContent(input.id, {
      code: seed.code,
      name: (seed.name as string) || "(untitled Pack)",
      category: seed.category,
      packVersion: seed.packVersion,
      installationClassification: seed.installationClassification,
      contributions: seed.contributions,
      dependencies: seed.dependencies,
      compositionSources: seed.compositionSources,
      metadata: packMetadataFromSeed(seed),
    });
    if (error) return { ok: false, errors: [error.message] };
    if (!data) return { ok: false, errors: ["draft not found or no longer editable (only Draft rows can be saved)"] };
    const { data: packSchema } = existingPack.schema_definition_id ? await schemaDefinitionsDB.findById(existingPack.schema_definition_id) : await schemaDefinitionsDB.findLatest("Pack");
    if (packSchema) {
      await proposeComposableOntologyValues(packSchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "Pack", originatingObjectId: input.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: "pack_define", tenantId: existingPack.tenant_id });
    }
    await emitConceptCreatedForCompetencies(input.id, seed.code, seed.contributions.competencies, { actorId: input.actorId, badge: "pack_define", tenantId: existingPack.tenant_id });
    return { ok: true };
  }
  if (input.kind === "Template") {
    const { data: existingTemplate } = await templatesDB.findById(input.id);
    if (!existingTemplate) return { ok: false, errors: ["draft not found or no longer editable"] };
    const seed = toTemplateSeedInput({ ...input.content });
    if (existingTemplate.parent_template_id) seed.code = existingTemplate.code;
    seed.tenantId = existingTemplate.tenant_id;
    seed.parentTemplateId = existingTemplate.parent_template_id ?? undefined;
    const saveErrors = await validateTemplateOnSave(seed);
    if (saveErrors.length > 0) return { ok: false, errors: saveErrors };
    const draftContent = await withDefaultTemplatePurpose({ ...input.content, code: seed.code, templateVersion: seed.templateVersion }, seed.code, existingTemplate.tenant_id);
    const { data, error } = await templatesDB.updateDraftContent(input.id, { code: seed.code, name: (draftContent.name as string) || "(untitled Template)", templateVersion: seed.templateVersion, draftContent });
    if (error) return { ok: false, errors: [error.message] };
    if (!data) return { ok: false, errors: ["draft not found or no longer editable"] };
    const { data: templateSchema } = existingTemplate.schema_definition_id ? await schemaDefinitionsDB.findById(existingTemplate.schema_definition_id) : await schemaDefinitionsDB.findLatest("Template");
    if (templateSchema) {
      await proposeComposableOntologyValues(templateSchema.schema as JsonSchemaDocument, draftContent, { originatingObjectType: "Template", originatingObjectId: input.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: "template_define", tenantId: existingTemplate.tenant_id });
    }
    return { ok: true };
  }
  if (input.kind === "Profile") {
    const { data: existingProfile } = await profilesDB.findById(input.id);
    if (!existingProfile) return { ok: false, errors: ["draft not found or no longer editable"] };

    const baseTemplateCode = (input.content.baseTemplateCode as string)?.trim();
    if (!baseTemplateCode) return { ok: false, errors: ["a base Template code is required"] };
    const { data: template } = await templatesDB.findByCode(baseTemplateCode);
    if (!template) return { ok: false, errors: [`baseTemplateCode "${baseTemplateCode}" not found`] };

    const seed = toProfileSeedInput({ ...input.content });
    if (existingProfile.parent_profile_id) seed.code = existingProfile.code;
    seed.tenantId = existingProfile.tenant_id;
    seed.parentProfileId = existingProfile.parent_profile_id ?? undefined;
    const saveErrors = await validateProfileOnSave(seed);
    if (saveErrors.length > 0) return { ok: false, errors: saveErrors };

    const { data, error } = await profilesDB.updateDraftContent(input.id, {
      name: (input.content.name as string) || "(untitled Profile)",
      baseTemplateId: template.id,
      environment: (input.content.environment as string) || "development",
      draftContent: { ...input.content, code: seed.code },
      profileVersion: seed.profileVersion,
    });
    if (error) return { ok: false, errors: [error.message] };
    if (!data) return { ok: false, errors: ["draft not found or no longer editable"] };
    const { data: profileSchema } = existingProfile.schema_definition_id ? await schemaDefinitionsDB.findById(existingProfile.schema_definition_id) : await schemaDefinitionsDB.findLatest("Profile");
    if (profileSchema) {
      await proposeComposableOntologyValues(profileSchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "Profile", originatingObjectId: input.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: "profile_define", tenantId: existingProfile.tenant_id });
    }
    return { ok: true };
  }
  if (input.kind === "Deliverable") {
    const { data: existing } = await deliverableDefinitionsDB.findById(input.id);
    if (!existing) return { ok: false, errors: ["draft not found or no longer editable (only Draft rows can be saved)"] };
    const seed = toDeliverableDefinitionSeedInput({ ...input.content });
    const validation = await validateDeliverableDefinitionSeed({ ...seed, tenantId: existing.tenant_id, parentDeliverableDefinitionId: existing.parent_deliverable_definition_id ?? undefined }, input.id);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    const { data, error } = await deliverableDefinitionsDB.updateDraftContent(input.id, { code: seed.code, description: seed.description ?? null, version: seed.definitionVersion, draftContent: input.content });
    if (error) return { ok: false, errors: [error.message] };
    if (!data) return { ok: false, errors: ["draft not found or no longer editable (only Draft rows can be saved)"] };
    const { data: deliverableSchema } = existing.schema_definition_id ? await schemaDefinitionsDB.findById(existing.schema_definition_id) : await schemaDefinitionsDB.findLatest("Deliverable");
    if (deliverableSchema) {
      await proposeComposableOntologyValues(deliverableSchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "DeliverableDefinition", originatingObjectId: input.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: existing.author_badge, tenantId: existing.tenant_id });
    }
    return { ok: true };
  }
  if (input.kind === "Service") {
    const { data: existing } = await serviceDefinitionsDB.findById(input.id);
    if (!existing) return { ok: false, errors: ["draft not found or no longer editable (only Defined rows can be saved)"] };
    const seed = toServiceDefinitionSeedInput({ ...input.content });
    const validation = await validateServiceDefinitionSeed({ ...seed, tenantId: existing.tenant_id, parentServiceDefinitionId: existing.parent_service_definition_id ?? undefined }, input.id);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    const { data, error } = await serviceDefinitionsDB.updateDraftContent(input.id, {
      code: seed.code, name: seed.name, capabilityCode: seed.capabilityCode, purpose: seed.purpose ?? null, inputs: seed.inputs ?? [],
      outputs: seed.outputs ?? [], serviceLevel: seed.serviceLevel ?? [], governance: seed.governance ?? null, success: seed.success ?? null,
      consumers: seed.consumers ?? [], version: seed.version, draftContent: input.content,
    });
    if (error) return { ok: false, errors: [error.message] };
    if (!data) return { ok: false, errors: ["draft not found or no longer editable (only Defined rows can be saved)"] };
    return { ok: true };
  }
  if (input.kind === "Policy") {
    const { data: existing } = await policyDefinitionsDB.findById(input.id);
    if (!existing) return { ok: false, errors: ["draft not found or no longer editable (only Draft rows can be saved)"] };
    const seed = toPolicyDefinitionSeedInput({ ...input.content });
    const validation = await validatePolicyDefinitionSeed({ ...seed, tenantId: existing.tenant_id, parentPolicyDefinitionId: existing.parent_policy_definition_id ?? undefined }, input.id, true);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    const { data, error } = await policyDefinitionsDB.updateDraftContent(input.id, {
      code: seed.code, name: seed.name, description: seed.description ?? null, category: seed.category, constraintType: seed.constraintType,
      applicabilityEnvironments: seed.applicabilityEnvironments ?? [],
      conditions: seed.conditions ?? [],
      scope: seed.scope,
      version: seed.version, draftContent: input.content,
    });
    if (error) return { ok: false, errors: [error.message] };
    if (!data) return { ok: false, errors: ["draft not found or no longer editable (only Draft rows can be saved)"] };
    const { data: policySchema } = existing.schema_definition_id ? await schemaDefinitionsDB.findById(existing.schema_definition_id) : await schemaDefinitionsDB.findLatest("Policy");
    if (policySchema) {
      await proposeComposableOntologyValues(policySchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "Policy", originatingObjectId: input.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: "policy_define", tenantId: existing.tenant_id });
    }
    return { ok: true };
  }
  if (input.kind === "Capability") {
    const { data: existing } = await capabilityDefinitionsDB.findById(input.id);
    if (!existing) return { ok: false, errors: ["draft not found or no longer editable (only Defined rows can be saved)"] };
    const seed = toCapabilityDefinitionSeedInput({ ...input.content });
    const validation = await validateCapabilityDefinitionSeed({ ...seed, tenantId: existing.tenant_id, parentCapabilityDefinitionId: existing.parent_capability_definition_id ?? undefined }, input.id);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    const { data, error } = await capabilityDefinitionsDB.updateDraftContent(input.id, {
      code: seed.code, defaultLabel: seed.defaultLabel, description: seed.description ?? null, category: seed.category, roles: seed.roles ?? [], version: seed.version, draftContent: input.content,
    });
    if (error) return { ok: false, errors: [error.message] };
    if (!data) return { ok: false, errors: ["draft not found or no longer editable (only Defined rows can be saved)"] };
    const { data: capabilitySchema } = existing.schema_definition_id ? await schemaDefinitionsDB.findById(existing.schema_definition_id) : { data: null };
    if (capabilitySchema) {
      await proposeComposableOntologyValues(capabilitySchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "Capability", originatingObjectId: input.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: existing.author_badge, tenantId: existing.tenant_id });
    }
    return { ok: true };
  }
  return { ok: false, errors: [`kind "${input.kind}" is not authorable`] };
}

export type AdvanceAuthoringDraftResult = { ok: true; status: string } | { ok: false; errors: string[] };

export async function publishAuthoringDraft(input: { kind: SchemaDefinitionEntityKind; id: string; actorId: string }): Promise<AdvanceAuthoringDraftResult> {
  if (input.kind === "Pack") {
    const { data: pack } = await packsDB.findById(input.id);
    if (!pack) return { ok: false, errors: ["Pack draft not found"] };
    const next = await nextActionsFor("Pack", pack.status, input.actorId);
    if (next.length !== 1) return { ok: false, errors: [`Pack is ${pack.status} — ${next.length === 0 ? "no further authoring step" : "more than one next step, choose one"}`] };
    if (next[0].toState === "Active") {
      const activated = await activatePackSupersedingPrevious(pack, input.actorId);
      if (!activated.ok || !activated.pack) return { ok: false, errors: activated.errors ?? ["advance failed"] };
      return { ok: true, status: activated.pack.status };
    }
    const advanced = await transitionEntity({ entityType: "Pack", entityId: pack.id, targetState: next[0].toState, actorId: input.actorId });
    if (!advanced.ok) return { ok: false, errors: ["detail" in advanced ? advanced.detail : advanced.reason] };
    await publishTransition(advanced);
    return { ok: true, status: advanced.appliedTransition.toState };
  }
  if (input.kind === "Template") {
    const { data: t } = await templatesDB.findById(input.id);
    if (!t) return { ok: false, errors: ["Template draft not found"] };
    const next = await nextActionsFor("Template", t.status, input.actorId);
    if (next.length !== 1) return { ok: false, errors: [`Template is ${t.status} — ${next.length === 0 ? "no further authoring step" : "more than one next step, choose one"}`] };
    if (next[0].toState === "Active") {
      const activated = await activateTemplateSupersedingPrevious(t, input.actorId);
      if (!activated.ok) return activated;
      return { ok: true, status: activated.template.status };
    }
    const advanced = await transitionEntity({ entityType: "Template", entityId: t.id, targetState: next[0].toState, actorId: input.actorId });
    if (!advanced.ok) return { ok: false, errors: ["detail" in advanced ? advanced.detail : advanced.reason] };
    await publishTransition(advanced);
    return { ok: true, status: advanced.appliedTransition.toState };
  }
  if (input.kind === "Profile") {
    const { data: p } = await profilesDB.findById(input.id);
    if (!p) return { ok: false, errors: ["Profile draft not found"] };
    const next = await nextActionsFor("Profile", p.status, input.actorId);
    if (next.length !== 1) return { ok: false, errors: [`Profile is ${p.status} — ${next.length === 0 ? "no further authoring step" : "more than one next step, choose one"}`] };
    if (next[0].toState === "Active") {
      const activated = await activateProfileSupersedingPrevious(p, input.actorId);
      if (!activated.ok) return activated;
      return { ok: true, status: activated.profile.status };
    }
    const advanced = await transitionEntity({ entityType: "Profile", entityId: p.id, targetState: next[0].toState, actorId: input.actorId });
    if (!advanced.ok) return { ok: false, errors: ["detail" in advanced ? advanced.detail : advanced.reason] };
    await publishTransition(advanced);
    return { ok: true, status: advanced.appliedTransition.toState };
  }
  if (input.kind === "Deliverable") {
    const { data: d } = await deliverableDefinitionsDB.findById(input.id);
    if (!d) return { ok: false, errors: ["Deliverable Definition draft not found"] };
    const next = await nextActionsFor("DeliverableDefinition", d.status, input.actorId);
    if (next.length !== 1) return { ok: false, errors: [`Deliverable Definition is ${d.status} — ${next.length === 0 ? "no further authoring step" : "more than one next step, choose one"}`] };
    if (next[0].toState === "Active") {
      const activated = await activateDeliverableDefinitionSupersedingPrevious(d, input.actorId);
      if (!activated.ok) return activated;
      return { ok: true, status: activated.deliverableDefinition.status };
    }
    const advanced = await transitionEntity({ entityType: "DeliverableDefinition", entityId: d.id, targetState: next[0].toState, actorId: input.actorId });
    if (!advanced.ok) return { ok: false, errors: ["detail" in advanced ? advanced.detail : advanced.reason] };
    await publishTransition(advanced);
    return { ok: true, status: advanced.appliedTransition.toState };
  }
  if (input.kind === "Service") {
    const { data: s } = await serviceDefinitionsDB.findById(input.id);
    if (!s) return { ok: false, errors: ["Service Definition draft not found"] };
    const next = await nextActionsFor("Service", s.status, input.actorId);
    if (next.length !== 1) return { ok: false, errors: [`Service Definition is ${s.status} — ${next.length === 0 ? "no further authoring step" : "more than one next step, choose one"}`] };
    const advanced = await transitionEntity({ entityType: "Service", entityId: s.id, targetState: next[0].toState, actorId: input.actorId });
    if (!advanced.ok) return { ok: false, errors: ["detail" in advanced ? advanced.detail : advanced.reason] };
    await publishTransition(advanced);
    return { ok: true, status: advanced.appliedTransition.toState };
  }
  if (input.kind === "Policy") {
    const { data: p } = await policyDefinitionsDB.findById(input.id);
    if (!p) return { ok: false, errors: ["Policy Definition draft not found"] };
    const next = await nextActionsFor("Policy", p.status, input.actorId);
    if (next.length !== 1) return { ok: false, errors: [`Policy Definition is ${p.status} — ${next.length === 0 ? "no further authoring step" : "more than one next step, choose one"}`] };
    const advanced = await transitionEntity({ entityType: "Policy", entityId: p.id, targetState: next[0].toState, actorId: input.actorId });
    if (!advanced.ok) return { ok: false, errors: ["detail" in advanced ? advanced.detail : advanced.reason] };
    await publishTransition(advanced);
    return { ok: true, status: advanced.appliedTransition.toState };
  }
  if (input.kind === "Capability") {
    const { data: c } = await capabilityDefinitionsDB.findById(input.id);
    if (!c) return { ok: false, errors: ["Capability Definition draft not found"] };
    const next = await nextActionsFor("Capability", c.status, input.actorId);
    if (next.length !== 1) return { ok: false, errors: [`Capability Definition is ${c.status} — ${next.length === 0 ? "no further authoring step" : "more than one next step, choose one"}`] };
    const advanced = await transitionEntity({ entityType: "Capability", entityId: c.id, targetState: next[0].toState, actorId: input.actorId });
    if (!advanced.ok) return { ok: false, errors: ["detail" in advanced ? advanced.detail : advanced.reason] };
    await publishTransition(advanced);
    return { ok: true, status: advanced.appliedTransition.toState };
  }
  return { ok: false, errors: [`kind "${input.kind}" is not authorable`] };
}

export type ComposeAuthoringDraftResult =
  | { ok: true; composedFrom: string[]; conflicts: string[]; note?: string }
  | { ok: false; errors: string[] };

export async function composeAuthoringDraft(input: { kind: SchemaDefinitionEntityKind; id: string; actorId: string }): Promise<ComposeAuthoringDraftResult> {
  if (input.kind !== "Pack") return { ok: false, errors: [`composition is not yet available for "${input.kind}"`] };

  const { data: draftPack } = await packsDB.findById(input.id);
  if (!draftPack) return { ok: false, errors: ["draft not found"] };
  if (draftPack.status !== "Draft") return { ok: false, errors: ["only a Draft can be composed"] };

  const strategy = typeof draftPack.metadata?.compositionStrategy === "string" ? (draftPack.metadata.compositionStrategy as string) : "";
  if (!strategy.trim()) return { ok: false, errors: ["choose a Composition Strategy before composing"] };
  if (strategy === "conflict-detection") {
    return { ok: false, errors: [`"Conflict Detection" is not an independent Composition Strategy — it activates automatically inside Merge/Union.`] };
  }

  const sourceCodes = (draftPack.composition_sources ?? []).map((s) => s.packCode).filter((c) => c?.trim());
  const req = compositionEngine.strategyRequirements(strategy);
  if (sourceCodes.length < req.minSources || (req.maxSources != null && sourceCodes.length > req.maxSources)) {
    const arity = req.maxSources == null ? `at least ${req.minSources}` : req.minSources === req.maxSources ? `exactly ${req.minSources}` : `${req.minSources}-${req.maxSources}`;
    return { ok: false, errors: [`Composition Strategy "${strategy}" requires ${arity} composition source(s), got ${sourceCodes.length}.`] };
  }
  if (req.sameCodeRequired && new Set(sourceCodes).size > 1) {
    return { ok: false, errors: [`Composition Strategy "${strategy}" requires every composition source to share the same code — got: ${sourceCodes.join(", ")}.`] };
  }

  if (strategy === "override") {
    return {
      ok: true,
      composedFrom: [],
      conflicts: [],
      note: `Override reuses this Pack's own normal version-bump flow — use "Next version" to publish a new Version of this same code; the prior Active Version is superseded automatically.`,
    };
  }

  const resolved: PackRow[] = [];
  for (const code of sourceCodes) {
    const sourcePack = await findActiveCompositionSource(code, draftPack.tenant_id);
    if (!sourcePack) return { ok: false, errors: [`composition source Pack "${code}" has no Active Version.`] };
    resolved.push(sourcePack);
  }

  let composedFields: Record<string, unknown>;
  let conflicts: string[] = [];
  if (strategy === "specialization") {
    const parent = resolved[0];
    const result = compositionEngine.specialize({ id: parent.id, code: parent.code, fields: composableFieldsFromPack(parent, { includeIdentity: true }) });
    composedFields = result.fields;
  } else {
    const sources: CompositionSource[] = resolved.map((p) => ({ id: p.id, code: p.code, fields: composableFieldsFromPack(p, { includeIdentity: false }) }));
    if (strategy === "merge") {
      const result = compositionEngine.merge(sources);
      if (!result.ok) return { ok: false, errors: [result.error] };
      composedFields = result.fields;
      conflicts = result.conflicts;
    } else if (strategy === "union") {
      const result = compositionEngine.union(sources);
      if (!result.ok) return { ok: false, errors: [result.error] };
      composedFields = result.fields;
      conflicts = result.conflicts;
    } else if (strategy === "intersection") {
      const result = compositionEngine.intersection(sources);
      if (!result.ok) return { ok: false, errors: [result.error] };
      composedFields = result.fields;
    } else if (strategy === "supplement") {
      const [base, ...supplements] = sources;
      const result = compositionEngine.supplement(base, supplements);
      if (!result.ok) return { ok: false, errors: [result.error] };
      composedFields = result.fields;
      if (result.rejected.length) {
        conflicts = result.rejected.map((k) => `"${k}" already exists on the base Pack — a Supplement can only add, never override or remove; this field was not applied.`);
      }
    } else {
      return { ok: false, errors: [`unknown Composition Strategy "${strategy}"`] };
    }
  }

  const newContent = { ...packRowToContent(draftPack), ...composedFields };
  const saved = await saveAuthoringDraft({ kind: "Pack", id: input.id, content: newContent, actorId: input.actorId });
  if (!saved.ok) return { ok: false, errors: saved.errors };
  return { ok: true, composedFrom: sourceCodes, conflicts };
}
