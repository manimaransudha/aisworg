// SDK authoring — ENTITY-DIRECT (bug fix correcting CR-014).
//
// There is no separate "SDK authoring" mechanism and no Deliverable
// indirection. Authoring a Pack / Template / Profile is just working on a
// **Draft row of that entity itself**, then driving it through the entity's own
// governed `noun × verb` transitions — run by the **real session actor**, with
// the actor + `noun_verb` badge captured on every event (Part 1). No bootstrap
// SEU, no authoring Deliverable/Evidence, no system actor, no double gate.
//
// Authority is the authored entity's own noun × verb (root bypasses):
//   `{kind}_define`  — create/edit/save a Draft (creation authority; a grant,
//                      not a transition — see the "creation authority is not a
//                      transition" note).
//   `{kind}_publish` — publish: the governed transition to Active. All three
//     kinds now share the exact same seven-state lifecycle and the same
//     (code, version, tenant) immutable-version identity (Pack: migration
//     010/044/063; Template: CR-024/CR-026; Profile: 2026-08-19, mirroring
//     both). The authorisation model is identical for all three — NOT a
//     special authoring path.
import { packsDB } from "../../../dblayer/packsDB.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import {
  advancePackOneStep, validatePackSeed, packMetadataFromSeed, findActiveCompositionSource, packCodeVersionSummaries, alternateBadgesForPackTransition,
  type PackSeedInput,
} from "./packs.js";
import { advanceTemplateOneStep, materialiseTemplateDraft, validateTemplateSeed, getPackSelectionsByCategory, getDependencyGraphContent, PACK_SELECTION_SLOTS, type TemplateSeedInput, type PackSelectionsByCategory } from "./templates.js";
import { advanceProfileOneStep, materialiseProfileDraft, validateProfileSeed, getProfilePackSelections, CONFIGURATION_PARAMETER_FIELDS, type ProfileSeedInput } from "./profiles.js";
import {
  advanceDeliverableDefinitionOneStep, validateDeliverableDefinitionSeed,
  inheritedDeliverableDefinitionContent,
  type DeliverableDefinitionSeedInput,
} from "./deliverableDefinitions.js";
import {
  advanceServiceDefinitionOneStep, validateServiceDefinitionSeed,
  inheritedServiceDefinitionContent,
  type ServiceDefinitionSeedInput,
} from "./serviceDefinitions.js";
import {
  advancePolicyDefinitionOneStep, validatePolicyDefinitionSeed,
  inheritedPolicyDefinitionContent,
  type PolicyDefinitionSeedInput,
} from "./policyDefinitions.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { emitOntologyComposed, proposeComposableOntologyValues } from "./ontology.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import type { JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { compositionEngine, type CompositionSource } from "../../../domain/engine/compositionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { listCurrentTransitionDefinitions } from "./transitionDefinitions.js";
import type { EvidenceDefinition, PackContributions, PackRow, PolicyCondition, ProfileRow, SchemaDefinitionEntityKind, ServiceLevelExpectation, TemplateRow, TransitionEntityType } from "../../../dblayer/seuTypes.js";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Content reassembly (unchanged from the previous flattened-form handling).
// ---------------------------------------------------------------------------

// The generated form (and JSON import) can omit contributions/dependencies —
// normalize before handing off to validatePackSeed/publishPack. CR-016:
// contributions are authored as flattened top-level lists (contributionCapabilities[],
// …) — reassemble into the nested `contributions` object.
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
    // CR-099 — same hand-written flatten every other contribution kind needs here.
    competencies: arr("contributionCompetencies", "competencies"),
  } as unknown as PackSeedInput["contributions"];
  return {
    ...(content as unknown as PackSeedInput),
    // CR-015 ("`code` is a system UUID") is DEPRECATED — superseded by CR-020
    // Part 2 (Ontology-backed `capability-name` picker) and CR-046 (real
    // server-side enforcement of it). See CR-015's own Update note. Every real
    // path already supplies its own code (the picker, a seed/CLI .pack.json's
    // own code, or an imported doc's own code) — a missing/blank code here is
    // a caller error, left as-is for validatePackSeed's assertCanonicalCategory
    // to reject with a real message, not papered over with a meaningless UUID
    // that would fail that same check anyway. Confirmed live 2026-08-29: no
    // Pack, any status, has ever had a UUID code.
    // Dead code removed: code: ... ? content.code : randomUUID()
    code: typeof content.code === "string" ? content.code.trim() : "",
    packVersion: typeof content.packVersion === "string" && content.packVersion.trim() ? (content.packVersion as string) : "0.1.0",
    contributions,
    dependencies: (content.dependencies as PackSeedInput["dependencies"]) ?? [],
  };
}

// Real finding: mandatoryPackCodes/optionalPackCodes use x-widget:"referential-list"
// so the generated form submits [{ packCode }] — normalize to the string[] the
// seed types expect (JSON import already submits plain strings, unaffected).
// Generalised (owner, 2026-08-19) for Profile's featureFlagCodes, whose item
// field is `featureCode`, not `packCode` — same shape, different key.
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

// CR-086 follow-on — contributionServices[].serviceLevel is now Pack-side
// TARGET OVERRIDES only ({code, target}, owner: "these fields do not have to
// be stored"). parseReferentialListField (formGenerator.ts) stringifies
// every non-array/non-boolean item field regardless of its own declared
// schema type (target's own "type":"number" isn't special-cased there,
// same reason toServiceLevelExpectations below has to coerce Service
// Definition's own serviceLevel target) — so a form-submitted target arrives
// as a string here and needs the same Number(...) coercion before
// core/packs.ts compares/merges it against the Definition's own numeric
// target.
function normalizeServiceContributions(raw: unknown): Array<{ code: string; serviceLevel: Array<{ code: string; target: number }> }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const levels = Array.isArray(e.serviceLevel) ? e.serviceLevel : [];
    return {
      code: typeof e.code === "string" ? e.code : "",
      serviceLevel: levels
        .filter((sl): sl is Record<string, unknown> => typeof sl === "object" && sl !== null)
        .map((sl) => ({ code: typeof sl.code === "string" ? sl.code : "", target: typeof sl.target === "number" ? sl.target : Number(sl.target) }))
        .filter((sl) => sl.code && !Number.isNaN(sl.target)),
    };
  });
}

// Owner: "Why is code not auto generated? There is a Name field that can be
// entered by user more descriptively" — CR-015's own deferred question
// ("Template/Profile codes are out of scope here (decide separately)").
// *Stale as of CR-021, corrected here rather than silently*: `code` is no
// longer a system UUID — it's a required Ontology-backed dropdown
// (template-categories, Ch.18), same treatment Pack's own `code` got in
// CR-020 Part 2. The randomUUID() fallback below stays only as a defensive
// default for a JSON import/CLI path that omits it entirely — never what the
// interactive form submits.
export function toTemplateSeedInput(content: Record<string, unknown>): TemplateSeedInput {
  return {
    ...(content as unknown as TemplateSeedInput),
    code: typeof content.code === "string" && content.code.trim() ? (content.code as string) : randomUUID(),
    // CR-024 — same fallback shape as toPackSeedInput's packVersion.
    templateVersion: typeof content.templateVersion === "string" && content.templateVersion.trim() ? (content.templateVersion as string) : "0.1.0",
    // Defensive against a non-array value reaching here (e.g. a JSON import —
    // a first-class entry point, not just the generated form) — an object or
    // other truthy non-array would otherwise survive `?? []` and blow up the
    // first `for...of` that iterates it.
    // CR-038 — requiredCapabilityCodes/mandatoryPackCodes are gone; six
    // category-scoped Pack fields replace the flat one (same
    // normalizePackCodes row-unwrapping every other referential-list Pack
    // field already uses).
    compliancePackCodes: normalizePackCodes(content.compliancePackCodes),
    domainPackCodes: normalizePackCodes(content.domainPackCodes),
    engineeringPackCodes: normalizePackCodes(content.engineeringPackCodes),
    integrationPackCodes: normalizePackCodes(content.integrationPackCodes),
    organisationPackCodes: normalizePackCodes(content.organisationPackCodes),
    technologyPackCodes: normalizePackCodes(content.technologyPackCodes),
    deliverableCatalogue: Array.isArray(content.deliverableCatalogue) ? (content.deliverableCatalogue as TemplateSeedInput["deliverableCatalogue"]) : [],
    // CR-041 — the dependency graph, authored as its own field (not embedded
    // per deliverableCatalogue entry).
    dependencyGraph: Array.isArray(content.dependencyGraph) ? (content.dependencyGraph as TemplateSeedInput["dependencyGraph"]) : [],
    // CR-088 — Exposable Parameters tab, same defensive shape.
    exposedParameters: Array.isArray(content.exposedParameters) ? (content.exposedParameters as TemplateSeedInput["exposedParameters"]) : [],
  };
}

