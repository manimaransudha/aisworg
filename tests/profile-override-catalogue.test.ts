// A save of a Profile with its own Deliverable Catalogue is rejected for an override of a Service that makes none of the catalogue's Deliverables.
// The validation reads the maximal Active fixtures of tests/schemaFixtures.ts (Stage 4); nothing is written.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";

import { validateProfileDeliverables } from "../src/routes/seu/core/profiles.js";
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
