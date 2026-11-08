// Schema fixtures: one maximal, Active row per schema entity kind, built through the governed authoring path.
//
//   - A row is created with createAuthoringDraft and moved to Active with advanceAuthoringDraftToActive, the same calls the
//     authoring pages make. The production validators therefore check every fixture, and a wrong value fails here with the
//     validator's own message.
//   - "Maximal" means every property of the latest schema carries a value, including the nested rows.
//   - Every code that names an entity (capability, service, deliverable, Pack) is a fixture-only concept of the test Ontology
//     (src/dblayer/seed/data/test-ontology.json, codes starting "schema-fixture-"). A Pack writes rows into tables keyed by those
//     codes, so a code that a seeded row also uses would overwrite that row. The category vocabularies (category:*), the role,
//     worktype, technology and checklist vocabularies, the composition strategies, installation classifications and engineering
//     capital types are read from the Platform Ontology: a fixture only refers to them.
//   - Rows live in a fixed tenant of their own, so activating one never supersedes a seeded Platform row. Building the fixtures is an
//     upsert: a row is looked up by its code, version and tenant and created only when it is missing, so a second run reuses the rows and
//     nothing accumulates. db:clean-slate removes them with the rest of the data. Change FIXTURE_VERSION whenever a builder changes what it
//     authors, so the next run creates the new version instead of reusing a stale one.
//   - The builders take an advisory lock in the database, so two test files that build fixtures at the same time cannot both create a row.
//   - A fixture quality gate applies to a fixture-only deliverable-name, so the gate engine, which scans every active gate of a
//     transition when no SEU is given, never meets it on a real Deliverable.
//   - Stage 1 covers Capability, Deliverable, Service and Policy. Stage 2 adds the Pack. Stage 3 adds the Template. Stage 4 adds the Profile.
//     TransitionDefinition has no fixture: a persisted row would change how the engine moves real entities.
import pool from "../src/utils/db.js";
import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { capabilityDefinitionsDB } from "../src/dblayer/capabilityDefinitionsDB.js";
import { deliverableDefinitionsDB } from "../src/dblayer/deliverableDefinitionsDB.js";
import { serviceDefinitionsDB } from "../src/dblayer/serviceDefinitionsDB.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { ontologyDB } from "../src/dblayer/ontologyDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import type { SchemaDefinitionEntityKind } from "../src/dblayer/seuTypes.js";
import { createAuthoringDraft, entityTypeForKind } from "../src/routes/seu/core/sdkAuthoring.js";
import { getEntityAdapter } from "../src/domain/engine/entityAdapters.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../src/domain/sdk/formGenerator.js";
import { validateOntologyFieldsAgainstSchema } from "../src/routes/seu/core/ontology.js";
import { validateReferentialFields } from "../src/routes/seu/core/referentialOptions.js";
import { activeMappingByNoun, listActiveNouns } from "../src/routes/seu/core/authorityVocabulary.js";
import { listTransitionsForEntityType } from "../src/routes/seu/core/policyDefinitions.js";
import { deriveExposableParameterCandidates, deriveOverridableParameterCandidates } from "../src/routes/seu/core/templates.js";
import { CONFIGURATION_PARAMETER_FIELDS } from "../src/routes/seu/core/profiles.js";
import { advanceAuthoringDraftToActive, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

// The viewer the production validators use when they check an Ontology value without naming one: the Platform vocabulary.
const PLATFORM_VIEWER = { isRoot: false, tenantId: null as string | null };

// The version every fixture row carries. A change to what a builder authors needs a new value here.
export const FIXTURE_VERSION = "1.0.0";

// An arbitrary number that names the advisory lock the builders take.
const FIXTURE_LOCK_KEY = 726450917;

// The fixture-only concepts of the test Ontology, by concept type.
export const FIXTURE_CODES = {
  capability: { type: "capability-name", code: "schema-fixture-capability" },
  capabilityB: { type: "capability-name", code: "schema-fixture-capability-b" },
  consumerA: { type: "capability-name", code: "schema-fixture-consumer-a" },
  consumerB: { type: "capability-name", code: "schema-fixture-consumer-b" },
  service: { type: "service-name", code: "schema-fixture-service" },
  input: { type: "deliverable-name", code: "schema-fixture-input" },
  output: { type: "deliverable-name", code: "schema-fixture-output" },
  review: { type: "deliverable-name", code: "schema-fixture-review" },
  extra: { type: "deliverable-name", code: "schema-fixture-extra" },
  pack: { type: "technology-name", code: "schema-fixture-pack" },
  basePack: { type: "technology-name", code: "schema-fixture-pack-base" },
  engineeringPack: { type: "engineering-name", code: "schema-fixture-pack-engineering" },
  compliancePack: { type: "compliance-name", code: "schema-fixture-pack-compliance" },
  domainPack: { type: "domain-name", code: "schema-fixture-pack-domain" },
  organisationPack: { type: "organisation-name", code: "schema-fixture-pack-organisation" },
  integrationPack: { type: "integration-name", code: "schema-fixture-pack-integration" },
  template: { type: "template-categories", code: "schema-fixture-template" },
  organisationA: { type: "participating-organisations", code: "schema-fixture-organisation-a" },
  organisationB: { type: "participating-organisations", code: "schema-fixture-organisation-b" },
} as const;

export interface FixtureRow {
  id: string;
  code: string;
  // The name the Registry view page shows for the row.
  shownName: string;
  // The content the row was authored with.
  content: Record<string, unknown>;
}

// The fixture tenant of a label: found, or created. A second process that creates it first makes the create fail on the unique code, and the
// tenant is then read again.
export async function ensureFixtureTenant(label: string): Promise<string> {
  const code = `schema-fixtures-${label}`;
  const existing = await tenantsDB.findByCode(code);
  if (existing.data) return existing.data.id;
  const created = await tenantsDB.create({ code, name: `Schema fixtures ${label}`, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, is_system: false });
  if (created.data) return created.data.id;
  const raced = await tenantsDB.findByCode(code);
  if (raced.data) return raced.data.id;
  throw created.error ?? new Error("schemaFixtures: tenant not created");
}

// Runs the work holding the fixture lock. The lock is held by one connection for the whole build, so the stage builders below call each
// other without it and only the exported ones take it.
async function withFixtureLock<T>(work: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [FIXTURE_LOCK_KEY]);
    return await work();
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [FIXTURE_LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}

// Fails with a clear message when the test Ontology rows of FIXTURE_CODES are not in the database. A test run loads them at its start.
export async function assertFixtureCodesSeeded(): Promise<void> {
  const missing: string[] = [];
  for (const { type, code } of Object.values(FIXTURE_CODES)) {
    const { data } = await ontologyDB.findConcept(type, code, PLATFORM_VIEWER);
    if (!data) missing.push(`${type}/${code}`);
  }
  if (missing.length) throw new Error(`schemaFixtures: the test Ontology rows are not in the database (${missing.join(", ")}); run the test suite once so seedTestOntology loads them`);
}

// Every Active Platform concept code of a type.
async function allPlatformConceptCodes(conceptType: string): Promise<string[]> {
  const { data, error } = await ontologyDB.findConceptsByType(conceptType, PLATFORM_VIEWER);
  if (error) throw error;
  return [...new Set((data ?? []).map((c) => c.code))];
}

// `count` Active Platform concept codes of a type, after skipping `skip`. Distinct skips give distinct codes. Used for the vocabularies
// a fixture only refers to.
export async function platformConceptCodes(conceptType: string, count: number, skip = 0): Promise<string[]> {
  const codes = await allPlatformConceptCodes(conceptType);
  if (codes.length < skip + count) throw new Error(`schemaFixtures: needs ${skip + count} Active "${conceptType}" concepts, the Ontology holds ${codes.length}`);
  return codes.slice(skip, skip + count);
}

// One Active Platform concept of a type that has the given code. Fails when it is missing, so a renamed concept is not skipped silently.
async function platformConceptCode(conceptType: string, code: string): Promise<string> {
  const { data } = await ontologyDB.findConcept(conceptType, code, PLATFORM_VIEWER);
  if (!data) throw new Error(`schemaFixtures: the Ontology holds no Active "${conceptType}" concept "${code}"`);
  return code;
}

// Badges as the authority-badge referential source offers them: <noun>_<verb>, from the active Authority Vocabulary.
export async function authorityBadgeCodes(count: number): Promise<string[]> {
  const badges = Object.entries(await activeMappingByNoun()).flatMap(([noun, verbs]) => verbs.map((verb) => `${noun}_${verb}`)).sort();
  if (badges.length < count) throw new Error(`schemaFixtures: needs ${count} active authority badges, the vocabulary holds ${badges.length}`);
  return badges.slice(0, count);
}

// Transitions as the transition-definition referential source offers them: <EntityType>|<from>|<to>.
export async function deliverableTransitions(count: number): Promise<string[]> {
  const transitions = await listTransitionsForEntityType("Deliverable");
  if (transitions.length < count) throw new Error(`schemaFixtures: needs ${count} Deliverable transitions, the database holds ${transitions.length}`);
  return transitions.slice(0, count);
}

// The first active Authority Vocabulary noun that has at least one transition, with that transition.
async function nounWithTransition(): Promise<{ noun: string; transition: string }> {
  for (const noun of await listActiveNouns()) {
    const [transition] = await listTransitionsForEntityType(noun.code);
    if (transition) return { noun: noun.code, transition };
  }
  throw new Error("schemaFixtures: no active Authority Vocabulary noun has a transition");
}

// The property of each kind's content that holds its version.
const VERSION_PROPERTY: Partial<Record<SchemaDefinitionEntityKind, string>> = {
  Capability: "version", Deliverable: "definitionVersion", Service: "version", Policy: "version", Pack: "packVersion", Template: "templateVersion", Profile: "profileVersion",
};

// The row of this code and version in the tenant, if there is one.
async function findExisting(kind: SchemaDefinitionEntityKind, tenantId: string, code: string, version: string): Promise<{ id: string; status: string } | null> {
  const result =
    kind === "Capability" ? await capabilityDefinitionsDB.findByCodeAndVersion(code, version, tenantId)
    : kind === "Deliverable" ? await deliverableDefinitionsDB.findByCodeAndVersion(code, version, tenantId)
    : kind === "Service" ? await serviceDefinitionsDB.findByCodeAndVersion(code, version, tenantId)
    : kind === "Policy" ? await policyDefinitionsDB.findByCodeAndVersion(code, version, tenantId)
    : kind === "Pack" ? await packsDB.findByCodeAndVersion(code, version, tenantId)
    : kind === "Template" ? await templatesDB.findByCodeAndVersion(code, version, tenantId)
    : kind === "Profile" ? await profilesDB.findByCodeAndVersion(code, version, tenantId)
    : null;
  if (!result) throw new Error(`schemaFixtures: ${kind} has no fixture`);
  if (result.error) throw result.error;
  return result.data ? { id: result.data.id, status: result.data.status } : null;
}

// The policy-validate-schema policy answers only yes or no. When it blocks a hop, this runs the same three checks on the row's content as it
// stands and lists what they report, so the failure says which value is wrong.
async function explainSchemaFailure(kind: SchemaDefinitionEntityKind, id: string): Promise<string> {
  const adapter = getEntityAdapter(entityTypeForKind(kind));
  const row = await adapter.findById(id);
  if (!row || !adapter.schemaDefinitionId || !adapter.content) return "";
  const schemaId = adapter.schemaDefinitionId(row);
  const { data: schemaRow } = schemaId ? await schemaDefinitionsDB.findById(schemaId) : { data: null };
  if (!schemaRow) return " The row's schema definition is missing.";
  const schema = schemaRow.schema as JsonSchemaDocument;
  const content = adapter.content(row);
  const viewer = { isRoot: false, tenantId: (await adapter.tenantId(row)) as string | null };
  const reasons = [
    ...validateAgainstSchema(schema, content).map((e) => `schema: ${e}`),
    ...(await validateOntologyFieldsAgainstSchema(schema, content, viewer)).map((e) => `ontology: ${e}`),
    ...(await validateReferentialFields(schema, content, viewer)).map((e) => `referential: ${e}`),
  ];
  return reasons.length > 0 ? ` Reasons: ${reasons.join("; ")}` : " The schema, ontology and referential checks pass on the content as it stands now.";
}

// The failure message of a hop that did not reach Active, with the reasons when the schema policy blocked it.
async function hopFailure(kind: SchemaDefinitionEntityKind, id: string, errors: string[]): Promise<string> {
  const joined = errors.join("; ");
  return /policy-validate-schema/.test(joined) ? `${joined}${await explainSchemaFailure(kind, id)}` : joined;
}

// The Active row of this content: the existing one, moved on to Active if an earlier run left it short of it, or a new one created through
// the authoring path and walked to Active as the root actor. Returns the row id.
async function authorActive(kind: SchemaDefinitionEntityKind, tenantId: string, content: Record<string, unknown>): Promise<string> {
  const versionProperty = VERSION_PROPERTY[kind];
  if (!versionProperty) throw new Error(`schemaFixtures: ${kind} has no fixture`);
  const existing = await findExisting(kind, tenantId, String(content.code), String(content[versionProperty]));
  if (existing) {
    if (existing.status !== "Active") {
      const advanced = await advanceAuthoringDraftToActive(kind, existing.id, ROOT_ACTOR_ID);
      if (!advanced.ok) throw new Error(`schemaFixtures: the existing ${kind} is ${existing.status} and could not reach Active: ${await hopFailure(kind, existing.id, advanced.errors)}`);
    }
    return existing.id;
  }
  const { data: schema } = await schemaDefinitionsDB.findLatest(kind);
  if (!schema) throw new Error(`schemaFixtures: no schema_definitions grammar for ${kind}`);
  const created = await createAuthoringDraft({ kind, actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, tenantId, schemaDefinitionId: schema.id, content });
  if (!created.ok) throw new Error(`schemaFixtures: the ${kind} draft was refused: ${created.errors.join("; ")}`);
  const active = await advanceAuthoringDraftToActive(kind, created.draftId, ROOT_ACTOR_ID);
  if (!active.ok) throw new Error(`schemaFixtures: the ${kind} could not reach Active: ${await hopFailure(kind, created.draftId, active.errors)}`);
  return created.draftId;
}

// ---- Capability -------------------------------------------------------------------------------------------------------

export async function maximalCapability(tenantId: string, input: { code: string }): Promise<FixtureRow> {
  const [category] = await platformConceptCodes("category:capability", 1);
  const roleNames = await platformConceptCodes("role-name", 2);
  const worktypes = await platformConceptCodes("worktype-name", 3);
  const content: Record<string, unknown> = {
    code: input.code,
    version: FIXTURE_VERSION,
    defaultLabel: `Fixture Capability`,
    category,
    description: `Fixture Capability, every property of the Capability schema filled.`,
    roles: [
      { name: roleNames[0], worktypes: [worktypes[0], worktypes[1]] },
      { name: roleNames[1], worktypes: [worktypes[2]] },
    ],
  };
  return { id: await authorActive("Capability", tenantId, content), code: input.code, shownName: content.defaultLabel as string, content };
}

// ---- Deliverable ------------------------------------------------------------------------------------------------------

export async function maximalDeliverable(tenantId: string, input: { code: string }): Promise<FixtureRow> {
  const content: Record<string, unknown> = {
    code: input.code,
    name: `Fixture Deliverable`,
    description: `Fixture Deliverable, every property of the Deliverable schema filled.`,
    guideLocation: `https://example.test/fixtures/${input.code}`,
    definitionVersion: FIXTURE_VERSION,
  };
  // The Registry page shows the code with its hyphens as spaces.
  return { id: await authorActive("Deliverable", tenantId, content), code: input.code, shownName: input.code.replace(/-/g, " "), content };
}

// ---- Service ----------------------------------------------------------------------------------------------------------

export const FIXTURE_SERVICE_LEVEL_CODE = "fixture-coverage";

export async function maximalService(tenantId: string, input: { code: string; capabilityCode: string; inputs: string[]; outputs: string[]; consumers: string[] }): Promise<FixtureRow> {
  const content: Record<string, unknown> = {
    code: input.code,
    version: FIXTURE_VERSION,
    name: `Fixture Service`,
    capabilityCode: input.capabilityCode,
    purpose: `Fixture Service, every property of the Service schema filled.`,
    inputs: input.inputs,
    outputs: input.outputs,
    consumers: input.consumers,
    governance: "Reviewed by the fixture owner before each release.",
    success: "Every output is delivered and accepted.",
    serviceLevel: [
      { code: FIXTURE_SERVICE_LEVEL_CODE, label: "Percent of inputs covered", units: "percent", target: 95, target_level: "minimum" },
      { code: "fixture-turnaround", label: "Hours to deliver", units: "hours", target: 48, target_level: "maximum" },
      { code: "fixture-reviews", label: "Reviews per output", units: "count", target: 2, target_level: "exact" },
    ],
  };
  return { id: await authorActive("Service", tenantId, content), code: input.code, shownName: content.name as string, content };
}

// ---- Policy -----------------------------------------------------------------------------------------------------------

export async function maximalPolicy(tenantId: string, input: { code: string; deliverableCode: string }): Promise<FixtureRow> {
  const [category] = await platformConceptCodes("category:policy", 1);
  const environments = await platformConceptCodes("category:environment", 2);
  const [severity] = await platformConceptCodes("category:policy-condition-severity", 1);
  const [evidenceCategory] = await platformConceptCodes("category:evidence", 1);
  const [obligationCategory] = await platformConceptCodes("category:obligation", 1);
  const [origin] = await platformConceptCodes("category:obligation-origin", 1);
  const [priority] = await platformConceptCodes("category:obligation-priority", 1);
  const [obligationSeverity] = await platformConceptCodes("category:obligation-severity", 1);
  const [approver] = await authorityBadgeCodes(1);
  const transitions = await deliverableTransitions(2);
  const evidence = { title: "Fixture evidence", category: evidenceCategory, description: "Evidence that satisfies the condition.", collectionMethod: "Attached by the reviewer." };
  const content: Record<string, unknown> = {
    code: input.code,
    version: FIXTURE_VERSION,
    name: `Fixture Policy`,
    description: `Fixture Policy, every property of the Policy schema filled.`,
    category,
    scope: "Transition",
    constraintType: "Policy",
    applicabilityEnvironments: environments,
    conditions: [
      {
        statement: "Every output is reviewed before it moves on.",
        severity,
        requiredEvidence: evidence,
        exceptionRules: [
          {
            exceptionStatement: "A reviewer may waive the review for an unchanged output.",
            duration: "90 days",
            exceptionScope: "This SEU only",
            exceptionApprovers: [approver],
            exceptionComposition: "all",
            reviewRequirements: "Checked again at the next release.",
          },
        ],
        relatedObligations: [
          {
            title: "Record the review",
            category: obligationCategory,
            origin,
            priority,
            severity: obligationSeverity,
            description: "Raised when the review is missing.",
            completionCriteria: "The review is attached to the output.",
            requiredEvidence: evidence,
          },
        ],
        applicabilityDeliverables: [
          { name: input.deliverableCode, transitions: [transitions[0]], governingCondition: { type: "field_in", field: "reviewState", values: "reviewed,waived" } },
          { name: input.deliverableCode, transitions: [transitions[1]], governingCondition: { type: "threshold", field: "coveragePercent", operator: "gte", value: "80" } },
        ],
      },
    ],
  };
  return { id: await authorActive("Policy", tenantId, content), code: input.code, shownName: content.name as string, content };
}

// ---- Pack -------------------------------------------------------------------------------------------------------------

// The Pack category with competencies: a Technology Pack must declare one, and its code comes from the technology-name concepts.
const PACK_CATEGORY = "Technology";
const PACK_VERSION = FIXTURE_VERSION;

// The competency vocabulary of the categories that must declare a competency: the Ontology concept type is the category in lower case.
const COMPETENCY_CONCEPT_TYPE: Record<string, string> = { Technology: "technology", Domain: "domain" };

// A Pack with the fields its category requires and nothing else.
export async function minimalPack(tenantId: string, input: { category: string; code: string; name: string }): Promise<FixtureRow> {
  const content: Record<string, unknown> = {
    code: input.code,
    name: input.name,
    category: input.category,
    packVersion: PACK_VERSION,
    installationClassification: await platformConceptCode("installation-classification", "Optional"),
  };
  const competencyType = COMPETENCY_CONCEPT_TYPE[input.category];
  if (competencyType) {
    const [value] = await platformConceptCodes(competencyType, 1);
    content.contributionCompetencies = [{ dimension: input.category, value }];
  }
  return { id: await authorActive("Pack", tenantId, content), code: input.code, shownName: input.name, content };
}

// The Pack the maximal Pack depends on and composes from.
export async function basePack(tenantId: string): Promise<FixtureRow> {
  return minimalPack(tenantId, { category: PACK_CATEGORY, code: FIXTURE_CODES.basePack.code, name: `Fixture Base Pack` });
}

export async function maximalPack(
  tenantId: string,
  input: { base: FixtureRow; service: FixtureRow; policy: FixtureRow; capabilityCodes: string[]; outputDeliverableCode: string; reviewDeliverableCode: string }
): Promise<FixtureRow> {
  const [technology] = await platformConceptCodes("technology", 1);
  const [role] = await platformConceptCodes("role-name", 1);
  const [capitalType] = await platformConceptCodes("engineering-capital", 1);
  const [dimension] = await platformConceptCodes("checklist-configurable-dimension", 1);
  const [dimensionValue] = await platformConceptCodes("checklist-configurable-value", 1);
  const evidenceCategories = await platformConceptCodes("category:evidence", 3);
  const [obligationCategory] = await platformConceptCodes("category:obligation", 1);
  const [origin] = await platformConceptCodes("category:obligation-origin", 1);
  const [priority] = await platformConceptCodes("category:obligation-priority", 1);
  const [severity] = await platformConceptCodes("category:obligation-severity", 1);
  const transitions = await deliverableTransitions(2);
  const obligationNoun = await nounWithTransition();
  const checklistName = `fixture-checklist`;
  const gateText = { prompt: "Check the output against the standard.", assurance: "high", statement: "The output meets the fixture standard." };

  const content: Record<string, unknown> = {
    code: FIXTURE_CODES.pack.code,
    name: `Fixture Pack`,
    category: PACK_CATEGORY,
    description: `Fixture Pack, every property of the Pack schema filled.`,
    packVersion: PACK_VERSION,
    installationClassification: await platformConceptCode("installation-classification", "Optional"),
    migrationGuidance: "Re-run the fixture build after a schema change.",
    incompatiblePackVersions: "0.1.0",
    supportedPlatformVersion: "1.0.0",
    minSupportedPlatformVersion: "1.0.0",
    maxSupportedPlatformVersion: "2.0.0",
    compositionStrategy: await platformConceptCode("composition-strategy", "specialization"),
    compositionSources: [{ packCode: input.base.code }],
    dependencies: [
      { type: "required", version: PACK_VERSION, packCode: input.base.code },
      { type: "optional", version: PACK_VERSION, packCode: input.base.code },
    ],
    contributionCapabilities: input.capabilityCodes.map((code) => ({ code })),
    contributionCompetencies: [{ dimension: PACK_CATEGORY, value: technology }],
    contributionServices: [{ code: input.service.code, serviceDefinitionId: input.service.id, serviceLevel: [{ code: FIXTURE_SERVICE_LEVEL_CODE, target: 90 }] }],
    contributionPolicies: [input.policy.code],
    contributionAuthorityRules: [{ code: `fixture-rule`, authorisedRole: role, governedTransition: transitions[0] }],
    contributionEngineeringCapital: [{ type: capitalType, url: `https://example.test/fixtures/capital` }],
    contributionChecklists: [
      {
        name: checklistName,
        description: "The checks the fixture gates run.",
        items: [
          { group: "Fixture group", statement: "The output is complete.", configurableKey: dimension, configurableValue: dimensionValue },
          { statement: "The output is reviewed." },
        ],
      },
    ],
    contributionReviewGates: [
      {
        code: input.reviewDeliverableCode,
        name: `Fixture Review Gate`,
        ...gateText,
        participant: "human",
        checklistIds: [checklistName],
        classification: "judgment",
        outputContract: "assessment-acceptance",
        externalEvidence: false,
        governedTransition: transitions[0],
        recommendedChecklistIds: [checklistName],
      },
    ],
    contributionQualityGates: [
      {
        name: `Fixture Policy Gate`,
        category: evidenceCategories[0],
        ...gateText,
        participant: "AI+human",
        checklistIds: [checklistName],
        criteriaType: "requires_active_policy",
        classification: "machine-verifiable",
        outputContract: "passed-failed-notes",
        externalEvidence: false,
        governedTransition: transitions[0],
        requiredPolicyCodes: [input.policy.code],
        recommendedChecklistIds: [checklistName],
        applicabilityDeliverableNames: [input.outputDeliverableCode],
      },
      {
        name: `Fixture Review Quality Gate`,
        category: evidenceCategories[1],
        ...gateText,
        participant: "human",
        checklistIds: [checklistName],
        criteriaType: "requires_accepted_review",
        classification: "human-attested",
        outputContract: "assessment-acceptance",
        deliverableName: input.reviewDeliverableCode,
        externalEvidence: true,
        governedTransition: transitions[1],
        recommendedChecklistIds: [checklistName],
        applicabilityDeliverableNames: [input.outputDeliverableCode],
      },
    ],
    contributionObligationDefinitions: [
      {
        code: `fixture-obligation`,
        title: "Record the fixture review",
        origin,
        prompt: "Raise this when the review is missing.",
        category: obligationCategory,
        priority,
        severity,
        assurance: "high",
        description: "An obligation the fixture Pack defines.",
        participant: "human",
        classification: "human-attested",
        outputContract: "passed-failed-notes",
        externalEvidence: false,
        requiredEvidence: { title: "Fixture evidence", category: evidenceCategories[2], description: "Proof of the review.", collectionMethod: "Attached by the reviewer." },
        completionCriteria: "The review is attached.",
        applicabilityDeliverables: [{ name: obligationNoun.noun, transitions: [obligationNoun.transition], governingCondition: { type: "always_true" } }],
      },
    ],
  };
  return { id: await authorActive("Pack", tenantId, content), code: FIXTURE_CODES.pack.code, shownName: content.name as string, content };
}

// ---- Template ---------------------------------------------------------------------------------------------------------

export interface TemplatePacks {
  technology: FixtureRow[];
  engineering: FixtureRow;
  compliance: FixtureRow;
  domain: FixtureRow;
  organisation: FixtureRow;
  integration: FixtureRow;
}

// Every pack-selection list carries a Pack. The exposed parameters are the ones the selected Packs carry, each with a value its source
// allows, so the Template keeps them when it is materialised.
export async function maximalTemplate(tenantId: string, input: { packs: TemplatePacks; capabilityCode: string }): Promise<FixtureRow> {
  const { packs } = input;
  const codes = (rows: FixtureRow[]): Array<{ packCode: string }> => rows.map((row) => ({ packCode: row.code }));
  const catalogue = [FIXTURE_CODES.input.code, FIXTURE_CODES.output.code, FIXTURE_CODES.review.code, FIXTURE_CODES.extra.code];
  // One edge of each relationship kind and of each prerequisite type. The Deliverable edges form no cycle.
  const dependencyGraph = [
    { toCode: FIXTURE_CODES.output.code, fromType: "Deliverable", fromCode: FIXTURE_CODES.input.code, requiredState: "Approved", relationshipKind: "dependency" },
    { toCode: FIXTURE_CODES.review.code, fromType: "Deliverable", fromCode: FIXTURE_CODES.output.code, requiredState: "Approved", relationshipKind: "derivation" },
    { toCode: FIXTURE_CODES.extra.code, fromType: "Deliverable", fromCode: FIXTURE_CODES.input.code, requiredState: "Approved", relationshipKind: "implementation" },
    { toCode: FIXTURE_CODES.review.code, fromType: "Deliverable", fromCode: FIXTURE_CODES.input.code, requiredState: "Approved", relationshipKind: "decomposition" },
    { toCode: FIXTURE_CODES.output.code, fromType: "Capability", fromCapabilityCode: input.capabilityCode, requiredState: "Approved" },
  ];
  const selected = [...packs.technology, packs.engineering, packs.compliance, packs.domain, packs.organisation, packs.integration];
  const candidates = await deriveExposableParameterCandidates(selected.map((row) => row.code), tenantId, dependencyGraph as unknown as Parameters<typeof deriveExposableParameterCandidates>[2]);
  const exposedParameters = candidates.map((candidate, i) => {
    const value = candidate.sourceType === "policy" && candidate.parameterName === "constraintType" ? "Standard" : (candidate.valueOptions?.[0] ?? candidate.defaultValue);
    return { sourceType: candidate.sourceType, sourceCode: candidate.sourceCode, parameterName: candidate.parameterName, ...(value === undefined ? {} : { value }), overridable: i % 2 === 0 };
  });
  const content: Record<string, unknown> = {
    code: FIXTURE_CODES.template.code,
    name: `Fixture Template`,
    purpose: `Fixture Template, every property of the Template schema filled.`,
    templateVersion: PACK_VERSION,
    technologyPackCodes: codes(packs.technology),
    engineeringPackCodes: codes([packs.engineering]),
    compliancePackCodes: codes([packs.compliance]),
    domainPackCodes: codes([packs.domain]),
    organisationPackCodes: codes([packs.organisation]),
    integrationPackCodes: codes([packs.integration]),
    deliverableCatalogue: catalogue.map((code) => ({ code })),
    dependencyGraph,
    exposedParameters,
  };
  return { id: await authorActive("Template", tenantId, content), code: FIXTURE_CODES.template.code, shownName: content.name as string, content };
}

// ---- Profile ----------------------------------------------------------------------------------------------------------

// Every Configuration Parameter takes the first value its vocabulary offers. The primary programming language must also be a
// technology competency, so it is the first language that is both.
async function configurationParameters(): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const parameter of CONFIGURATION_PARAMETER_FIELDS) {
    if (parameter.field === "primaryProgrammingLanguage") {
      const technologies = new Set(await allPlatformConceptCodes("technology"));
      const language = (await allPlatformConceptCodes(parameter.parameterCode)).find((code) => technologies.has(code));
      if (!language) throw new Error("schemaFixtures: no primary-programming-language concept is also a technology concept");
      values[parameter.field as string] = language;
    } else {
      values[parameter.field as string] = (await platformConceptCodes(parameter.parameterCode, 1))[0]!;
    }
  }
  return values;
}