// Owner, 2026-08-19: "19.2 and 19.3 has to be fixed similar to pack and
// template" + "all missing fields have to be fixed at schema level" — Profile
// gets the same code/version fallback shape toTemplateSeedInput already has,
// plus normalisation for every new referential-list field §7 added
// (featureFlagCodes keyed by featureCode; the four category-scoped Pack
// lists keyed by packCode, same as optionalPackCodes always was).
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
    // CR-091 — the other two of Pack's six real category:pack values.
    engineeringPackCodes: normalizePackCodes(content.engineeringPackCodes),
    organisationPackCodes: normalizePackCodes(content.organisationPackCodes),
    featureFlagCodes: normalizeFeatureFlagCodes(content.featureFlagCodes),
    // CR-091 — same referential-list normalisation as featureFlagCodes, keyed
    // off additionalCapabilityCodes[].capabilityCode.
    additionalCapabilityCodes: normalizeReferentialCodes(content.additionalCapabilityCodes, "capabilityCode"),
    deploymentTargets: (content.deploymentTargets as Record<string, unknown>) ?? {},
    // CR-091 Part 2 — Ch.7 §10 Configuration Parameters. The eight
    // single-value referential-select fields (targetCloudProvider, ...)
    // need no individual normalisation here — they're plain strings, already
    // carried through correctly by the initial spread above, same as
    // environment/baseTemplateCode/description.
    participatingOrganisationCodes: normalizeReferentialCodes(content.participatingOrganisationCodes, "organisationCode"),
    environmentConfiguration: (content.environmentConfiguration as Record<string, unknown>) ?? {},
    // CR-088 Profile-side completion — reconstructProfileParameterOverrides
    // (web/sdkAuthoring.ts) already reassembles this into a real array before
    // parseFormBody runs, same treatment as Template's own exposedParameters
    // (toTemplateSeedInput).
    exposedParameterOverrides: Array.isArray(content.exposedParameterOverrides) ? (content.exposedParameterOverrides as ProfileSeedInput["exposedParameterOverrides"]) : [],
  };
}

// CR-049 — same code/version fallback shape as toTemplateSeedInput.
// parentDeliverableDefinitionId is not schema content — it rides alongside,
// same as toTemplateSeedInput never reads parentTemplateId off `content`.
export function toDeliverableDefinitionSeedInput(content: Record<string, unknown>): DeliverableDefinitionSeedInput {
  return {
    code: typeof content.code === "string" ? content.code : "",
    description: typeof content.description === "string" ? content.description : undefined,
    definitionVersion: typeof content.definitionVersion === "string" && content.definitionVersion.trim() ? content.definitionVersion.trim() : "1.0.0",
  };
}

// CR-086/Ch.11 follow-on (migration 155) — serviceLevel is a real nested-list
// field now (one object per measurable expectation), not free text. Loosely
// validated here (right shape, right primitive types per field) — full
// enum/required-field enforcement is validateServiceDefinitionSeed's job.
function toServiceLevelExpectations(value: unknown): ServiceLevelExpectation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    // Explicit per-element return type — without it, target_level's ternary
    // (each branch a string literal) gets widened to plain `string` by the
    // object-literal-in-.map() inference TS applies here, which no longer
    // satisfies ServiceLevelExpectation's own literal union.
    .map((v): ServiceLevelExpectation => ({
      code: typeof v.code === "string" ? v.code : "",
      label: typeof v.label === "string" ? v.label : "",
      target_level: v.target_level === "maximum" || v.target_level === "exact" ? v.target_level : "minimum",
      target: typeof v.target === "number" ? v.target : Number(v.target) || 0,
      units: typeof v.units === "string" ? v.units : "",
    }))
    .filter((v) => v.code || v.label);
}

// Bug fix — migration 159 made inputs/outputs a referential-multi-select
// against deliverable-name (the same treatment `consumers` already gets
// against capability-name, just below), but this parser kept treating them
// as a bare string ever since — a real multi-select post (an array) could
// never be captured, silently landing as `undefined` every time.
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
    version: typeof content.version === "string" && content.version.trim() ? content.version.trim() : "1.0.0",
  };
}

// Migration 216 (owner: "I am inclined to move the applicability inside the
// condition") — applicabilityDeliverables moved from a Policy-level field
// into each condition; parseFormBody already produces Array<{name,
// transitions}> shaped rows for it regardless of nesting depth (the same
// referential-list machinery, one level deeper), so this only guards
// against a malformed/missing value reaching the seed. Migration 219
// (owner: "The governing condition should be within applicability
// deliverables") — each row now carries its own governingCondition,
// assembled by the same toPolicyGoverningCondition used to fold it (used to
// live one level up, on the condition itself).
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

// Ch.17 §8's Definition-side Evidence shape (seuTypes.ts's EvidenceDefinition)
// — owner: "Evidence definition has to be a common model and used in Policy
// [and] Obligations." Two call sites: Policy's own conditions[].requiredEvidence
// directly, and ObligationDefinition's own requiredEvidence (below), which
// reaches both of ObligationDefinition's own call sites without a separate
// mechanism. parseFormBody (formGenerator.ts) already reassembles a form
// submission into this exact nested shape (blank template rows already
// filtered out); only loosely shape-checked here — full field-by-field
// validation (including the Ontology check on category) is
// validatePolicyDefinitionSeed's own job.
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

// Owner: "identifier: system generated" — assigned here (the one place
// every save path for `conditions` passes through), not client-side, so a
// row that never reaches a real save never gets one either.
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
      exceptionComposition: (v.exceptionComposition === "all" || v.exceptionComposition === "any") ? v.exceptionComposition : "",
      reviewRequirements: typeof v.reviewRequirements === "string" ? v.reviewRequirements : "",
    }))
    .filter((row) => row.exceptionStatement.trim() !== "");
}

// Migration 216 — governingCondition folded in (owner: "Governing condition
// has to be folded into condition. this will be governed. If it is empty,
// the policy checking will be manual") — left null/undefined here rather
// than defaulted to {"type":"always_true"}, so packs.ts's own materialization
// can tell "explicitly always_true" apart from "author left this manual" if
// it ever needs to (today both behave the same at evaluation time).
//
// Migration 218 (owner: "make the GoverningCondition UI user friendly and
// not a json edit") — governingCondition is now a structured nested-object
// form ({type, field, operator, values, value}, values a comma-separated
// STRING as authored), assembled back into the real {"type":...} shape
// governingConditionTypes.ts's CONDITION_EVALUATORS expect. Two input
// shapes reach this function: the form-submitted one just described, and
// the real condition object already in its final shape (seed data/inherit/
// copy-as-new-draft, e.g. {"type":"field_in","field":"x","values":["a","b"]}
// with `values` a real array) — both handled without assuming either one.
function toPolicyGoverningCondition(value: unknown): Record<string, unknown> | null {
  const parsed = typeof value === "string" ? safeJsonParse(value) : value;
  if (!parsed || typeof parsed !== "object") return null;
  const v = parsed as Record<string, unknown>;
  const type = typeof v.type === "string" ? v.type.trim() : "";
  if (!type) return null; // no type chosen — manual/human-attested
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
  return null; // unrecognised type — same "fails closed" discipline evaluateCondition itself uses
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
    version: typeof content.version === "string" && content.version.trim() ? content.version.trim() : "1.0.0",
  };
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Structural + referential validation, per kind.
export async function validateAuthoredContent(kind: SchemaDefinitionEntityKind, content: Record<string, unknown>): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  if (kind === "Pack") return validatePackSeed(toPackSeedInput(content));
  if (kind === "Template") return validateTemplateSeed(toTemplateSeedInput(content));
  if (kind === "Profile") return validateProfileSeed(toProfileSeedInput(content));
  if (kind === "Deliverable") return validateDeliverableDefinitionSeed(toDeliverableDefinitionSeedInput(content));
  if (kind === "Service") return validateServiceDefinitionSeed(toServiceDefinitionSeedInput(content));
  if (kind === "Policy") return validatePolicyDefinitionSeed(toPolicyDefinitionSeedInput(content));
  return { ok: false, errors: [`no validator wired for kind "${kind}"`] };
}

// ---------------------------------------------------------------------------
// The Draft row as an authoring document — reconstruct the form-shaped content.
// ---------------------------------------------------------------------------
function packRowToContent(pack: PackRow): Record<string, unknown> {
  const c = (pack.contributions ?? {}) as PackContributions & Record<string, unknown[]>;
  return {
    code: pack.code,
    name: pack.name,
    category: pack.category,
    packVersion: pack.pack_version,
    installationClassification: pack.installation_classification,
    // CR-022: without this, re-validating at publish time (below) would
    // default to Platform-only Ontology visibility regardless of the Pack's
    // real owning tenant, since toPackSeedInput has no other source for it.
    tenantId: pack.tenant_id,
    contributionCapabilities: c.capabilities ?? [],
    contributionServices: c.services ?? [],
    contributionAuthorityRules: c.authorityRules ?? [],
    contributionPolicies: c.policies ?? [],
    contributionQualityGates: c.qualityGates ?? [],
    contributionChecklists: (c as Record<string, unknown[]>).checklists ?? [],
    contributionReviewGates: (c as Record<string, unknown[]>).reviewGates ?? [],
    contributionObligationDefinitions: (c as Record<string, unknown[]>).obligationDefinitions ?? [],
    contributionEngineeringCapital: (c as Record<string, unknown[]>).engineeringCapital ?? [],
    // CR-099 — packs.contributions stores the short key `competencies`;
    // same hand-written remap every other contribution kind needs here.
    contributionCompetencies: (c as Record<string, unknown[]>).competencies ?? [],
    dependencies: pack.dependencies ?? [],
    // CR-067 — the referential-list widget shape ({packCode}), same as
    // dependencies above.
    compositionSources: pack.composition_sources ?? [],
    ...(pack.metadata ?? {}),
  };
}

