// CR-139: the Services conflict detector. Its core works on gathered facts, so these tests build the facts and the Pack lists by hand.
import { test } from "node:test";
import assert from "node:assert/strict";

import { CONFLICT_NO_VALUE } from "../src/dblayer/constants.js";
import { CONFLICT_DETECTORS, detectServiceConflicts } from "../src/domain/engine/conflicts/index.js";
import { chosenServices, detectServiceConflictsFrom, serviceChoiceKey, serviceLevelKey, type PackServiceList } from "../src/domain/engine/conflicts/services.js";
import type { ServiceCandidate, ServicesUnraveled } from "../src/domain/engine/conflicts/unravelServices.js";

const svcA: ServiceCandidate = { code: "svc-a", name: "Service A", defaultLevels: { uptime: 90, latency: 4 } };
const svcB: ServiceCandidate = { code: "svc-b", name: "Service B", defaultLevels: {} };

const facts = (candidates: ServicesUnraveled["candidates"], levelSettings: ServicesUnraveled["levelSettings"] = {}): ServicesUnraveled => ({ deliverableCodes: Object.keys(candidates), candidates, levelSettings, deliverableNames: {} });
const packList = (pack: string, code: string, levels: Array<{ code: string; target: number }>): PackServiceList => ({ source: { id: `id-${pack}`, code: pack, label: pack }, services: [{ code, serviceLevel: levels }] });

test("one candidate Service is used without a question", () => {
  const f = facts({ "doc-1": [svcA] });
  assert.deepEqual(detectServiceConflictsFrom(f, []), []);
  assert.deepEqual(chosenServices(f.candidates, {}), { "doc-1": "svc-a" });
});

test("several candidate Services ask the user to pick, with the work-stream message", () => {
  const conflicts = detectServiceConflictsFrom(facts({ "doc-1": [svcA, svcB] }), []);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].key, serviceChoiceKey("doc-1"));
  assert.equal(conflicts[0].kind, "service-choice");
  assert.match(conflicts[0].message, /different Profile for each work stream/);
  assert.deepEqual(conflicts[0].options.map((o) => o.value), ["svc-a", "svc-b"]);
});

test("a picked Service is recorded on the choice conflict and becomes the Deliverable's Service", () => {
  const f = facts({ "doc-1": [svcA, svcB] });
  const resolutions = { [serviceChoiceKey("doc-1")]: "svc-b" };
  assert.deepEqual(detectServiceConflictsFrom(f, [], resolutions).map((c) => c.resolution), ["svc-b"]);
  assert.deepEqual(chosenServices(f.candidates, resolutions), { "doc-1": "svc-b" });
});

test("a Service the Packs do not list is not compared", () => {
  assert.deepEqual(detectServiceConflictsFrom(facts({ "doc-1": [svcA] }), [packList("pack-1", "svc-b", [{ code: "uptime", target: 1 }])]), []);
});

test("equal levels are no conflict", () => {
  assert.deepEqual(detectServiceConflictsFrom(facts({ "doc-1": [svcA] }), [packList("pack-1", "svc-a", [{ code: "uptime", target: 90 }, { code: "latency", target: 4 }])]), []);
});

test("a different level value is a conflict between the Deliverable's Service and the Pack", () => {
  const conflicts = detectServiceConflictsFrom(facts({ "doc-1": [svcA] }), [packList("pack-1", "svc-a", [{ code: "uptime", target: 99 }, { code: "latency", target: 4 }])]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].key, serviceLevelKey("svc-a", "uptime"));
  assert.equal(conflicts[0].kind, "level-different");
  assert.deepEqual(conflicts[0].options.map((o) => [o.sourceKind, o.value]), [["definition", 90], ["pack", 99]]);
});

