// A Profile marks a Service Level as not required: the flag is read back from the posted form rows, resolveEffectiveParameters reports it,
// unravelServices gathers it for the EBM composition, and the Profile view lists every parameter with its status.
//   - The "omitted" Profile view test authors one Profile Draft in the fixture tenant, through createAuthoringDraft as schemaFixtures does.
//   - The rows read are the maximal Active fixtures of tests/schemaFixtures.ts (the Template, the Service and the Profile of Stage 4), in the
//     tenant the Registry view tests use. Nothing is written: a Profile with a flag is an in-memory row built from the fixture Profile.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { before, test } from "node:test";
import assert from "node:assert/strict";

import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { createAuthoringDraft } from "../src/routes/seu/core/sdkAuthoring.js";
import { extractExposedParameters, type ExposedParameter } from "../src/routes/seu/core/templates.js";
import { resolveEffectiveParameters } from "../src/routes/seu/core/profiles.js";
import { getProfileView } from "../src/routes/seu/core/profileView.js";
import { unravelServices } from "../src/domain/engine/conflicts/unravelServices.js";
import { reconstructProfileParameterOverrides } from "../src/routes/seu/web/sdkAuthoring.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";
import { ensureFixtureTenant, buildStage4Fixtures, type Stage4Fixtures } from "./schemaFixtures.js";
import type { ProfileRow, TemplateRow } from "../src/dblayer/seuTypes.js";

let tenantId: string;
let stage: Stage4Fixtures;
let template: TemplateRow;
let profile: ProfileRow;
// A Service Level of the fixture Service that the Template flags overridable, and a parameter the Template does not.
let level: ExposedParameter;
let locked: ExposedParameter;

const keyOf = (p: { sourceType: string; sourceCode: string; parameterName: string }) => `${p.sourceType}::${p.sourceCode}::${p.parameterName}`;
const override = (p: ExposedParameter, extra: Record<string, unknown>) => ({ sourceType: p.sourceType, sourceCode: p.sourceCode, parameterName: p.parameterName, ...extra });
// The fixture Profile with only the given overrides, and no Deliverable Catalogue of its own, so the Template's catalogue applies.
const profileWith = (overrides: unknown[]): ProfileRow => ({ ...profile, draft_content: { exposedParameterOverrides: overrides } }) as ProfileRow;

before(async () => {
  tenantId = await ensureFixtureTenant("views");
  stage = await buildStage4Fixtures(tenantId);
  const { data: templateRow } = await templatesDB.findById(stage.template.id);
  const { data: profileRow } = await profilesDB.findById(stage.profile.id);
  assert.ok(templateRow && profileRow, "the fixture Template and Profile exist");
  template = templateRow;
  profile = profileRow;
  const exposed = extractExposedParameters(template.draft_content as Record<string, unknown>) ?? [];
  const serviceLevel = exposed.find((e) => e.sourceType === "service" && e.sourceCode === stage.service.code && e.overridable && e.value !== undefined);
  const notOverridable = exposed.find((e) => !e.overridable && e.value !== undefined);
  assert.ok(serviceLevel, "the Template exposes a Service Level of the fixture Service as overridable");
  assert.ok(notOverridable, "the Template exposes a parameter that is not overridable");
  level = serviceLevel;
  locked = notOverridable;
});

test("resolveEffectiveParameters: a not-required level is reported and keeps the Template's value, an override sets the value, and a parameter the Template did not make overridable is untouched", async () => {
  const find = async (overrides: unknown[], target: ExposedParameter) => (await resolveEffectiveParameters(profileWith(overrides))).find((p) => keyOf(p) === keyOf(target))!;

  const omitted = await find([override(level, { value: "", notRequired: true })], level);
  assert.deepEqual([omitted.notRequired, omitted.overriddenByProfile, omitted.effectiveValue], [true, false, level.value], "the flagged override's empty value does not replace the Template's value");

  const overridden = await find([override(level, { value: "77" })], level);
  assert.deepEqual([overridden.notRequired, overridden.overriddenByProfile, overridden.effectiveValue], [false, true, "77"]);

  const plain = await find([], level);
  assert.deepEqual([plain.notRequired, plain.overriddenByProfile, plain.effectiveValue], [false, false, level.value]);

  const ignored = await find([override(locked, { value: "", notRequired: true })], locked);
  assert.equal(ignored.notRequired, false, "the Template did not allow an override of this parameter");
});