// CR-067 — the field snapshot a composition source Pack contributes to
// Specialization/Merge/Union/Intersection/Supplement: packRowToContent's own
// form-shaped fields, minus whatever must never be blindly copied/combined.
// `compositionStrategy`/`compositionSources` are this DRAFT's own choices,
// never the parent's. `packVersion`/`tenantId` are NEVER carried — every
// strategy "starts at version 1.0.0" (owned by whoever authors the new
// Draft, not inherited). `code` is the one strategy-dependent field:
// Specialization's own "creation is an exact copy of the parent" explicitly
// includes it (changeable afterward); Merge/Union/Intersection/Supplement
// never touch it — the resulting Draft keeps its own code regardless of what
// its sources are named.
const NEVER_COMPOSABLE_FIELDS = new Set(["compositionStrategy", "compositionSources", "packVersion", "tenantId"]);

// packRowToContent's own flat shape always emits the SAME key set for every
// Pack (contributionCapabilities, dependencies, etc. default to [], unset
// metadata strings default to "") — "key present" is therefore never a
// meaningful "this Pack actually declares it" signal on its own; every real
// Pack would otherwise collide on ~a dozen structurally-shared-but-empty
// keys. Bug fix, caught by a real test (a Supplement flagging 13 "rejected"
// fields instead of the one genuine collision): omit empty values entirely
// before handing fields to the generic engine, so "present in only one
// source" (Merge/Union's own "combines unambiguously" case) and "the base
// doesn't already have this" (Supplement's own additive rule) both mean what
// they're supposed to — a field this Pack actually set, not just a key its
// shape happens to always carry.
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

// --- Tenant authoring rows (the whole authoring index list) -----------------
// Every row visible to this viewer's tenant (+ Platform), at whatever status
// it's currently sitting at — root sees every tenant's. Originally scoped to
// ONLY the real actor's own authored_by (an "I defined" tab, plus a separate
// per-verb cross-author "Queue" tab for others' rows the viewer could act
// on); the tabs were replaced by one flat list, initially still author-
// scoped. Reopened author-scoping entirely (owner, 2026-08-30: "I do not see
// the packs that are validated within the tenant" — logged in as a
// pack_publish-only actor, someone else's row, correctly badge-gated to act
// on, but simply never listed here at all. Owner: "If that is meant for
// authoring, then that page / page registry should not be visible to any
// other badge. It just gets messy. For now, let us display all the packs
// belonging to the tenant + platform.") — same visibility rule as the Pack
// Registry (packsDB.findAllVisibleTo) and every other cross-tenant list on
// this authoring surface (loadReferentialOptions, loadActivePackDependencyOptions).
// findDrafts is deliberately NOT reused here — it's hardcoded to WHERE
// status IN ('Draft', 'Validated') (this actor's current WIP only), not
// "every status."
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
  return [];
}

// Owner: "I want to change the packs list Pack authoring-All packs similar to
// Objectives. List the tenant scope+platform packs as a list with action
// buttons corresponding to the badge." Confirmed with the owner: applies to
// every grammar-authored kind sharing this page (Pack/Template/Profile/
// Deliverable — not just Pack); the tab structure (an "I defined" tab plus a
// separate cross-author "Queue" tab per verb) is replaced entirely by one
// flat list, tenant + Platform scoped (listTenantAuthoringRows above). Each
// row shows every governed transition the viewer currently
// holds the badge for, off THAT row's own current status — mirroring
// Objectives' own hasObjectiveBadge(node.verb) pattern.
export interface AuthoringRowAction {
  verb: string;
  toState: string;
  // /publish advances exactly one step along the canonical Draft -> ... ->
  // Active path (each kind's own AUTHORING_NEXT_STATE map), including Pack's
  // Draft-only structural-validation gate. /transition is the generic,
  // explicit-targetState route — everything else: post-Active governance
  // (Template/Profile/Deliverable still have their older reactivation-
  // capable lifecycle, CR-080 only simplified Pack's) and Pack's own Reject
  // (Validated -> Draft, the one transition anywhere requiring a comment).
  endpoint: "publish" | "transition";
  requiresComment: boolean;
}

