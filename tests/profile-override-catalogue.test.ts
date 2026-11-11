// A save of a Profile with its own Deliverable Catalogue is rejected for an override of a Service that makes none of the catalogue's Deliverables.
// The validation reads the maximal Active fixtures of tests/schemaFixtures.ts (Stage 4); nothing is written.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";

import { validateProfileDeliverables } from "../src/routes/seu/core/profiles.js";
import { reconstructProfileParameterOverrides } from "../src/routes/seu/web/sdkAuthoring.js";
import { ensureFixtureTenant, buildStage4Fixtures, FIXTURE_CODES, FIXTURE_SERVICE_LEVEL_CODE } from "./schemaFixtures.js";

test("validateProfileDeliverables: an override of a Service that makes none of the catalogue's Deliverables is rejected", async () => {
  const tenantId = await ensureFixtureTenant("views");
  const stage = await buildStage4Fixtures(tenantId);
  // The fixture Service makes the fixture output Deliverable, which the base Template's catalogue holds together with the input Deliverable.
  const override = { sourceType: "service", sourceCode: stage.service.code, parameterName: FIXTURE_SERVICE_LEVEL_CODE, value: "5" };
  const seedWith = (catalogueCode: string) =>
    ({ tenantId, baseTemplateCode: stage.template.code, deliverableCatalogue: [{ code: catalogueCode }], dependencyGraph: [], exposedParameterOverrides: [override] }) as unknown as Parameters<typeof validateProfileDeliverables>[0];
  const stale = (errors: string[]) => errors.filter((e) => e.includes("belongs to no Deliverable of the catalogue"));

  assert.equal(stale(await validateProfileDeliverables(seedWith(FIXTURE_CODES.output.code))).length, 0, "the Service makes a Deliverable of the catalogue");
  const errors = stale(await validateProfileDeliverables(seedWith(FIXTURE_CODES.input.code)));
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes(stage.service.code) && errors[0].includes(FIXTURE_SERVICE_LEVEL_CODE), "the error names the Service and the level");
});

test("validateProfileDeliverables: a level flagged Not required for a Service outside the catalogue is not rejected", async () => {
  const tenantId = await ensureFixtureTenant("views");
  const stage = await buildStage4Fixtures(tenantId);
  const omitted = { sourceType: "service", sourceCode: stage.service.code, parameterName: FIXTURE_SERVICE_LEVEL_CODE, value: "", notRequired: true };
  const seed = { tenantId, baseTemplateCode: stage.template.code, deliverableCatalogue: [{ code: FIXTURE_CODES.input.code }], dependencyGraph: [], exposedParameterOverrides: [omitted] } as unknown as Parameters<typeof validateProfileDeliverables>[0];
  const errors = (await validateProfileDeliverables(seed)).filter((e) => e.includes("belongs to no Deliverable of the catalogue"));
  assert.equal(errors.length, 0, "an omitted level does not hold its Deliverable in the catalogue");
});

// The form post after a Deliverable is removed from the catalogue: the Remove button deletes the rows of the Service Levels that were flagged Not required,
// so they are absent from the post. What is saved keeps the other overrides, holds no row of the removed Deliverable's Service, and passes the save check.
test("a save after a Deliverable removal: the flagged Service Level rows are gone, the other overrides are kept, and the Profile validates", async () => {
  const tenantId = await ensureFixtureTenant("views");
  const stage = await buildStage4Fixtures(tenantId);
  const body: Record<string, unknown> = {
    exposedParamOverrideRows: {
      0: { sourceType: "policy", sourceCode: "kept-policy", parameterName: "constraintType", value: "Standard" },
    },
  };
  reconstructProfileParameterOverrides(body);
  const saved = JSON.parse(body.exposedParameterOverrides as string) as Array<{ sourceType: string; sourceCode: string }>;
  assert.deepEqual(saved, [{ sourceType: "policy", sourceCode: "kept-policy", parameterName: "constraintType", value: "Standard" }]);
  assert.ok(!saved.some((row) => row.sourceCode === stage.service.code), "no override of the removed Deliverable's Service is saved");

  const seed = { tenantId, baseTemplateCode: stage.template.code, deliverableCatalogue: [{ code: FIXTURE_CODES.input.code }], dependencyGraph: [], exposedParameterOverrides: saved } as unknown as Parameters<typeof validateProfileDeliverables>[0];
  assert.deepEqual(await validateProfileDeliverables(seed), []);
});

test("a save that still holds an unflagged Service Level value for a removed Deliverable is rejected", async () => {
  const tenantId = await ensureFixtureTenant("views");
  const stage = await buildStage4Fixtures(tenantId);
  const body: Record<string, unknown> = {
    exposedParamOverrideRows: { 0: { sourceType: "service", sourceCode: stage.service.code, parameterName: FIXTURE_SERVICE_LEVEL_CODE, value: "5" } },
  };
  reconstructProfileParameterOverrides(body);
  const saved = JSON.parse(body.exposedParameterOverrides as string);
  const seed = { tenantId, baseTemplateCode: stage.template.code, deliverableCatalogue: [{ code: FIXTURE_CODES.input.code }], dependencyGraph: [], exposedParameterOverrides: saved } as unknown as Parameters<typeof validateProfileDeliverables>[0];
  assert.equal((await validateProfileDeliverables(seed)).filter((e) => e.includes("belongs to no Deliverable of the catalogue")).length, 1);
});