// Every property of the Profile schema carries a value. The Profile keeps three of the Template's four Deliverables, selects a Pack of every
// category and overrides each parameter its base Template flags overridable, with a value that parameter allows.
export async function maximalProfile(tenantId: string, input: { template: FixtureRow; packs: TemplatePacks; optionalPack: FixtureRow; capabilityCode: string }): Promise<FixtureRow> {
  const { packs } = input;
  const codes = (rows: FixtureRow[]): Array<{ packCode: string }> => rows.map((row) => ({ packCode: row.code }));
  const [environment] = await platformConceptCodes("category:environment", 1);
  const featureFlags = await platformConceptCodes("feature-flag", 2);
  const strategies = await platformConceptCodes("dispatch-strategy-preference", 2);
  const catalogue = [FIXTURE_CODES.input.code, FIXTURE_CODES.output.code, FIXTURE_CODES.review.code];
  const overridable = await deriveOverridableParameterCandidates(input.template.code, tenantId);
  const exposedParameterOverrides = overridable.flatMap((candidate) => {
    const value = candidate.numeric && candidate.defaultValue !== undefined ? String(Number(candidate.defaultValue) + 1) : (candidate.valueOptions?.[0] ?? candidate.defaultValue);
    return value === undefined ? [] : [{ sourceType: candidate.sourceType, sourceCode: candidate.sourceCode, parameterName: candidate.parameterName, value }];
  });
  if (exposedParameterOverrides.length === 0) throw new Error("schemaFixtures: the base Template exposes no overridable parameter, so the Profile has nothing to override");
  const content: Record<string, unknown> = {
    code: `fixture-profile`,
    name: `Fixture Profile`,
    description: `Fixture Profile, every property of the Profile schema filled.`,
    readme: "Per-SEU notes for the fixture Profile.",
    baseTemplateCode: input.template.code,
    environment,
    profileVersion: PACK_VERSION,
    ...(await configurationParameters()),
    technologyPackCodes: codes(packs.technology.slice(0, 1)),
    engineeringPackCodes: codes([packs.engineering]),
    compliancePackCodes: codes([packs.compliance]),
    domainPackCodes: codes([packs.domain]),
    organisationPackCodes: codes([packs.organisation]),
    integrationPackCodes: codes([packs.integration]),
    optionalPackCodes: codes([input.optionalPack]),
    featureFlagCodes: featureFlags.map((featureCode) => ({ featureCode })),
    participatingOrganisationCodes: [FIXTURE_CODES.organisationA.code, FIXTURE_CODES.organisationB.code].map((organisationCode) => ({ organisationCode })),
    dispatchStrategyPreference: strategies.map((strategy, i) => ({ strategy, order: i + 1 })),
    knowledgeLocations: [{ outputLocation: `https://example.test/fixtures/knowledge`, deliverableCodes: [FIXTURE_CODES.input.code, FIXTURE_CODES.output.code] }],
    redispatchMaxAttempts: 6,
    redispatchAttentionThreshold: 2,
    compositionOptions: { fixture: true },
    deploymentTargets: { fixtureTarget: "staging-cluster" },
    environmentConfiguration: { FIXTURE_URL: `https://example.test/fixtures` },
    exposedParameterOverrides,
    deliverableCatalogue: catalogue.map((code) => ({ code })),
    dependencyGraph: [
      { toCode: FIXTURE_CODES.output.code, fromType: "Deliverable", fromCode: FIXTURE_CODES.input.code, requiredState: "Approved", relationshipKind: "dependency" },
      { toCode: FIXTURE_CODES.review.code, fromType: "Deliverable", fromCode: FIXTURE_CODES.output.code, requiredState: "Approved", relationshipKind: "derivation" },
      { toCode: FIXTURE_CODES.output.code, fromType: "Capability", fromCapabilityCode: input.capabilityCode, requiredState: "Approved" },
    ],
  };
  return { id: await authorActive("Profile", tenantId, content), code: content.code as string, shownName: content.name as string, content };
}