// The canonical Draft -> ... -> Active forward walk for one kind, as a set of
// "fromState->toState" edges — the same walk buildAuthoringTabs used to build
// its own tab ordering (now removed along with the tabs themselves), kept
// here because computeRowActions still needs it to tell "the one canonical
// next step" (-> /publish) apart from any other real, governed edge off the
// same status (-> /transition), without hardcoding each kind's own
// AUTHORING_NEXT_STATE map (core/packs.ts, core/templates.ts, etc. each keep
// their own private copy already — this derives the same shape generically,
// from the real transition_definitions graph, so it works for any kind
// without importing four separate private maps).
async function canonicalForwardEdges(kind: SchemaDefinitionEntityKind): Promise<Set<string>> {
  const allTds = await listCurrentTransitionDefinitions();
  const byFromState = new Map<string, Array<{ toState: string }>>();
  for (const d of allTds) {
    if (d.entityType !== kind || !d.isActive || !d.verb) continue;
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

// Every real, governed edge off this status, unfiltered by who's asking —
// the single source of truth both computeRowActions (filters by the
// viewer's own held badges, for button rendering) and
// requiredBadgeForRowAction (web/sdkAuthoring.ts's /publish + /transition
// route guard, which needs the UNFILTERED badge a given action requires,
// before it knows whether the actor holds it) resolve from.
async function possibleRowActions(kind: SchemaDefinitionEntityKind, status: string): Promise<AuthoringRowAction[]> {
  const canonical = await canonicalForwardEdges(kind);
  const { data } = await transitionDefinitionsDB.findPossibleNextTransitions(kind as TransitionEntityType, status);
  return (data ?? [])
    .filter((t) => t.verb)
    .map((t) => ({
      verb: t.verb as string,
      toState: t.toState,
      endpoint: (canonical.has(`${status}->${t.toState}`) ? "publish" : "transition") as "publish" | "transition",
      requiresComment: kind === "Pack" && t.toState === "Draft",
    }));
}

export async function computeRowActions(kind: SchemaDefinitionEntityKind, status: string, held: Set<string>, isRoot: boolean): Promise<AuthoringRowAction[]> {
  const actions = await possibleRowActions(kind, status);
  return actions.filter((a) => {
    if (isRoot) return true;
    const canonical = `${kind.toLowerCase()}_${a.verb}`;
    if (held.has(canonical)) return true;
    const alternates = kind === "Pack" ? alternateBadgesForPackTransition(status, a.toState) : undefined;
    return (alternates ?? []).some((b) => held.has(b));
  });
}

// web/sdkAuthoring.ts's /publish + /transition route guard: resolves the
// FULL set of badges that would satisfy a specific row action (the
// canonical noun_verb, plus any alternates this exact transition declares —
// same table transitionPack's own transitionEngine.evaluate call reads, so
// the route gate and the actual enforcement can never name a different
// acceptable set), purely from (kind, status[, targetState]) — the same
// DB-derived shape possibleRowActions already computes for button rendering.
// /publish has no targetState (it's always the one canonical next hop);
// /transition's targetState comes from the request body. Returns null when
// there's no such governed edge — the caller denies (fails closed), same as
// authority_denied would.
export async function requiredBadgeForRowAction(kind: SchemaDefinitionEntityKind, status: string, target: { endpoint: "publish" } | { endpoint: "transition"; toState: string }): Promise<string[] | null> {
  const actions = await possibleRowActions(kind, status);
  const action = target.endpoint === "publish" ? actions.find((a) => a.endpoint === "publish") : actions.find((a) => a.toState === target.toState);
  if (!action) return null;
  const canonical = `${kind.toLowerCase()}_${action.verb}`;
  const alternates = kind === "Pack" ? alternateBadgesForPackTransition(status, action.toState) : undefined;
  return alternates?.length ? [canonical, ...alternates] : [canonical];
}

// CR-045 follow-up — getPackSelectionsByCategory/getProfilePackSelections
// return the SEED-level shape (a bare string[] of Pack codes, what
// TemplateSeedInput/ProfileSeedInput and validate*Seed actually consume) —
// but the FORM/schema-level shape a referential-list field's own item
// properties expect (generateFields/parseFormBody) is an array of {packCode}
// objects, matching the migration 077/078/066 schema exactly. Without this
// conversion, generateFields reads row["packCode"] off a bare string and
// gets undefined every time — every resolved code silently renders as
// blank/"None" even though the row genuinely exists.
function toPackCodeRows(codes: string[] | undefined): Array<{ packCode: string }> {
  return (codes ?? []).map((packCode) => ({ packCode }));
}
function packSelectionsToFormShape<T extends Record<string, string[] | undefined>>(selections: T): { [K in keyof T]: Array<{ packCode: string }> } {
  const out = {} as { [K in keyof T]: Array<{ packCode: string }> };
  for (const key of Object.keys(selections) as Array<keyof T>) out[key] = toPackCodeRows(selections[key]);
  return out;
}

// --- Get one draft (form-shaped content) ------------------------------------
export async function getAuthoringDraft(kind: SchemaDefinitionEntityKind, id: string): Promise<AuthoringDraft | null> {
  if (kind === "Pack") {
    const { data: pack } = await packsDB.findById(id);
    if (!pack) return null;
    return { id: pack.id, code: pack.code, name: pack.name, status: pack.status, content: packRowToContent(pack) };
  }
  if (kind === "Template") {
    const { data: t } = await templatesDB.findById(id);
    if (!t) return null;
    // CR-024: templateVersion pulled from the real column, same as code/name
    // — draft_content is trusted for everything else, but the entity's own
    // authoritative columns always win for these three (mirrors packRowToContent's
    // packVersion: pack.pack_version, not whatever the JSON blob happens to hold).
    // CR-026: tenantId/parentTemplateId ride along the same way
    // packRowToContent's tenantId does — publishAuthoringDraft's re-validation
    // needs both (Ontology visibility scoping, the inheritance superset check).
    //
    // CR-045 follow-up — the same "real column wins" treatment extends to
    // Pack Codes/Deliverable Catalogue/Dependency Graph once this Template
    // isn't a Draft any more. draft_content is the WIP truth WHILE authoring
    // (the real tables aren't materialised until publish), but past Draft the
    // relational tables (template_packs, the deliverable_catalogue column,
    // dependency_definitions) are what's real — and for a Template created
    // outside the authoring form entirely (every seed script), draft_content
    // was never written at all, so trusting it exclusively showed "None" for
    // data that genuinely exists and is genuinely in effect.
    const materialised = t.status === "Draft" ? {} : {
      ...packSelectionsToFormShape(await getPackSelectionsByCategory(t.id)),
      deliverableCatalogue: t.deliverable_catalogue,
      dependencyGraph: await getDependencyGraphContent(t.id, t.tenant_id),
    };
    return { id: t.id, code: t.code, name: t.name, status: t.status, content: { code: t.code, name: t.name, ...(t.draft_content ?? {}), ...materialised, templateVersion: t.template_version, tenantId: t.tenant_id, parentTemplateId: t.parent_template_id } };
  }
  if (kind === "Profile") {
    const { data: p } = await profilesDB.findById(id);
    if (!p) return null;
    // Mirrors Template's own getAuthoringDraft treatment exactly — the
    // entity's own authoritative columns always win for these; tenantId/
    // parentProfileId ride along for publishAuthoringDraft's re-validation.
    // CR-045 follow-up — same "real join tables win once past Draft"
    // treatment as Template's own Pack-selection fields: a Profile created
    // outside the authoring form (every seed script) never writes
    // draft_content, but its Pack selections are real profile_packs rows
    // regardless (description/featureFlagCodes/compositionOptions have no
    // real-table equivalent, so those stay draft_content-only either way).
    const materialised = p.status === "Draft" ? {} : packSelectionsToFormShape(await getProfilePackSelections(p.id));
    return { id: p.id, code: p.code, name: p.name, status: p.status, content: { code: p.code, name: p.name, ...(p.draft_content ?? {}), ...materialised, profileVersion: p.profile_version, tenantId: p.tenant_id, parentProfileId: p.parent_profile_id } };
  }
  if (kind === "Deliverable") {
    const { data: d } = await deliverableDefinitionsDB.findById(id);
    if (!d) return null;
    // Real columns always win, same "authoritative column over possibly-stale
    // draft_content" discipline getAuthoringDraft's Template branch uses.
    return { id: d.id, code: d.code, name: d.code, status: d.status, content: { ...(d.draft_content ?? {}), code: d.code, description: d.description ?? "", definitionVersion: d.version, tenantId: d.tenant_id, parentDeliverableDefinitionId: d.parent_deliverable_definition_id } };
  }
  if (kind === "Service") {
    const { data: s } = await serviceDefinitionsDB.findById(id);
    if (!s) return null;
    // Same "real columns always win" discipline — every CSV-derived field is
    // a real column on service_definitions, not draft_content-only.
    return {
      id: s.id, code: s.code, name: s.name, status: s.status,
      content: {
        ...(s.draft_content ?? {}), code: s.code, name: s.name, capabilityCode: s.capability_code,
        purpose: s.purpose ?? "", inputs: s.inputs ?? "", outputs: s.outputs ?? "", serviceLevel: s.service_level,
        governance: s.governance ?? "", success: s.success ?? "", consumers: s.consumers, version: s.version,
        tenantId: s.tenant_id, parentServiceDefinitionId: s.parent_service_definition_id,
      },
    };
  }
  if (kind === "Policy") {
    const { data: p } = await policyDefinitionsDB.findById(id);
    if (!p) return null;
    // Same "real columns always win" discipline — every field is a real
    // column on policy_definitions, not draft_content-only. `conditions`
    // (migrations 215/216, full redesign — applicabilityDeliverables/
    // governedTransition/governingCondition all live inside it now, per
    // condition) is a real referential-list field, needing its raw array
    // shape back unchanged, not JSON-stringified.
    return {
      id: p.id, code: p.code, name: p.name, status: p.status,
      content: {
        ...(p.draft_content ?? {}), code: p.code, name: p.name, description: p.description ?? "", category: p.category, constraintType: p.constraint_type,
        applicabilityEnvironments: p.applicability_environments,
        conditions: p.conditions, version: p.version,
        scope: p.scope,
        tenantId: p.tenant_id, parentPolicyDefinitionId: p.parent_policy_definition_id,
      },
    };
  }
  return null;
}

// CR-020: `code` is now picked from the small, shared `capability-name`
// Ontology vocabulary rather than minted as a per-Pack-unique UUID (CR-015)
// — a (code, packVersion) collision with a DIFFERENT Pack is now a realistic
// authoring mistake (two authors both starting a "development" Pack at
// 0.1.0), not a one-in-a-billion UUID clash. packs_code_version_key
// (migration 010) would otherwise surface as a raw Postgres error; this
// turns it into an actionable message before it reaches the DB. excludeId
// lets Save re-check without tripping over the row's own existing identity.
// CR-026 Part 2: scoped to the authoring tenant (packs_code_version_tenant_key,
// migration 063) — a tenant starting their own Pack must only collide with
// their OWN existing rows, not Platform's or another tenant's same code+version.
async function assertPackCodeVersionFree(code: string, packVersion: string, tenantId: string, excludeId?: string): Promise<string | null> {
  const { data: existing } = await packsDB.findByCodeAndVersion(code, packVersion, tenantId);
  if (existing && existing.id !== excludeId) {
    return `A Pack with code "${code}" already exists at version ${packVersion}. Pick a different starting version, or continue authoring that existing Pack instead of starting a new one.`;
  }
  return null;
}

// CR-021 / CR-024: same treatment as Pack's assertPackCodeVersionFree. Template
// now has real (code, templateVersion) versioning (Ch.41 VM-002, mirroring
// Pack), so the collision is scoped to the exact version, not the whole code
// — a second Draft under an existing code is fine as long as it's a genuinely
// new version (the normal path is reactivateAsNewVersion, core/templates.ts,
// but nothing stops an author starting one by hand at a free version number
// too). excludeId lets Save re-check without tripping over the row's own
// existing identity.
// CR-026: scoped to the authoring tenant (templates_code_version_tenant_key,
// migration 062) — a tenant's own new/inherited Template must only collide
// with their OWN existing rows, not Platform's or another tenant's, which is
// exactly what lets a tenant inherit a Platform Template under the SAME code.
async function assertTemplateCodeVersionFree(code: string, templateVersion: string, tenantId: string, excludeId?: string): Promise<string | null> {
  const { data: existing } = await templatesDB.findByCodeAndVersion(code, templateVersion, tenantId);
  if (existing && existing.id !== excludeId) {
    return `A Template with code "${code}" already exists at version ${templateVersion} ("${existing.name}"). Pick a different starting version, or continue authoring that existing Template instead of starting a new one.`;
  }
  return null;
}

// CR-026 Template Inheritance (Ch.6 §9, owner: "show a dropdown of codes
// (Platform published + tenant published). Give a button to inherit"). The
// dropdown offers every Active Template this viewer can see; "inherit" then
// clones the parent's authored content into a fresh Draft's starting point
// (templateInheritedContent below) — the SAME code, editable everything else.
export async function listInheritableTemplates(viewerTenantId: string): Promise<Array<{ id: string; code: string; name: string; templateVersion: string }>> {
  const { data: templates } = await templatesDB.findActiveVisibleTo(viewerTenantId);
  return (templates ?? []).map((t) => ({ id: t.id, code: t.code, name: t.name, templateVersion: t.template_version })).sort((a, b) => a.name.localeCompare(b.name));
}

// Reconstructs a parent Template's REAL current content (not its possibly-stale
// draft_content blob) the same way reactivateAsNewVersion (core/templates.ts)
// clones a row for a new version — required capabilities/mandatory Packs/
// deliverable catalogue come off the parent's materialised columns/join
// tables, `purpose` off draft_content (its only home, CR-023). `code` carries
// through unchanged — Option A's identity model (owner: "Add a tenant_id
// column... this will suffice") locks a Derived Template to its parent's code,
// disambiguated by the NEW Draft's own tenant_id, not a new code.
export async function inheritedTemplateContent(parentTemplateId: string, viewerTenantId: string): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const { data: parent } = await templatesDB.findById(parentTemplateId);
  if (!parent) return { ok: false, error: "parent Template not found" };
  if (parent.status !== "Active") return { ok: false, error: "a Template can only be inherited from an Active Version" };
  if (parent.tenant_id !== PLATFORM_TENANT_ID && parent.tenant_id !== viewerTenantId) {
    return { ok: false, error: "parent Template is not visible to this tenant" };
  }
  // CR-038 — requiredCapabilityCodes isn't carried through; it's derived
  // fresh from whichever Packs the new Draft ends up with, same as any other
  // authoring path. Six category-scoped slots off the parent's real
  // join-table rows, mirroring inheritedProfileContent's own pattern exactly.
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

// CR-081 — "New Pack" form's existing-code branch picker: mirrors
// inheritedTemplateContent's own "real page reload, real content
// reconstruction" shape exactly, rather than a client-side JSON-rehydration
// exercise (Pack's contributions are deep/nested; a real server render is
// the robust way to repopulate them). Deliberately stricter than Template's
// own Platform-or-own-tenant visibility: a Pack code's version SEQUENCE is
// scoped to exactly one tenant (packCodeVersionSummaries' own reasoning —
// Platform's and a tenant's own lineage under the identical code text are
// independent series), so branching is only ever offered from — and only
// ever accepted from — this SAME viewer's own tenant, never Platform's.
// packVersion is always OVERWRITTEN to the freshly computed next-in-sequence
// value, never the source row's own version — which existing version you
// pick for its CONTENT never changes which number the new Draft gets.
const BRANCHABLE_PACK_STATUSES = new Set(["Published", "Active", "Retired", "Archived"]);
export async function inheritedPackVersionContent(fromPackId: string, viewerTenantId: string): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const { data: source } = await packsDB.findById(fromPackId);
  if (!source) return { ok: false, error: "source Pack not found" };
  // Bug fix (owner: a tenant with none of their own Packs under a code
  // couldn't branch from Platform's — packCodeVersionSummaries now offers
  // Platform's own versions as a fallback content source when this tenant
  // has nothing of their own under that code (see that function's own
  // comment); this check has to accept the same Platform-owned source it
  // now legitimately links to, not just this exact tenant's own rows.
  if (source.tenant_id !== viewerTenantId && source.tenant_id !== PLATFORM_TENANT_ID) return { ok: false, error: "source Pack is not this tenant's own" };
  if (!BRANCHABLE_PACK_STATUSES.has(source.status)) return { ok: false, error: `a Pack can only be branched from Published, Active, Retired, or Archived (this one is ${source.status})` };
  const summaries = await packCodeVersionSummaries(viewerTenantId);
  // Bug fix (owner: branching from an existing Pack — e.g. domain-ebook-
  // library — showed its one Dependency correctly, but every Contribution
  // tab came up empty despite the source Pack's own JSON clearly having
  // content there): generateFields (formGenerator.ts) reads the schema's own
  // FLAT field names directly off this content object — contributionCapabilities,
  // contributionServices, contributionChecklists, and so on — it never looks
  // at a nested `contributions` key at all. `dependencies` only ever "worked"
  // by coincidence: it's the one field whose flat schema name happens to
  // match packs.dependencies' own column name exactly. Every other
  // contribution type's DB column name (contributions.capabilities,
  // contributions.services, ...) is a different key than its own schema
  // field name, so nesting it under one `contributions` object here left
  // every one of them looking up something that was never there. toPackSeedInput
  // (the inverse, used when this form is later SAVED) already expects and
  // flattens these same keys — this mirrors it on the way in, not just out.
  const c = source.contributions ?? {};
  return {
    ok: true,
    content: {
      code: source.code,
      name: source.name,
      category: source.category,
      packVersion: summaries[source.code]?.nextVersion ?? "1.0.0",
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
      // CR-099 — same hand-written remap every other contribution kind needs here.
      contributionCompetencies: c.competencies ?? [],
      dependencies: source.dependencies,
      compositionSources: source.composition_sources,
    },
  };
}

// Owner, 2026-08-19: "19.2 and 19.3 has to be fixed similar to pack and
// template" — same treatment as assertTemplateCodeVersionFree, scoped to the
// authoring tenant (profiles_code_version_tenant_key, migration 064).
async function assertProfileCodeVersionFree(code: string, profileVersion: string, tenantId: string, excludeId?: string): Promise<string | null> {
  const { data: existing } = await profilesDB.findByCodeAndVersion(code, profileVersion, tenantId);
  if (existing && existing.id !== excludeId) {
    return `A Profile with code "${code}" already exists at version ${profileVersion} ("${existing.name}"). Pick a different starting version, or continue authoring that existing Profile instead of starting a new one.`;
  }
  return null;
}

// Ch.7 §9 Profile Inheritance (owner, 2026-08-19), mirroring
// listInheritableTemplates exactly. The dropdown offers every Active Profile
// this viewer can see.
export async function listInheritableProfiles(viewerTenantId: string): Promise<Array<{ id: string; code: string; name: string; profileVersion: string }>> {
  const { data: profiles } = await profilesDB.findActiveVisibleTo(viewerTenantId);
  return (profiles ?? []).map((p) => ({ id: p.id, code: p.code, name: p.name, profileVersion: p.profile_version })).sort((a, b) => a.name.localeCompare(b.name));
}

// Reconstructs a parent Profile's REAL current content, mirroring
// inheritedTemplateContent exactly — the four category-scoped Pack lists and
// optionalPackCodes come off the parent's real join-table rows (not
// draft_content), description/featureFlagCodes/compositionOptions off
// draft_content (their only home). `code` carries through unchanged — same
// Option A identity model as Template's: a Derived Profile keeps its
// parent's code, disambiguated by the NEW Draft's own tenant_id.
export async function inheritedProfileContent(parentProfileId: string, viewerTenantId: string): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const { data: parent } = await profilesDB.findById(parentProfileId);
  if (!parent) return { ok: false, error: "parent Profile not found" };
  if (parent.status !== "Active") return { ok: false, error: "a Profile can only be inherited from an Active Version" };
  if (parent.tenant_id !== PLATFORM_TENANT_ID && parent.tenant_id !== viewerTenantId) {
    return { ok: false, error: "parent Profile is not visible to this tenant" };
  }
  const { data: template } = await templatesDB.findById(parent.base_template_id);
  // CR-091 — engineeringPackCodes/organisationPackCodes were added to
  // Profile in Part 1 but never wired into inheritance here; fixed in the
  // same pass as Part 2's own fields below (a Derived Profile silently
  // dropped its parent's Engineering/Organisation Pack selections until now).
  const [optionalPackCodes, technologyPackCodes, domainPackCodes, compliancePackCodes, integrationPackCodes, engineeringPackCodes, organisationPackCodes] = await Promise.all([
    profilesDB.getPackSelection(parent.id, "optional"),
    profilesDB.getPackSelection(parent.id, "technology"),
    profilesDB.getPackSelection(parent.id, "domain"),
    profilesDB.getPackSelection(parent.id, "compliance"),
    profilesDB.getPackSelection(parent.id, "integration"),
    profilesDB.getPackSelection(parent.id, "engineering"),
    profilesDB.getPackSelection(parent.id, "organisation"),
  ]);
  const priorContent = (parent.draft_content ?? {}) as Record<string, unknown>;
  const content: Record<string, unknown> = {
    code: parent.code,
    name: parent.name,
    baseTemplateCode: template?.code ?? "",
    environment: parent.environment,
    description: typeof priorContent.description === "string" ? priorContent.description : "",
    compositionOptions: typeof priorContent.compositionOptions === "object" && priorContent.compositionOptions ? priorContent.compositionOptions : {},
    featureFlagCodes: Array.isArray(priorContent.featureFlagCodes) ? priorContent.featureFlagCodes : [],
    // CR-091 Part 1 — additionalCapabilityCodes/deploymentTargets, same
    // draft_content-only inheritance treatment as featureFlagCodes/
    // compositionOptions above (also missing until this same pass).
    additionalCapabilityCodes: Array.isArray(priorContent.additionalCapabilityCodes) ? priorContent.additionalCapabilityCodes : [],
    deploymentTargets: typeof priorContent.deploymentTargets === "object" && priorContent.deploymentTargets ? priorContent.deploymentTargets : {},
    // CR-091 Part 2 — Configuration Parameters, same draft_content-only
    // inheritance treatment.
    participatingOrganisationCodes: Array.isArray(priorContent.participatingOrganisationCodes) ? priorContent.participatingOrganisationCodes : [],
    environmentConfiguration: typeof priorContent.environmentConfiguration === "object" && priorContent.environmentConfiguration ? priorContent.environmentConfiguration : {},
    optionalPackCodes: (optionalPackCodes.data ?? []).map((packCode) => ({ packCode })),
    technologyPackCodes: (technologyPackCodes.data ?? []).map((packCode) => ({ packCode })),
    domainPackCodes: (domainPackCodes.data ?? []).map((packCode) => ({ packCode })),
    compliancePackCodes: (compliancePackCodes.data ?? []).map((packCode) => ({ packCode })),
    integrationPackCodes: (integrationPackCodes.data ?? []).map((packCode) => ({ packCode })),
    engineeringPackCodes: (engineeringPackCodes.data ?? []).map((packCode) => ({ packCode })),
    organisationPackCodes: (organisationPackCodes.data ?? []).map((packCode) => ({ packCode })),
  };
  for (const cp of CONFIGURATION_PARAMETER_FIELDS) {
    const priorValue = priorContent[cp.field as string];
    if (typeof priorValue === "string") content[cp.field as string] = priorValue;
  }
  // CR-088 Profile-side completion — exposedParameterOverrides, same
  // draft_content-only inheritance treatment. Still validated fresh at save
  // time (validateProfileSeed) against whichever base Template the Derived
  // Profile ends up with — normally the same one, since Profile Inheritance
  // doesn't offer a way to change it.
  content.exposedParameterOverrides = Array.isArray(priorContent.exposedParameterOverrides) ? priorContent.exposedParameterOverrides : [];
  return { ok: true, content };
}