test("unravelServices: the not-required levels are gathered per Service, and only when the Profile flags them", async () => {
  const flagged = await unravelServices({ templates: [template], profiles: [profileWith([override(level, { value: "", notRequired: true })])] }, tenantId);
  assert.deepEqual(flagged.notRequiredLevels, { [stage.service.code]: [level.parameterName] });

  const plain = await unravelServices({ templates: [template], profiles: [profileWith([])] }, tenantId);
  assert.deepEqual(plain.notRequiredLevels, {});
});

test("the Profile view lists every Template parameter with its status, and names the Capability of a Service", async () => {
  const view = await getProfileView(stage.profile.id, { isRoot: false, tenantId });
  assert.ok(view);
  const byKey = new Map(view.parameters.map((p) => [keyOf(p), p]));
  assert.equal(byKey.get(keyOf(level))?.state, "overridden", "the fixture Profile overrides every parameter the Template flags overridable");
  assert.equal(byKey.get(keyOf(locked))?.state, "template");
  assert.ok(view.parameterCapabilities[`service::${stage.service.code}`], "the Service's Capability is named");
});

test("the Profile view lists a level the Profile marks as not required as omitted, with no value", async () => {
  const { data: schema } = await schemaDefinitionsDB.findLatest("Profile");
  assert.ok(schema, "the Profile grammar exists");
  const fixtureOverrides = stage.profile.content.exposedParameterOverrides as Array<Record<string, unknown>>;
  const exposedParameterOverrides = [...fixtureOverrides.filter((row) => keyOf(row as never) !== keyOf(level)), override(level, { value: "", notRequired: true })];
  const created = await createAuthoringDraft({
    kind: "Profile", actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, tenantId, schemaDefinitionId: schema.id,
    content: { ...stage.profile.content, code: `test-omitted-profile-${randomUUID()}`, exposedParameterOverrides },
  });
  assert.ok(created.ok, created.ok ? "" : created.errors.join("; "));

  const view = await getProfileView(created.draftId, { isRoot: false, tenantId });
  assert.ok(view);
  const omitted = view.parameters.find((p) => keyOf(p) === keyOf(level));
  assert.deepEqual([omitted?.state, omitted?.value], ["omitted", ""]);
  const locked_ = view.parameters.find((p) => keyOf(p) === keyOf(locked));
  assert.equal(locked_?.state, "template", "a parameter the Profile does not touch shows the Template's value");
});

test("reconstructProfileParameterOverrides: a ticked Service Level is kept with an empty value, an unticked blank row is dropped, a value is kept", () => {
  const row = (parameterName: string, extra: Record<string, unknown>) => ({ sourceType: "service", sourceCode: "svc", parameterName, ...extra });
  const body: Record<string, unknown> = {
    exposedParamOverrideRows: {
      0: row("a", { value: "5", notRequired: "true" }),
      1: row("b", { value: "" }),
      2: row("c", { value: "9" }),
      3: { sourceType: "policy", sourceCode: "pol", parameterName: "d", value: "x", notRequired: "true" },
    },
  };
  reconstructProfileParameterOverrides(body);
  assert.deepEqual(JSON.parse(body.exposedParameterOverrides as string), [
    { sourceType: "service", sourceCode: "svc", parameterName: "a", value: "", notRequired: true },
    { sourceType: "service", sourceCode: "svc", parameterName: "c", value: "9" },
    { sourceType: "policy", sourceCode: "pol", parameterName: "d", value: "x" },
  ]);
});