// ---- Stages -----------------------------------------------------------------------------------------------------------

export interface Stage1Fixtures {
  tenantId: string;
  capability: FixtureRow;
  inputDeliverable: FixtureRow;
  outputDeliverable: FixtureRow;
  service: FixtureRow;
  policy: FixtureRow;
}

// The Service is aligned to the Capability and reads the two Deliverables, so the Registry pages find each of them Active. The Policy
// governs the Service's output, which is what lets a Pack that declares the Capability adopt it.
async function stage1(tenantId: string): Promise<Stage1Fixtures> {
  await assertFixtureCodesSeeded();
  const capability = await maximalCapability(tenantId, { code: FIXTURE_CODES.capability.code });
  const inputDeliverable = await maximalDeliverable(tenantId, { code: FIXTURE_CODES.input.code });
  const outputDeliverable = await maximalDeliverable(tenantId, { code: FIXTURE_CODES.output.code });
  const service = await maximalService(tenantId, {
    code: FIXTURE_CODES.service.code,
    capabilityCode: FIXTURE_CODES.capability.code,
    inputs: [FIXTURE_CODES.input.code],
    outputs: [FIXTURE_CODES.output.code],
    consumers: [FIXTURE_CODES.consumerA.code, FIXTURE_CODES.consumerB.code],
  });
  const policy = await maximalPolicy(tenantId, { code: `fixture-policy`, deliverableCode: FIXTURE_CODES.output.code });
  return { tenantId, capability, inputDeliverable, outputDeliverable, service, policy };
}