// CR-023 (owner: "Seed for the templates should populate this field"): a new
// Template Draft's `purpose` is pre-filled from its category's Ontology
// guidance (migration 057) when the author hasn't written their own yet —
// never overwrites real content, only fills a genuinely empty field. Scoped
// by the author's own tenant (Platform's + their own, same as every other
// Ontology lookup in the authoring path) so a tenant's own added category
// description is honoured too.
async function withDefaultTemplatePurpose(content: Record<string, unknown>, code: string, tenantId?: string): Promise<Record<string, unknown>> {
  if (typeof content.purpose === "string" && content.purpose.trim()) return content;
  const { data: concept } = await ontologyDB.findConcept("template-categories", code, { isRoot: false, tenantId: tenantId ?? PLATFORM_TENANT_ID });
  if (!concept?.description) return content;
  return { ...content, purpose: concept.description };
}

// CR-100 — owner: "Value has to be a dropdown from Competency Value Ontology
// but allow a new text. If a new text is written, it has to emit a
// OntologyComposed event." Thin Pack-specific orchestration over the generic
// core/ontology.ts#emitOntologyComposed (formerly a Pack-only local
// function here, generalised the same session Policy's own composable
// Applicability fields needed the identical mechanism) — a Competency's
// `value` is unregistered under its own `dimension`'s (lower-cased) concept
// type exactly the same way an unregistered Pack `code` is unregistered
// under its category's `-name` concept type.
async function emitOntologyComposedForCompetencies(packId: string, packCode: string, competencies: Array<{ dimension?: string; value?: string }> | undefined, ctx: { actorId?: string | null; badge?: string | null; tenantId?: string }): Promise<void> {
  for (const comp of competencies ?? []) {
    if (!comp.dimension?.trim() || !comp.value?.trim()) continue;
    await emitOntologyComposed({ originatingObjectType: "Pack", originatingObjectId: packId, originatingEntityCode: packCode, code: comp.value, conceptType: comp.dimension.toLowerCase(), ...ctx });
  }
}