test("a level the Packs add is a conflict, and the user can take it or leave it out", () => {
  const conflicts = detectServiceConflictsFrom(facts({ "doc-1": [svcA] }), [packList("pack-1", "svc-a", [{ code: "uptime", target: 90 }, { code: "latency", target: 4 }, { code: "throughput", target: 7 }])]);
  assert.deepEqual(conflicts.map((c) => [c.key, c.kind]), [[serviceLevelKey("svc-a", "throughput"), "level-added"]]);
  assert.deepEqual(conflicts[0].options.map((o) => o.value), [CONFLICT_NO_VALUE, 7]);
});

test("a level the Deliverable's Service has and the Packs do not list is no conflict", () => {
  assert.deepEqual(detectServiceConflictsFrom(facts({ "doc-1": [svcA] }), [packList("pack-1", "svc-a", [{ code: "uptime", target: 90 }])]), []);
});

test("a pick of \"no value\" is a pick, so the conflict is resolved", () => {
  const key = serviceLevelKey("svc-a", "throughput");
  const conflicts = detectServiceConflictsFrom(facts({ "doc-1": [svcA] }), [packList("pack-1", "svc-a", [{ code: "uptime", target: 90 }, { code: "latency", target: 4 }, { code: "throughput", target: 7 }])], { [key]: CONFLICT_NO_VALUE });
  assert.deepEqual(conflicts.map((c) => c.resolution), [CONFLICT_NO_VALUE]);
});

test("the Template's value and then the Profile's override take the place of the Service Definition default", () => {
  const packs = [packList("pack-1", "svc-a", [{ code: "uptime", target: 95 }, { code: "latency", target: 4 }])];
  const profileSet = facts({ "doc-1": [svcA] }, { "svc-a": { uptime: { value: 95, setBy: "profile", sourceId: "p1", sourceLabel: "prf" } } });
  assert.deepEqual(detectServiceConflictsFrom(profileSet, packs), [], "the Profile's 95 is the Deliverable's level and equals the Pack's");
  const templateSet = facts({ "doc-1": [svcA] }, { "svc-a": { uptime: { value: 92, setBy: "template", sourceId: "t1", sourceLabel: "tpl" } } });
  const conflicts = detectServiceConflictsFrom(templateSet, packs);
  assert.deepEqual(conflicts.map((c) => [c.key, c.options[0].sourceKind, c.options[0].value]), [[serviceLevelKey("svc-a", "uptime"), "template", 92]]);
});

test("many Packs listing the same Service count as one definition", () => {
  const levels = [{ code: "uptime", target: 90 }, { code: "latency", target: 4 }];
  assert.deepEqual(detectServiceConflictsFrom(facts({ "doc-1": [svcA] }), [packList("pack-1", "svc-a", levels), packList("pack-2", "svc-a", levels)]), []);
});

test("a picked level conflict is returned with its pick", () => {
  const conflicts = detectServiceConflictsFrom(facts({ "doc-1": [svcA] }), [packList("pack-1", "svc-a", [{ code: "uptime", target: 99 }, { code: "latency", target: 4 }])], { [serviceLevelKey("svc-a", "uptime")]: "pack" });
  assert.deepEqual(conflicts.map((c) => c.resolution), ["pack"]);
});

test("a conflict carries the user's pick, and null while it is open", () => {
  const f = facts({ "doc-1": [svcA, svcB] });
  assert.deepEqual(detectServiceConflictsFrom(f, []).map((c) => c.resolution), [null]);
  const picked = detectServiceConflictsFrom(f, [], { [serviceChoiceKey("doc-1")]: "svc-b" });
  assert.deepEqual(picked.map((c) => [c.key, c.resolution]), [[serviceChoiceKey("doc-1"), "svc-b"]], "a resolved conflict stays in the result");
});

test("every table has a detector, and the Services detector is the one that unravels for itself", () => {
  assert.deepEqual(Object.keys(CONFLICT_DETECTORS), ["services", "capabilities", "policies", "authorityRules", "qualityGates", "reviewGates", "obligationDefinitions", "engineeringCapital", "dependencies"]);
  assert.equal(CONFLICT_DETECTORS.services, detectServiceConflicts);
});