export interface Stage2Fixtures extends Stage1Fixtures {
  basePack: FixtureRow;
  pack: FixtureRow;
}

// The Pack declares two Capabilities, only one of which has a Capability Definition, so a view meets both a found and a missing reference.
async function stage2(tenantId: string): Promise<Stage2Fixtures> {
  const stage1Rows = await stage1(tenantId);
  const base = await basePack(tenantId);
  const pack = await maximalPack(tenantId, {
    base,
    service: stage1Rows.service,
    policy: stage1Rows.policy,
    capabilityCodes: [FIXTURE_CODES.capability.code, FIXTURE_CODES.capabilityB.code],
    outputDeliverableCode: FIXTURE_CODES.output.code,
    reviewDeliverableCode: FIXTURE_CODES.review.code,
  });
  return { ...stage1Rows, basePack: base, pack };
}

export interface Stage3Fixtures extends Stage2Fixtures {
  engineeringPack: FixtureRow;
  compliancePack: FixtureRow;
  domainPack: FixtureRow;
  organisationPack: FixtureRow;
  integrationPack: FixtureRow;
  template: FixtureRow;
}

// The Template selects a Pack of every category, two of them Technology, and the catalogue holds Deliverables with and without a
// Deliverable Definition, so a view meets both a found and a missing reference.
async function stage3(tenantId: string): Promise<Stage3Fixtures> {
  const stage2Rows = await stage2(tenantId);
  const pack = (category: string, key: keyof typeof FIXTURE_CODES) => minimalPack(tenantId, { category, code: FIXTURE_CODES[key].code, name: `Fixture ${category} Pack` });
  const engineeringPack = await pack("Engineering", "engineeringPack");
  const compliancePack = await pack("Compliance", "compliancePack");
  const domainPack = await pack("Domain", "domainPack");
  const organisationPack = await pack("Organisation", "organisationPack");
  const integrationPack = await pack("Integration", "integrationPack");
  const template = await maximalTemplate(tenantId, {
    packs: { technology: [stage2Rows.pack, stage2Rows.basePack], engineering: engineeringPack, compliance: compliancePack, domain: domainPack, organisation: organisationPack, integration: integrationPack },
    capabilityCode: FIXTURE_CODES.capability.code,
  });
  return { ...stage2Rows, engineeringPack, compliancePack, domainPack, organisationPack, integrationPack, template };
}