// --- Create a Draft from authored content (real author) ---------------------
// tenantId (Pack/Template ownership, owner: "Packs will have ownership" /
// CR-026 "Add a tenant_id column") — the real author's own tenant_id
// (Platform tenant for a Platform-type author), read off their session by the
// web route and passed straight through; Profile has no tenant_id column, so
// it's ignored for that kind. parentTemplateId (CR-026 Template Inheritance,
// Template only) — set only when the author chose a parent via the "Inherit"
// control; ignored for every other kind.
export async function createAuthoringDraft(input: { kind: SchemaDefinitionEntityKind; actorId: string; tenantId?: string; parentTemplateId?: string; parentProfileId?: string; parentDeliverableDefinitionId?: string; parentServiceDefinitionId?: string; parentPolicyDefinitionId?: string; content: Record<string, unknown> }): Promise<AuthoringResult> {
  const authoredBy = Number(input.actorId);
  if (input.kind === "Pack") {
    // A Pack Draft is created directly (status Draft) from the authored content;
    // full structural/referential validation is the publish-time gate, not the
    // draft gate (WIP is allowed to be incomplete). "Code is a system UUID" was
    // CR-015 — deprecated (see toPackSeedInput's own comment and CR-015's
    // Update note): `code` comes from toPackSeedInput's real value now (the
    // Ontology picker, a seed file, or an imported doc), never a minted UUID.
    const seed = toPackSeedInput(input.content);
    const collision = await assertPackCodeVersionFree(seed.code, seed.packVersion, input.tenantId ?? PLATFORM_TENANT_ID);
    if (collision) return { ok: false, errors: [collision] };
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
      authoredBy,
      tenantId: input.tenantId,
    });
    if (error || !pack) return { ok: false, errors: [(error ?? new Error("failed to create Pack draft")).message] };
    // Bug fix (owner: "I do not see whatever pack i created on the event
    // bus") — this authoring path never published anything on creation at
    // all; the FIRST event only ever appeared once/if the Draft was later
    // Validated (transitionPack's own EVENT_BY_TARGET_STATE), so a Draft
    // that hadn't been advanced yet was genuinely invisible on the Event
    // Bus, not filtered out or hidden — there was nothing to find.
    // createPackDraft (the seed-file/CLI path) already publishes
    // "PackRegistered" the moment its own row exists; same event name here
    // for the same underlying fact ("a new Pack row now exists"), with the
    // real author recorded — that path has no human actor to attribute it
    // to, this one does.
    await eventBus.publish({
      eventType: "PackRegistered",
      originatingObjectType: "Pack",
      originatingObjectId: pack.id,
      seuId: null, // platform catalog entity, not SEU-scoped
      correlationId: eventBus.newCorrelationId(),
      payload: { code: pack.code, packVersion: pack.pack_version },
      actorId: input.actorId,
    });
    const { data: packSchema } = await schemaDefinitionsDB.findLatest("Pack");
    if (packSchema) {
      await proposeComposableOntologyValues(packSchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "Pack", originatingObjectId: pack.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: "pack_define", tenantId: input.tenantId });
    }
    await emitOntologyComposedForCompetencies(pack.id, seed.code, seed.contributions.competencies, { actorId: input.actorId, badge: "pack_define", tenantId: input.tenantId });
    return { ok: true, draftId: pack.id };
  }
  if (input.kind === "Template") {
    // CR-026 Template Inheritance: a chosen parent locks this Draft's code to
    // the parent's own (owner: Option A — "Add a tenant_id column... this
    // will suffice" — identity is (code, template_version, tenant_id), not a
    // new code) — overrides whatever the form/import submitted, the same way
    // Save can never touch parent_template_id once set.
    let parentTenantCheckError: string | null = null;
    let code = typeof input.content.code === "string" && input.content.code.trim() ? input.content.code.trim() : randomUUID();
    if (input.parentTemplateId) {
      const inherited = await inheritedTemplateContent(input.parentTemplateId, input.tenantId ?? PLATFORM_TENANT_ID);
      if (!inherited.ok) parentTenantCheckError = inherited.error;
      else code = inherited.content.code as string;
    }
    if (parentTenantCheckError) return { ok: false, errors: [parentTenantCheckError] };
    // CR-021: code is now a template-categories Ontology concept (owner:
    // "The code is not UUID, but one of these values"); reuses a code already
    // on the content if present, else mints a UUID (defensive default for a
    // JSON import that omits it — never what the interactive form submits).
    // CR-024: same versioning discipline as Pack — a fresh interactive Draft
    // always starts at 1.0.0 (contentForForm, web/sdkAuthoring.ts); a JSON
    // import/CLI path that omits it gets the same default.
    const templateVersion = typeof input.content.templateVersion === "string" && input.content.templateVersion.trim() ? input.content.templateVersion.trim() : "1.0.0";
    const tenantId = input.tenantId ?? PLATFORM_TENANT_ID;
    const collision = await assertTemplateCodeVersionFree(code, templateVersion, tenantId);
    if (collision) return { ok: false, errors: [collision] };
    const draftContent = await withDefaultTemplatePurpose({ ...input.content, code }, code, tenantId);
    const { data: t, error } = await templatesDB.createDraft({ code, name: (draftContent.name as string) || "(untitled Template)", templateVersion, authoredBy, draftContent, tenantId, parentTemplateId: input.parentTemplateId ?? null });
    if (error || !t) return { ok: false, errors: [(error ?? new Error("failed to create Template draft")).message] };
    return { ok: true, draftId: t.id };
  }
  if (input.kind === "Profile") {
    // Ch.7 §9 Profile Inheritance (owner, 2026-08-19), mirroring Template's
    // own CR-026 code-lock treatment exactly: a chosen parent locks this
    // Draft's code to the parent's own, overriding whatever the form/import
    // submitted.
    let parentProfileTenantCheckError: string | null = null;
    let code = typeof input.content.code === "string" && input.content.code.trim() ? input.content.code.trim() : randomUUID();
    const tenantId = input.tenantId ?? PLATFORM_TENANT_ID;
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

    // Same versioning discipline as Pack/Template — a fresh interactive Draft
    // always starts at 1.0.0 (contentForForm, web/sdkAuthoring.ts).
    const profileVersion = typeof input.content.profileVersion === "string" && input.content.profileVersion.trim() ? input.content.profileVersion.trim() : "1.0.0";
    const collision = await assertProfileCodeVersionFree(code, profileVersion, tenantId);
    if (collision) return { ok: false, errors: [collision] };

    const { data: p, error } = await profilesDB.createDraft({
      code,
      name: (input.content.name as string) || "(untitled Profile)",
      baseTemplateId: template.id,
      environment: (input.content.environment as string) || "development",
      authoredBy,
      draftContent: { ...input.content, code },
      profileVersion,
      tenantId,
      parentProfileId: input.parentProfileId ?? null,
    });
    if (error || !p) return { ok: false, errors: [(error ?? new Error("failed to create Profile draft")).message] };
    return { ok: true, draftId: p.id };
  }
  if (input.kind === "Deliverable") {
    const seed = toDeliverableDefinitionSeedInput(input.content);
    const tenantId = input.tenantId ?? PLATFORM_TENANT_ID;
    // Ch.15 §12 inheritance — unlike Template, code is NOT locked to the
    // parent's own (see validateDeliverableDefinitionSeed's own comment).
    if (input.parentDeliverableDefinitionId) {
      const inherited = await inheritedDeliverableDefinitionContent(input.parentDeliverableDefinitionId);
      if (!inherited.ok) return { ok: false, errors: [inherited.error] };
      if (!seed.code) seed.code = inherited.content.code as string;
      if (!seed.description) seed.description = inherited.content.description as string;
    }
    const validation = await validateDeliverableDefinitionSeed({ ...seed, tenantId, parentDeliverableDefinitionId: input.parentDeliverableDefinitionId }, undefined);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    const { data: d, error } = await deliverableDefinitionsDB.createDraft({
      code: seed.code,
      description: seed.description ?? null,
      version: seed.definitionVersion,
      authoredBy,
      draftContent: input.content,
      tenantId,
      parentDeliverableDefinitionId: input.parentDeliverableDefinitionId ?? null,
    });
    if (error || !d) return { ok: false, errors: [(error ?? new Error("failed to create Deliverable Definition draft")).message] };
    return { ok: true, draftId: d.id };
  }
  if (input.kind === "Service") {
    const seed = toServiceDefinitionSeedInput(input.content);
    const tenantId = input.tenantId ?? PLATFORM_TENANT_ID;
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
      authoredBy,
      draftContent: input.content,
      tenantId,
      parentServiceDefinitionId: input.parentServiceDefinitionId ?? null,
    });
    if (error || !s) return { ok: false, errors: [(error ?? new Error("failed to create Service Definition draft")).message] };
    return { ok: true, draftId: s.id };
  }
  if (input.kind === "Policy") {
    const seed = toPolicyDefinitionSeedInput(input.content);
    const tenantId = input.tenantId ?? PLATFORM_TENANT_ID;
    if (input.parentPolicyDefinitionId) {
      const inherited = await inheritedPolicyDefinitionContent(input.parentPolicyDefinitionId);
      if (!inherited.ok) return { ok: false, errors: [inherited.error] };
      if (!seed.code) seed.code = inherited.content.code as string;
      if (!seed.name) seed.name = inherited.content.name as string;
      if (!seed.category) seed.category = inherited.content.category as string;
    }
    const validation = await validatePolicyDefinitionSeed({ ...seed, tenantId, parentPolicyDefinitionId: input.parentPolicyDefinitionId }, undefined, true);
    if (!validation.ok) return { ok: false, errors: validation.errors };
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
      authoredBy,
      draftContent: input.content,
      tenantId,
      parentPolicyDefinitionId: input.parentPolicyDefinitionId ?? null,
    });
    if (error || !p) return { ok: false, errors: [(error ?? new Error("failed to create Policy Definition draft")).message] };
    const { data: policySchema } = await schemaDefinitionsDB.findLatest("Policy");
    if (policySchema) {
      await proposeComposableOntologyValues(policySchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "Policy", originatingObjectId: p.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: "policy_define", tenantId });
    }
    return { ok: true, draftId: p.id };
  }
  return { ok: false, errors: [`kind "${input.kind}" is not authorable`] };
}

