// Capability Definition and Service Definition validation and inheritance (src/routes/seu/core/capabilityDefinitions.ts, serviceDefinitions.ts).
//
//   - validateCapabilityDefinitionSeed and validateServiceDefinitionSeed are called directly with seeds that break one rule each, and the
//     error text is asserted. The authoring controller reaches only the valid path.
//   - Every Ontology code a valid seed uses is a test Ontology concept (tests/schemaFixtures.ts) or a Platform role-name / worktype-name concept.
//   - The parent rules and the inheritance functions use the Active Capability and Service of a schema fixture tenant, an Active Platform
//     row, and a Draft that copyXAsNewDraft makes from the fixture (one more Draft per run, as in the other tests that create tenant rows).
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { capabilityDefinitionsDB } from "../src/dblayer/capabilityDefinitionsDB.js";
import { serviceDefinitionsDB } from "../src/dblayer/serviceDefinitionsDB.js";
import {
  validateCapabilityDefinitionSeed, listInheritableCapabilityDefinitions, inheritedCapabilityDefinitionContent, copyCapabilityDefinitionAsNewDraft,
  type CapabilityDefinitionSeedInput,
} from "../src/routes/seu/core/capabilityDefinitions.js";
import {
  validateServiceDefinitionSeed, listInheritableServiceDefinitions, inheritedServiceDefinitionContent, copyServiceDefinitionAsNewDraft,
  type ServiceDefinitionSeedInput,
} from "../src/routes/seu/core/serviceDefinitions.js";
import { PLATFORM_TENANT_ID, ROOT_ACTOR_ID } from "./testFixtures.js";
import { ensureFixtureTenant, buildStage1Fixtures, platformConceptCodes, FIXTURE_CODES, type Stage1Fixtures } from "./schemaFixtures.js";

let ownerTenant: string;
let otherTenant: string;
let stage1: Stage1Fixtures;
let roleName: string;
let worktype: string;
let capabilityDraftId: string;
let serviceDraftId: string;

before(async () => {
  [roleName] = await platformConceptCodes("role-name", 1);
  [worktype] = await platformConceptCodes("worktype-name", 1);
  ownerTenant = await ensureFixtureTenant("definition-validation");
  otherTenant = await ensureFixtureTenant("definition-validation-other");
  stage1 = await buildStage1Fixtures(ownerTenant);

  const capabilityCopy = await copyCapabilityDefinitionAsNewDraft(stage1.capability.id, ROOT_ACTOR_ID);
  assert.equal(capabilityCopy.ok, true, capabilityCopy.ok ? "" : capabilityCopy.errors.join("; "));
  if (!capabilityCopy.ok) throw new Error("unreachable");
  capabilityDraftId = capabilityCopy.draftId;

  const serviceCopy = await copyServiceDefinitionAsNewDraft(stage1.service.id, ROOT_ACTOR_ID);
  assert.equal(serviceCopy.ok, true, serviceCopy.ok ? "" : serviceCopy.errors.join("; "));
  if (!serviceCopy.ok) throw new Error("unreachable");
  serviceDraftId = serviceCopy.draftId;
});

// ---- Capability Definition --------------------------------------------------------------------------------------------

function capabilitySeed(overrides: Partial<CapabilityDefinitionSeedInput> = {}): CapabilityDefinitionSeedInput {
  return { code: "pdv-capability", defaultLabel: "Capability validation", category: "any-category", roles: [{ name: roleName, worktypes: [worktype] }], version: "1.0.0", tenantId: ownerTenant, ...overrides };
}

async function capabilityErrors(seed: CapabilityDefinitionSeedInput): Promise<string> {
  const result = await validateCapabilityDefinitionSeed(seed);
  return result.ok ? "" : result.errors.join("\n");
}

test("Capability: a valid seed passes", async () => {
  assert.deepEqual(await validateCapabilityDefinitionSeed(capabilitySeed()), { ok: true });
});

test("Capability: code, label, category and version are required", async () => {
  const text = await capabilityErrors(capabilitySeed({ code: " ", defaultLabel: "", category: "", version: "x" }));
  assert.match(text, /code is required/);
  assert.match(text, /defaultLabel is required/);
  assert.match(text, /category is required/);
  assert.match(text, /version must be semver/);
});

