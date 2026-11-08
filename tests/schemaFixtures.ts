// Schema fixtures: one maximal, Active row per schema entity kind, built through the governed authoring path.
//
//   - A row is created with createAuthoringDraft and moved to Active with advanceAuthoringDraftToActive, the same calls the
//     authoring pages make. The production validators therefore check every fixture, and a wrong value fails here with the
//     validator's own message.
//   - "Maximal" means every property of the latest schema carries a value, including the nested rows.
//   - Every Ontology, referential and authority value is read from what the database holds, never typed as a literal.
//   - Codes of the types the test Ontology (src/dblayer/seed/data/test-ontology.json) covers come from the test Ontology only:
//     capability-name, deliverable-name, service-name and the Pack code types. The category vocabularies (category:*) and the role and
//     worktype vocabularies have no test rows, so they come from the Platform Ontology.
//   - Rows are created in a tenant of their own, so activating one never supersedes a seeded Platform row. Rows are not
//     deleted, as in the other tests that create tenant rows.
//   - Stage 1 covers Capability, Deliverable, Service and Policy. Pack, Template and Profile follow in later stages.
//     TransitionDefinition has no fixture: a persisted row would change how the engine moves real entities.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { ontologyDB } from "../src/dblayer/ontologyDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import type { SchemaDefinitionEntityKind } from "../src/dblayer/seuTypes.js";
import { createAuthoringDraft } from "../src/routes/seu/core/sdkAuthoring.js";
import { activeMappingByNoun } from "../src/routes/seu/core/authorityVocabulary.js";
import { listTransitionsForEntityType } from "../src/routes/seu/core/policyDefinitions.js";
import { advanceAuthoringDraftToActive, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

// The viewer the production validators use when they check an Ontology value without naming one: the Platform vocabulary.
const PLATFORM_VIEWER = { isRoot: false, tenantId: null as string | null };

// The test Ontology: the concept codes the test seed adds to the Platform vocabulary, by concept type.
const TEST_ONTOLOGY_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "dblayer", "seed", "data", "test-ontology.json");
const TEST_ONTOLOGY_CODES = new Map<string, Set<string>>();
for (const row of JSON.parse(readFileSync(TEST_ONTOLOGY_PATH, "utf8")) as Array<{ concept_type: string; code: string }>) {
  if (!TEST_ONTOLOGY_CODES.has(row.concept_type)) TEST_ONTOLOGY_CODES.set(row.concept_type, new Set());
  TEST_ONTOLOGY_CODES.get(row.concept_type)!.add(row.code);
}
// Ontology codes are lowercase and hyphenated; a few test rows are labels with spaces and slashes, which a fixture does not use.
const ONTOLOGY_CODE = /^[a-z][a-z0-9-]*$/;

// A short tag that keeps the codes and names of one test run apart from those of another.
export const fixtureRun = randomUUID().slice(0, 8);

export interface FixtureRow {
  id: string;
  code: string;
  // The name the Registry view page shows for the row.
  shownName: string;
  // The content the row was authored with.
  content: Record<string, unknown>;
}

export async function createFixtureTenant(label: string): Promise<string> {
  const { data, error } = await tenantsDB.create({ code: `fx-${label}-${fixtureRun}`, name: `Fixture tenant ${label} ${fixtureRun}`, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, is_system: false });
  if (error || !data) throw error ?? new Error("schemaFixtures: tenant not created");
  return data.id;
}

// `count` Active Platform concept codes of a type, after skipping `skip`. Distinct skips give distinct codes. Used for the types the test
// Ontology does not cover (category:*, role-name, worktype-name).
export async function platformConceptCodes(conceptType: string, count: number, skip = 0): Promise<string[]> {
  const { data, error } = await ontologyDB.findConceptsByType(conceptType, PLATFORM_VIEWER);
  if (error) throw error;
  const codes = [...new Set((data ?? []).map((c) => c.code))];
  if (codes.length < skip + count) throw new Error(`schemaFixtures: needs ${skip + count} Active "${conceptType}" concepts, the Ontology holds ${codes.length}`);
  return codes.slice(skip, skip + count);
}