// --- Save (update a Draft's content) ----------------------------------------
export async function saveAuthoringDraft(input: { kind: SchemaDefinitionEntityKind; id: string; content: Record<string, unknown>; actorId?: string }): Promise<AuthoringActionResult> {
  if (input.kind === "Pack") {
    const { data: existingPack } = await packsDB.findById(input.id);
    if (!existingPack) return { ok: false, errors: ["draft not found or no longer editable (only Draft rows can be saved)"] };
    const seed = toPackSeedInput({ ...input.content });
    const collision = await assertPackCodeVersionFree(seed.code, seed.packVersion, existingPack.tenant_id, input.id);
    if (collision) return { ok: false, errors: [collision] };
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
    const { data: packSchema } = await schemaDefinitionsDB.findLatest("Pack");
    if (packSchema) {
      await proposeComposableOntologyValues(packSchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "Pack", originatingObjectId: input.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: "pack_define", tenantId: existingPack.tenant_id });
    }
    await emitOntologyComposedForCompetencies(input.id, seed.code, seed.contributions.competencies, { actorId: input.actorId, badge: "pack_define", tenantId: existingPack.tenant_id });
    return { ok: true };
  }
  if (input.kind === "Template") {
    // CR-024: code+templateVersion normalised the same way Pack's own save
    // branch does (toPackSeedInput) — the readonly templateVersion field
    // always round-trips its current value on a real form POST, same as
    // Pack's packVersion; the "1.0.0"-if-missing fallback only matters for a
    // non-form caller (toTemplateSeedInput's own default), same accepted
    // shape Pack already has.
    const { data: existingTemplate } = await templatesDB.findById(input.id);
    if (!existingTemplate) return { ok: false, errors: ["draft not found or no longer editable"] };
    const seed = toTemplateSeedInput({ ...input.content });
    // CR-026 Template Inheritance: once a parent is chosen, code is locked to
    // the parent's own for the life of this Draft — Save can't drift it away
    // by picking a different category, the same way createAuthoringDraft
    // forces it at the moment Inherit is chosen.
    if (existingTemplate.parent_template_id) seed.code = existingTemplate.code;
    const collision = await assertTemplateCodeVersionFree(seed.code, seed.templateVersion, existingTemplate.tenant_id, input.id);
    if (collision) return { ok: false, errors: [collision] };
    const draftContent = await withDefaultTemplatePurpose({ ...input.content, code: seed.code, templateVersion: seed.templateVersion }, seed.code, existingTemplate.tenant_id);
    const { data, error } = await templatesDB.updateDraftContent(input.id, { code: seed.code, name: (draftContent.name as string) || "(untitled Template)", templateVersion: seed.templateVersion, draftContent });
    if (error) return { ok: false, errors: [error.message] };
    if (!data) return { ok: false, errors: ["draft not found or no longer editable"] };
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
    // Ch.7 §9 Profile Inheritance: once a parent is chosen, code is locked to
    // the parent's own for the life of this Draft, mirroring Template's own
    // CR-026 treatment exactly.
    if (existingProfile.parent_profile_id) seed.code = existingProfile.code;
    const collision = await assertProfileCodeVersionFree(seed.code, seed.profileVersion, existingProfile.tenant_id, input.id);
    if (collision) return { ok: false, errors: [collision] };

    const { data, error } = await profilesDB.updateDraftContent(input.id, {
      name: (input.content.name as string) || "(untitled Profile)",
      baseTemplateId: template.id,
      environment: (input.content.environment as string) || "development",
      draftContent: { ...input.content, code: seed.code },
      profileVersion: seed.profileVersion,
    });
    if (error) return { ok: false, errors: [error.message] };
    if (!data) return { ok: false, errors: ["draft not found or no longer editable"] };
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
    const { data: policySchema } = await schemaDefinitionsDB.findLatest("Policy");
    if (policySchema) {
      await proposeComposableOntologyValues(policySchema.schema as JsonSchemaDocument, input.content, { originatingObjectType: "Policy", originatingObjectId: input.id, originatingEntityCode: seed.code, actorId: input.actorId, badge: "policy_define", tenantId: existing.tenant_id });
    }
    return { ok: true };
  }
  return { ok: false, errors: [`kind "${input.kind}" is not authorable`] };
}

export type AdvanceAuthoringDraftResult = { ok: true; status: string } | { ok: false; errors: string[] };