test("Capability: a role needs a name, a canonical role-name and canonical worktype-names", async () => {
  assert.match(await capabilityErrors(capabilitySeed({ roles: [{ name: " ", worktypes: [] }] })), /role 1: name is required/);

  const text = await capabilityErrors(capabilitySeed({ roles: [{ name: roleName, worktypes: [worktype] }, { name: "not-a-role", worktypes: ["not-a-worktype"] }] }));
  assert.match(text, /role 2: "not-a-role" is not a canonical role-name concept/);
  assert.match(text, /role 2: "not-a-worktype" is not a canonical worktype-name concept/);
  assert.doesNotMatch(text, /role 1/);
});

test("Capability: a parent must exist, be Active and be visible to the tenant", async () => {
  const withParent = (parentCapabilityDefinitionId: string, tenantId: string) => capabilitySeed({ parentCapabilityDefinitionId, tenantId });
  const [platformParent] = await listInheritableCapabilityDefinitions();
  assert.ok(platformParent, "the database holds an Active Platform Capability Definition");

  const missingId = randomUUID();
  assert.match(await capabilityErrors(withParent(missingId, ownerTenant)), new RegExp(`parentCapabilityDefinitionId "${missingId}" not found`));
  assert.match(await capabilityErrors(withParent(capabilityDraftId, ownerTenant)), /a Capability Definition can only be inherited from an Active Version/);
  assert.match(await capabilityErrors(withParent(stage1.capability.id, otherTenant)), /parent Capability Definition is not visible to this tenant/);

  assert.equal(await capabilityErrors(withParent(stage1.capability.id, ownerTenant)), "", "a parent of the same tenant is visible");
  assert.equal(await capabilityErrors(withParent(platformParent.id, otherTenant)), "", "a Platform parent is visible to every tenant");
});

test("Capability: listInheritableCapabilityDefinitions lists the Active Platform rows by code", async () => {
  const listed = await listInheritableCapabilityDefinitions();
  assert.ok(listed.length > 0);
  assert.deepEqual(listed.map((c) => c.code), [...listed.map((c) => c.code)].sort((a, b) => a.localeCompare(b)));
  for (const item of listed.slice(0, 20)) {
    const { data: row } = await capabilityDefinitionsDB.findById(item.id);
    assert.equal(row?.tenant_id, PLATFORM_TENANT_ID);
    assert.equal(row?.status, "Active");
    assert.deepEqual(item, { id: row!.id, code: row!.code, defaultLabel: row!.default_label, version: row!.version });
  }
});

test("Capability: inheritedCapabilityDefinitionContent returns the parent's content, and refuses a missing parent and one that is not Active", async () => {
  const result = await inheritedCapabilityDefinitionContent(stage1.capability.id);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  assert.equal(result.content.code, stage1.capability.code);
  assert.equal(result.content.defaultLabel, stage1.capability.content.defaultLabel);
  assert.equal(result.content.description, stage1.capability.content.description);
  assert.equal(result.content.category, stage1.capability.content.category);
  assert.deepEqual(result.content.roles, stage1.capability.content.roles);

  assert.deepEqual(await inheritedCapabilityDefinitionContent(randomUUID()), { ok: false, error: "parent Capability Definition not found" });
  assert.deepEqual(await inheritedCapabilityDefinitionContent(capabilityDraftId), { ok: false, error: "a Capability Definition can only be inherited from an Active Version" });
});

// ---- Service Definition -----------------------------------------------------------------------------------------------

function serviceSeed(overrides: Partial<ServiceDefinitionSeedInput> = {}): ServiceDefinitionSeedInput {
  return {
    code: FIXTURE_CODES.service.code, name: "Service validation", capabilityCode: FIXTURE_CODES.capability.code,
    inputs: [FIXTURE_CODES.input.code], outputs: [FIXTURE_CODES.output.code], consumers: [FIXTURE_CODES.consumerA.code], version: "1.0.0", tenantId: ownerTenant,
    ...overrides,
  };
}

