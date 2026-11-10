// CR-139: what the EBM saves for the Services table: the conflicts with the picks, and the final result the SEU takes.
import { test } from "node:test";
import assert from "node:assert/strict";

import { CONFLICT_NO_VALUE } from "../src/dblayer/constants.js";
import { settleServicesFrom } from "../src/domain/engine/conflicts/settleServices.js";
import { serviceChoiceKey, serviceLevelKey, type PackServiceList } from "../src/domain/engine/conflicts/services.js";
import type { ServiceCandidate, ServicesUnraveled } from "../src/domain/engine/conflicts/unravelServices.js";

const svcA: ServiceCandidate = { code: "svc-a", name: "Service A", defaultLevels: { uptime: 90, latency: 4 } };
const svcB: ServiceCandidate = { code: "svc-b", name: "Service B", defaultLevels: { throughput: 10 } };
const facts = (candidates: ServicesUnraveled["candidates"], levelSettings: ServicesUnraveled["levelSettings"] = {}): ServicesUnraveled => ({ deliverableCodes: Object.keys(candidates).sort(), candidates, levelSettings, deliverableNames: { "doc-1": "Document one" } });
const packList = (code: string, levels: Array<{ code: string; target: number }>): PackServiceList[] => [{ source: { id: "id-p", code: "pack-1", label: "pack-1" }, services: [{ code, serviceLevel: levels }] }];

test("a Deliverable with one Service takes that Service and its levels, with no conflict saved", () => {
  const settled = settleServicesFrom(facts({ "doc-1": [svcA] }), []);
  assert.deepEqual(settled.conflicts, []);
  assert.deepEqual(settled.result, [{ deliverable: "doc-1", name: "Document one", service: "svc-a", levels: { uptime: 90, latency: 4 } }]);
});

test("the Template's value and the Profile's override take the place of the Service Definition default in the result", () => {
  const settled = settleServicesFrom(facts({ "doc-1": [svcA] }, { "svc-a": { uptime: { value: 95, setBy: "profile", sourceId: "p1", sourceLabel: "prf" } } }), []);
  assert.deepEqual(settled.result[0].levels, { uptime: 95, latency: 4 });
});

test("the conflict, the pick and the result are all saved: the user picks the Service for a Deliverable", () => {
  const f = facts({ "doc-1": [svcA, svcB] });
  const open = settleServicesFrom(f, []);
  assert.deepEqual(open.conflicts.map((c) => [c.kind, c.resolution]), [["service-choice", null]]);
  assert.deepEqual(open.result, [], "a Deliverable whose Service is not decided takes nothing yet");

  const picked = settleServicesFrom(f, [], { [serviceChoiceKey("doc-1")]: "svc-b" });
  assert.deepEqual(picked.conflicts.map((c) => [c.kind, c.resolution, c.options.map((o) => o.value)]), [["service-choice", "svc-b", ["svc-a", "svc-b"]]]);
  assert.deepEqual(picked.result, [{ deliverable: "doc-1", name: "Document one", service: "svc-b", levels: { throughput: 10 } }]);
});

test("a different level: the user's pick of the Pack's value sets the level, and the Service's value keeps it", () => {
  const f = facts({ "doc-1": [svcA] });
  const packs = packList("svc-a", [{ code: "uptime", target: 99 }, { code: "latency", target: 4 }]);
  const key = serviceLevelKey("svc-a", "uptime");
  assert.deepEqual(settleServicesFrom(f, packs, { [key]: 99 }).result[0].levels, { uptime: 99, latency: 4 });
  assert.deepEqual(settleServicesFrom(f, packs, { [key]: 90 }).result[0].levels, { uptime: 90, latency: 4 });
});

test("an added level: taking it adds the level, and \"no value\" leaves it out", () => {
  const f = facts({ "doc-1": [svcA] });
  const packs = packList("svc-a", [{ code: "uptime", target: 90 }, { code: "latency", target: 4 }, { code: "throughput", target: 7 }]);
  const key = serviceLevelKey("svc-a", "throughput");
  assert.deepEqual(settleServicesFrom(f, packs, { [key]: 7 }).result[0].levels, { uptime: 90, latency: 4, throughput: 7 });
  assert.deepEqual(settleServicesFrom(f, packs, { [key]: CONFLICT_NO_VALUE }).result[0].levels, { uptime: 90, latency: 4 });
});

test("an omitted level: keeping it keeps the level, and \"no value\" drops it", () => {
  const f = facts({ "doc-1": [svcA] });
  const packs = packList("svc-a", [{ code: "uptime", target: 90 }]);
  const key = serviceLevelKey("svc-a", "latency");
  assert.deepEqual(settleServicesFrom(f, packs, { [key]: 4 }).result[0].levels, { uptime: 90, latency: 4 });
  assert.deepEqual(settleServicesFrom(f, packs, { [key]: CONFLICT_NO_VALUE }).result[0].levels, { uptime: 90 });
});

test("an open level conflict gives no result for that level, and the conflict stays in the list", () => {
  const settled = settleServicesFrom(facts({ "doc-1": [svcA] }), packList("svc-a", [{ code: "uptime", target: 99 }, { code: "latency", target: 4 }]));
  assert.deepEqual(settled.result[0].levels, { latency: 4 });
  assert.deepEqual(settled.conflicts.map((c) => c.resolution), [null]);
});

test("two Deliverables with the same Service each take it", () => {
  const settled = settleServicesFrom(facts({ "doc-1": [svcA], "doc-2": [svcA] }), []);
  assert.deepEqual(settled.result.map((r) => [r.deliverable, r.service]), [["doc-1", "svc-a"], ["doc-2", "svc-a"]]);
});

test("a saved conflict carries its kind, action, message and the options with their sources", () => {
  const [conflict] = settleServicesFrom(facts({ "doc-1": [svcA] }), packList("svc-a", [{ code: "uptime", target: 99 }, { code: "latency", target: 4 }])).conflicts;
  assert.equal(conflict.table, "services");
  assert.equal(conflict.kind, "level-different");
  assert.equal(conflict.action, "pick-one");
  assert.deepEqual(conflict.options.map((o) => [o.sourceKind, o.value]), [["definition", 90], ["pack", 99]]);
});

test("a level the Profile marks as not required is left out of the result, and conflict detection is unchanged", () => {
  const withMark = { ...facts({ "doc-1": [svcA] }), notRequiredLevels: { "svc-a": ["latency"] } };
  const packs = packList("svc-a", [{ code: "uptime", target: 90 }, { code: "latency", target: 5 }]);
  const marked = settleServicesFrom(withMark, packs);
  const plain = settleServicesFrom(facts({ "doc-1": [svcA] }), packs);
  assert.deepEqual(marked.result[0].levels, { uptime: 90 });
  assert.deepEqual(plain.result[0].levels, { uptime: 90 }, "the open latency conflict already leaves latency out, so compare with a resolved pick");
  assert.deepEqual(marked.conflicts, plain.conflicts);

  const key = serviceLevelKey("svc-a", "latency");
  assert.deepEqual(settleServicesFrom(facts({ "doc-1": [svcA] }), packs, { [key]: 5 }).result[0].levels, { uptime: 90, latency: 5 });
  assert.deepEqual(settleServicesFrom(withMark, packs, { [key]: 5 }).result[0].levels, { uptime: 90 }, "the mark wins over the user's pick");
  assert.deepEqual(settleServicesFrom(withMark, [], {}).result[0].levels, { uptime: 90 });
});