// --- Advance one governed hop (real actor + badge for THAT hop only) --------
// Owner: separation of duties — the seeded pack-validate@/pack-publish@/
// pack-activate@ Athens accounts each hold exactly ONE Pack lifecycle verb, so
// "publish" can't chain the whole remaining pipeline (that would require one
// actor to hold every remaining verb, and a single-verb holder could never
// perform their own step). This runs exactly the NEXT hop off the draft's
// current status — for Pack that's Draft->Validated->Published->Active one at
// a time (see advancePackOneStep); Template/Profile only ever have the one hop
// (Draft -> Active, verb `publish`), so they're unchanged. Returns the status
// reached so the caller knows whether to stay on the draft (more hops left) or
// treat it as done (reached the live state).
export async function publishAuthoringDraft(input: { kind: SchemaDefinitionEntityKind; id: string; actorId: string; actorRole: string }): Promise<AdvanceAuthoringDraftResult> {
  if (input.kind === "Pack") {
    const { data: pack } = await packsDB.findById(input.id);
    if (!pack) return { ok: false, errors: ["Pack draft not found"] };
    // Full structural/referential validation gates the FIRST hop out of Draft
    // — an incomplete document must never leave Draft. Later hops trust that
    // gate already ran (the authored content doesn't change between hops).
    if (pack.status === "Draft") {
      const seed = toPackSeedInput(packRowToContent(pack));
      const validation = await validatePackSeed(seed);
      if (!validation.ok) return { ok: false, errors: validation.errors };
    }
    const advanced = await advancePackOneStep(pack, input.actorRole, input.actorId);
    if (!advanced.ok || !advanced.pack) return { ok: false, errors: advanced.errors ?? ["advance failed"] };
    return { ok: true, status: advanced.pack.status };
  }
  // Bug fix (owner, 2026-08-18): Template/Profile now have the same six-hop
  // lifecycle Pack does (transitionDefinitions.json / authorityVocabulary.json
  // seed change), so this needs the same "advance exactly the next hop, full
  // validation + materialisation gates only the first" shape as the Pack
  // branch above — was a single hardcoded jump straight to "Active" (the only
  // target state that existed before that seed change).
  if (input.kind === "Template") {
    const { data: t } = await templatesDB.findById(input.id);
    if (!t) return { ok: false, errors: ["Template draft not found"] };
    if (t.status === "Draft") {
      // CR-024: templateVersion pulled from the real column, same reasoning
      // as getAuthoringDraft's Template branch above. CR-026: tenantId/
      // parentTemplateId likewise — the inheritance superset check
      // (validateTemplateSeed) needs the real parent, not whatever (if
      // anything) draft_content happens to carry.
      const seed = toTemplateSeedInput({ code: t.code, name: t.name, ...(t.draft_content ?? {}), templateVersion: t.template_version, tenantId: t.tenant_id, parentTemplateId: t.parent_template_id });
      const validation = await validateTemplateSeed(seed);
      if (!validation.ok) return { ok: false, errors: validation.errors };
      await materialiseTemplateDraft(t.id, seed);
    }
    const advanced = await advanceTemplateOneStep(t, input.actorRole, input.actorId);
    if (!advanced.ok) return { ok: false, errors: [`${advanced.reason}${advanced.detail ? `: ${advanced.detail}` : ""}`] };
    return { ok: true, status: advanced.template.status };
  }
  if (input.kind === "Profile") {
    const { data: p } = await profilesDB.findById(input.id);
    if (!p) return { ok: false, errors: ["Profile draft not found"] };
    if (p.status === "Draft") {
      // profileVersion/tenantId/parentProfileId pulled from the real
      // columns, same reasoning as getAuthoringDraft's Profile branch above
      // and Template's own publishAuthoringDraft treatment.
      const seed = toProfileSeedInput({ code: p.code, name: p.name, ...(p.draft_content ?? {}), profileVersion: p.profile_version, tenantId: p.tenant_id, parentProfileId: p.parent_profile_id });
      const validation = await validateProfileSeed(seed);
      if (!validation.ok) return { ok: false, errors: validation.errors };
      await materialiseProfileDraft(p.id, seed);
    }
    const advanced = await advanceProfileOneStep(p, input.actorRole, input.actorId);
    if (!advanced.ok) return { ok: false, errors: [`${advanced.reason}${advanced.detail ? `: ${advanced.detail}` : ""}`] };
    return { ok: true, status: advanced.profile.status };
  }
  if (input.kind === "Deliverable") {
    const { data: d } = await deliverableDefinitionsDB.findById(input.id);
    if (!d) return { ok: false, errors: ["Deliverable Definition draft not found"] };
    if (d.status === "Draft") {
      const seed = toDeliverableDefinitionSeedInput({ code: d.code, description: d.description ?? undefined, definitionVersion: d.version, ...(d.draft_content ?? {}) });
      const validation = await validateDeliverableDefinitionSeed({ ...seed, tenantId: d.tenant_id, parentDeliverableDefinitionId: d.parent_deliverable_definition_id ?? undefined }, d.id);
      if (!validation.ok) return { ok: false, errors: validation.errors };
    }
    const advanced = await advanceDeliverableDefinitionOneStep(d, input.actorRole, input.actorId);
    if (!advanced.ok) return { ok: false, errors: [`${advanced.reason}${advanced.detail ? `: ${advanced.detail}` : ""}`] };
    return { ok: true, status: advanced.deliverableDefinition.status };
  }
  if (input.kind === "Service") {
    const { data: s } = await serviceDefinitionsDB.findById(input.id);
    if (!s) return { ok: false, errors: ["Service Definition draft not found"] };
    if (s.status === "Defined") {
      const seed = toServiceDefinitionSeedInput({
        code: s.code, name: s.name, capabilityCode: s.capability_code, purpose: s.purpose ?? undefined, inputs: s.inputs ?? undefined,
        outputs: s.outputs ?? undefined, serviceLevel: s.service_level, governance: s.governance ?? undefined, success: s.success ?? undefined,
        consumers: s.consumers, version: s.version, ...(s.draft_content ?? {}),
      });
      const validation = await validateServiceDefinitionSeed({ ...seed, tenantId: s.tenant_id, parentServiceDefinitionId: s.parent_service_definition_id ?? undefined }, s.id);
      if (!validation.ok) return { ok: false, errors: validation.errors };
    }
    const advanced = await advanceServiceDefinitionOneStep(s, input.actorRole, input.actorId);
    if (!advanced.ok) return { ok: false, errors: [`${advanced.reason}${advanced.detail ? `: ${advanced.detail}` : ""}`] };
    return { ok: true, status: advanced.serviceDefinition.status };
  }
  if (input.kind === "Policy") {
    const { data: p } = await policyDefinitionsDB.findById(input.id);
    if (!p) return { ok: false, errors: ["Policy Definition draft not found"] };
    if (p.status === "Draft") {
      // Bug fix (found verifying migration 212's scope-driven Applicability
      // rendering) — two issues: scope (a real column, 207_policy_definitions_
      // scope_and_governing_condition.sql) was missing entirely; and unlike
      // getAuthoringDraft's own "real columns always win" mapping,
      // `...(p.draft_content ?? {})` was spread LAST here, letting stale
      // draft content silently override every real column (including
      // code/name/category) at the one call site that actually gates
      // Publish — exactly backwards.
      const seed = toPolicyDefinitionSeedInput({
        ...(p.draft_content ?? {}),
        code: p.code, name: p.name, description: p.description ?? undefined, category: p.category, constraintType: p.constraint_type,
        applicabilityEnvironments: p.applicability_environments,
        conditions: JSON.stringify(p.conditions), version: p.version,
        scope: p.scope,
      });
      const validation = await validatePolicyDefinitionSeed({ ...seed, tenantId: p.tenant_id, parentPolicyDefinitionId: p.parent_policy_definition_id ?? undefined }, p.id);
      if (!validation.ok) return { ok: false, errors: validation.errors };
    }
    const advanced = await advancePolicyDefinitionOneStep(p, input.actorRole, input.actorId);
    if (!advanced.ok) return { ok: false, errors: [`${advanced.reason}${advanced.detail ? `: ${advanced.detail}` : ""}`] };
    return { ok: true, status: advanced.policyDefinition.status };
  }
  return { ok: false, errors: [`kind "${input.kind}" is not authorable`] };
}

// --- CR-067 Compose: pre-fill a Draft's content from its own already-saved
// compositionStrategy/compositionSources -------------------------------------
export type ComposeAuthoringDraftResult =
  | { ok: true; composedFrom: string[]; conflicts: string[]; note?: string }
  | { ok: false; errors: string[] };

// Pack authoring's own "Compose" action — the explicit, author-triggered
// counterpart to the compositionStrategy/compositionSources fields Save
// already persists like any other schema field. Reads what's already on the
// Draft, resolves each named source Pack, runs the matching compositionEngine
// strategy, and writes the computed fields onto this SAME draft (via
// saveAuthoringDraft — no separate persistence path). Deliberately NOT run as
// a side effect of Save: that would silently overwrite hand-edited content
// every time the author clicks Save, contradicting Specialization's own
// "free to diverge in any direction once created."
//
// Only Pack today — Template/Profile's own schemas don't declare
// compositionStrategy/compositionSources yet (Phase 2, deferred); this
// dispatches on `kind` the same way createAuthoringDraft/saveAuthoringDraft
// do, so adding Template later needs no change to this function's own shape.
export async function composeAuthoringDraft(input: { kind: SchemaDefinitionEntityKind; id: string }): Promise<ComposeAuthoringDraftResult> {
  if (input.kind !== "Pack") return { ok: false, errors: [`composition is not yet available for "${input.kind}"`] };

  const { data: draftPack } = await packsDB.findById(input.id);
  if (!draftPack) return { ok: false, errors: ["draft not found"] };
  if (draftPack.status !== "Draft") return { ok: false, errors: ["only a Draft can be composed"] };

  const strategy = typeof draftPack.metadata?.compositionStrategy === "string" ? (draftPack.metadata.compositionStrategy as string) : "";
  if (!strategy.trim()) return { ok: false, errors: ["choose a Composition Strategy before composing"] };
  if (strategy === "conflict-detection") {
    return { ok: false, errors: [`"Conflict Detection" is not an independent Composition Strategy — it activates automatically inside Merge/Union.`] };
  }

  // Deliberately NOT deduplicated — mirrors validatePackSeed's identical
  // arity check exactly, so a Draft that passed validation at Save time
  // passes the same count here at Compose time.
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
  const saved = await saveAuthoringDraft({ kind: "Pack", id: input.id, content: newContent });
  if (!saved.ok) return { ok: false, errors: saved.errors };
  return { ok: true, composedFrom: sourceCodes, conflicts };
}