// `count` codes of a concept type that the test Ontology adds and that are Active in the database, after skipping `skip`.
export async function testOntologyCodes(conceptType: string, count: number, skip = 0): Promise<string[]> {
  const fromTestOntology = TEST_ONTOLOGY_CODES.get(conceptType);
  if (!fromTestOntology) throw new Error(`schemaFixtures: the test Ontology has no "${conceptType}" rows`);
  const { data, error } = await ontologyDB.findConceptsByType(conceptType, PLATFORM_VIEWER);
  if (error) throw error;
  const codes = [...new Set((data ?? []).map((c) => c.code))].filter((code) => fromTestOntology.has(code) && ONTOLOGY_CODE.test(code));
  if (codes.length < skip + count) throw new Error(`schemaFixtures: needs ${skip + count} Active test-Ontology "${conceptType}" concepts, the database holds ${codes.length}`);
  return codes.slice(skip, skip + count);
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

// Creates the draft and walks it to Active as the root actor. Returns the row id.
async function authorActive(kind: SchemaDefinitionEntityKind, tenantId: string, content: Record<string, unknown>): Promise<string> {
  const { data: schema } = await schemaDefinitionsDB.findLatest(kind);
  if (!schema) throw new Error(`schemaFixtures: no schema_definitions grammar for ${kind}`);
  const created = await createAuthoringDraft({ kind, actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, tenantId, schemaDefinitionId: schema.id, content });
  if (!created.ok) throw new Error(`schemaFixtures: the ${kind} draft was refused: ${created.errors.join("; ")}`);
  const active = await advanceAuthoringDraftToActive(kind, created.draftId, ROOT_ACTOR_ID);
  if (!active.ok) throw new Error(`schemaFixtures: the ${kind} could not reach Active: ${active.errors.join("; ")}`);
  return created.draftId;
}

// ---- Capability -------------------------------------------------------------------------------------------------------

export async function maximalCapability(tenantId: string, input: { code: string }): Promise<FixtureRow> {
  const [category] = await platformConceptCodes("category:capability", 1);
  const roleNames = await platformConceptCodes("role-name", 2);
  const worktypes = await platformConceptCodes("worktype-name", 3);
  const content: Record<string, unknown> = {
    code: input.code,
    defaultLabel: `Fixture Capability ${fixtureRun}`,
    category,
    description: `Fixture Capability ${fixtureRun}, every property of the Capability schema filled.`,
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
    name: `Fixture Deliverable ${fixtureRun}`,
    description: `Fixture Deliverable ${fixtureRun}, every property of the Deliverable schema filled.`,
    guideLocation: `https://example.test/fixtures/${fixtureRun}/${input.code}`,
    definitionVersion: "1.0.0",
  };
  // The Registry page shows the code with its hyphens as spaces.
  return { id: await authorActive("Deliverable", tenantId, content), code: input.code, shownName: input.code.replace(/-/g, " "), content };
}

// ---- Service ----------------------------------------------------------------------------------------------------------

export async function maximalService(tenantId: string, input: { code: string; capabilityCode: string; inputs: string[]; outputs: string[]; consumers: string[] }): Promise<FixtureRow> {
  const content: Record<string, unknown> = {
    code: input.code,
    name: `Fixture Service ${fixtureRun}`,
    capabilityCode: input.capabilityCode,
    purpose: `Fixture Service ${fixtureRun}, every property of the Service schema filled.`,
    inputs: input.inputs,
    outputs: input.outputs,
    consumers: input.consumers,
    governance: "Reviewed by the fixture owner before each release.",
    success: "Every output is delivered and accepted.",
    serviceLevel: [
      { code: "fixture-coverage", label: "Percent of inputs covered", units: "percent", target: 95, target_level: "minimum" },
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
    name: `Fixture Policy ${fixtureRun}`,
    description: `Fixture Policy ${fixtureRun}, every property of the Policy schema filled.`,
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

// ---- Stage 1 ----------------------------------------------------------------------------------------------------------

export interface Stage1Fixtures {
  tenantId: string;
  capability: FixtureRow;
  inputDeliverable: FixtureRow;
  outputDeliverable: FixtureRow;
  service: FixtureRow;
  policy: FixtureRow;
}

// Codes are taken from the test Ontology with distinct offsets, so every row of the stage has a code of its own. The Service
// is aligned to the Capability and reads the two Deliverables, so the Registry pages find each of them Active.
export async function buildStage1Fixtures(tenantId: string): Promise<Stage1Fixtures> {
  const [capabilityCode, consumerOne, consumerTwo] = await testOntologyCodes("capability-name", 3);
  const [inputCode, outputCode, policyDeliverableCode] = await testOntologyCodes("deliverable-name", 3);
  const [serviceCode] = await testOntologyCodes("service-name", 1);

  const capability = await maximalCapability(tenantId, { code: capabilityCode });
  const inputDeliverable = await maximalDeliverable(tenantId, { code: inputCode });
  const outputDeliverable = await maximalDeliverable(tenantId, { code: outputCode });
  const service = await maximalService(tenantId, { code: serviceCode, capabilityCode, inputs: [inputCode], outputs: [outputCode], consumers: [consumerOne, consumerTwo] });
  const policy = await maximalPolicy(tenantId, { code: `fixture-policy-${fixtureRun}`, deliverableCode: policyDeliverableCode });
  return { tenantId, capability, inputDeliverable, outputDeliverable, service, policy };
}