export interface Stage4Fixtures extends Stage3Fixtures {
  profile: FixtureRow;
}

// The Profile's base Template is the Stage 3 Template. Its optional Pack is the base Pack, which the Template also selects as a Technology Pack.
async function stage4(tenantId: string): Promise<Stage4Fixtures> {
  const stage3Rows = await stage3(tenantId);
  const profile = await maximalProfile(tenantId, {
    template: stage3Rows.template,
    packs: { technology: [stage3Rows.pack, stage3Rows.basePack], engineering: stage3Rows.engineeringPack, compliance: stage3Rows.compliancePack, domain: stage3Rows.domainPack, organisation: stage3Rows.organisationPack, integration: stage3Rows.integrationPack },
    optionalPack: stage3Rows.basePack,
    capabilityCode: FIXTURE_CODES.capability.code,
  });
  return { ...stage3Rows, profile };
}

export const buildStage1Fixtures = (tenantId: string): Promise<Stage1Fixtures> => withFixtureLock(() => stage1(tenantId));
export const buildStage2Fixtures = (tenantId: string): Promise<Stage2Fixtures> => withFixtureLock(() => stage2(tenantId));
export const buildStage3Fixtures = (tenantId: string): Promise<Stage3Fixtures> => withFixtureLock(() => stage3(tenantId));
export const buildStage4Fixtures = (tenantId: string): Promise<Stage4Fixtures> => withFixtureLock(() => stage4(tenantId));