async function serviceErrors(seed: ServiceDefinitionSeedInput): Promise<string> {
  const result = await validateServiceDefinitionSeed(seed);
  return result.ok ? "" : result.errors.join("\n");
}

test("Service: a valid seed passes", async () => {
  assert.deepEqual(await validateServiceDefinitionSeed(serviceSeed()), { ok: true });
});

test("Service: code, name, capabilityCode and version are required, and a blank code or capability is not also checked against the Ontology", async () => {
  const text = await serviceErrors(serviceSeed({ code: " ", name: "", capabilityCode: "", version: "x" }));
  assert.match(text, /code is required/);
  assert.match(text, /name is required/);
  assert.match(text, /capabilityCode is required/);
  assert.match(text, /version must be semver/);
  assert.doesNotMatch(text, /canonical/);
});

test("Service: the code, capability, consumers, inputs and outputs must be canonical Ontology concepts", async () => {
  const text = await serviceErrors(serviceSeed({
    code: "not-a-service", capabilityCode: "not-a-capability", consumers: ["not-a-consumer"], inputs: ["not-an-input"], outputs: ["not-an-output"],
  }));
  assert.match(text, /"not-a-service" is not a canonical service-name concept/);
  assert.match(text, /"not-a-capability" is not a canonical capability-name concept/);
  assert.match(text, /"not-a-consumer" is not a canonical capability-name concept/);
  assert.match(text, /"not-an-input" is not a canonical deliverable-name concept/);
  assert.match(text, /"not-an-output" is not a canonical deliverable-name concept/);
});

test("Service: a parent must exist, be Active and be visible to the tenant", async () => {
  const withParent = (parentServiceDefinitionId: string, tenantId: string) => serviceSeed({ parentServiceDefinitionId, tenantId });
  const [platformParent] = await listInheritableServiceDefinitions();
  assert.ok(platformParent, "the database holds an Active Platform Service Definition");

  const missingId = randomUUID();
  assert.match(await serviceErrors(withParent(missingId, ownerTenant)), new RegExp(`parentServiceDefinitionId "${missingId}" not found`));
  assert.match(await serviceErrors(withParent(serviceDraftId, ownerTenant)), /a Service Definition can only be inherited from an Active Version/);
  assert.match(await serviceErrors(withParent(stage1.service.id, otherTenant)), /parent Service Definition is not visible to this tenant/);

  assert.equal(await serviceErrors(withParent(stage1.service.id, ownerTenant)), "", "a parent of the same tenant is visible");
  assert.equal(await serviceErrors(withParent(platformParent.id, otherTenant)), "", "a Platform parent is visible to every tenant");
});

test("Service: listInheritableServiceDefinitions lists the Active Platform rows by code", async () => {
  const listed = await listInheritableServiceDefinitions();
  assert.ok(listed.length > 0);
  assert.deepEqual(listed.map((s) => s.code), [...listed.map((s) => s.code)].sort((a, b) => a.localeCompare(b)));
  for (const item of listed.slice(0, 20)) {
    const { data: row } = await serviceDefinitionsDB.findById(item.id);
    assert.equal(row?.tenant_id, PLATFORM_TENANT_ID);
    assert.equal(row?.status, "Active");
    assert.deepEqual(item, { id: row!.id, code: row!.code, name: row!.name, capabilityCode: row!.capability_code, version: row!.version });
  }
});

test("Service: inheritedServiceDefinitionContent returns the parent's content, and refuses a missing parent and one that is not Active", async () => {
  const result = await inheritedServiceDefinitionContent(stage1.service.id);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  const content = stage1.service.content;
  for (const key of ["code", "name", "capabilityCode", "purpose", "inputs", "outputs", "governance", "success", "consumers"]) {
    assert.deepEqual(result.content[key], content[key], key);
  }
  assert.equal((result.content.serviceLevel as unknown[]).length, (content.serviceLevel as unknown[]).length);

  assert.deepEqual(await inheritedServiceDefinitionContent(randomUUID()), { ok: false, error: "parent Service Definition not found" });
  assert.deepEqual(await inheritedServiceDefinitionContent(serviceDraftId), { ok: false, error: "a Service Definition can only be inherited from an Active Version" });
});
