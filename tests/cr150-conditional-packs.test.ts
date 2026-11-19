// CR-150: a Conditional Pack saves the Profile parameter values it names. The Profile selects it when the Profile is unravelled and its
// configuration holds one of those values. The Pack is stored under its own profile_packs list kind, so the Profile form and its copies never read it.
// Run against the real dev database, no mocking.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { publishPack, validatePackSeed, type PackSeedInput } from "../src/routes/seu/core/packs.js";
import { publishProfile, getProfilePackCodes, getProfilePackSelections } from "../src/routes/seu/core/profiles.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { PACK_CLASSIFICATION_CONDITIONAL } from "../src/dblayer/constants.js";
import { uniqueTestPackVersion, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, TESTER_ALL_ID, PLATFORM_TENANT_ID } from "./testFixtures.js";
import { FIXTURE_CODES } from "./schemaFixtures.js";

// A value of the ai-provider-preference concept that only the test Ontology holds, so no seeded Profile and no other test meets the condition.
const TEST_PROVIDER = FIXTURE_CODES.ai.code;
const PARAMETER = "ai-provider-preference";
// The Pack code has to be a canonical integration-name concept, so the test uses its own test-only concept. Each run publishes a new version of it.
const TEST_PACK_CODE = "test-cr150-conditional-pack";

function conditionalPackSeed(run: string, conditions: PackSeedInput["compositionConditions"]): PackSeedInput {
  return {
    tenantId: PLATFORM_TENANT_ID,
    code: TEST_PACK_CODE,
    name: `CR-150 Conditional Pack ${run}`,
    category: "Integration",
    packVersion: uniqueTestPackVersion(),
    installationClassification: PACK_CLASSIFICATION_CONDITIONAL,
    compositionConditions: conditions,
    contributions: {},
  };
}

async function publishTestProfile(run: string, suffix: string, templateCode: string, aiProviderPreference: string[]): Promise<string> {
  const published = await publishProfile({
    seed: {
      tenantId: PLATFORM_TENANT_ID,
      code: `cr150-profile-${suffix}-${run}`,
      name: `CR-150 Profile ${suffix}`,
      baseTemplateCode: templateCode,
      environment: "development",
      profileVersion: `1.0.${Date.now()}${process.pid}`,
      aiProviderPreference,
      developmentMethodology: "scrum",
      primaryProgrammingLanguage: "typescript",
      sourceControlProvider: "github",
      redispatchMaxAttempts: 5,
      redispatchAttentionThreshold: 2,
    },
    actorId: TESTER_ALL_ID,
  });
  assert.equal(published.ok, true, !published.ok ? JSON.stringify(published.errors) : "assertion failed");
  if (!published.ok) throw new Error("unreachable");
  return published.profileId;
}

test("a Conditional Pack needs a condition, and each condition names a real parameter and value", async () => {
  const run = randomUUID().slice(0, 8);
  const none = await validatePackSeed(conditionalPackSeed(run, []));
  assert.equal(none.ok, false);
  if (!none.ok) assert.ok(none.errors.some((e) => e.includes("at least one composition condition")), none.errors.join("; "));

  const blank = await validatePackSeed(conditionalPackSeed(run, [{ parameter: PARAMETER, value: "" }]));
  assert.equal(blank.ok, false);
  if (!blank.ok) assert.ok(blank.errors.some((e) => e.includes("needs a parameter and a value")), blank.errors.join("; "));

  const unknownParameter = await validatePackSeed(conditionalPackSeed(run, [{ parameter: "no-such-parameter", value: TEST_PROVIDER }]));
  assert.equal(unknownParameter.ok, false);
  if (!unknownParameter.ok) assert.ok(unknownParameter.errors.some((e) => e.includes("unknown profile-configuration parameter")), unknownParameter.errors.join("; "));

  const unknownValue = await validatePackSeed(conditionalPackSeed(run, [{ parameter: PARAMETER, value: "no-such-provider" }]));
  assert.equal(unknownValue.ok, false);
  if (!unknownValue.ok) assert.ok(unknownValue.errors.some((e) => e.includes("unknown ai-provider-preference value")), unknownValue.errors.join("; "));

  const valid = await validatePackSeed(conditionalPackSeed(run, [{ parameter: PARAMETER, value: TEST_PROVIDER }]));
  assert.equal(valid.ok, true, !valid.ok ? valid.errors.join("; ") : "assertion failed");
});

test("a Profile selects the Conditional Pack its configuration meets, under its own list kind", async () => {
  const run = randomUUID().slice(0, 8);
  const seed = conditionalPackSeed(run, [{ parameter: PARAMETER, value: TEST_PROVIDER }]);
  const pack = await publishPack({ seed, actorId: TESTER_ALL_ID, activate: true });
  assert.equal(pack.ok, true, !pack.ok ? JSON.stringify(pack) : "assertion failed");

  const { data: template } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `cr150-tpl-${run}`, name: "CR-150 Template", deliverableCatalogue: [{ code: "requirements-analysis-model" }] });
  await templatesDB.setMandatoryPacks(template!.id, [], ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  await templatesDB.setRequiredCapabilities(template!.id, [], ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);

  const meets = await publishTestProfile(run, "meets", template!.code, [TEST_PROVIDER]);
  const none = await publishTestProfile(run, "none", template!.code, ["none"]);

  assert.ok((await getProfilePackCodes(meets)).includes(seed.code), "the Profile that holds the value selects the Conditional Pack");
  assert.ok(!(await getProfilePackCodes(none)).includes(seed.code), "a Profile that holds another value does not select it");

  const selectedByTheForm = Object.values(await getProfilePackSelections(meets)).flat();
  assert.ok(!selectedByTheForm.includes(seed.code), "the Profile form selections never hold the Conditional Pack");
});
