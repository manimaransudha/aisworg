// Objective core functions that the web controller cannot reach with a valid form (src/routes/seu/core/objectives.ts).
//
//   - createObjective and reParentObjective refuse each invalid shape with their own message: the forms never send a null requester, a Strategic
//     Objective with a parent, an unknown Capability code or a move under a descendant.
//   - deleteObjective is reached over HTTP by objectives-controller.test.ts. The "not found" refusal is core-only, because the route's id
//     parameter loader answers a missing id first.
//   - listObjectives and listCommissionableObjectives feed the commissioning page and the Demo simulator.
//   - Every Objective is requested by root and moved with root's actor, so the tests need no other identity. Rows are not deleted, as in the other
//     tests that create Objectives; statements are unique per run.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createObjective, deleteObjective, reParentObjective, listObjectives, listCommissionableObjectives } from "../src/routes/seu/core/objectives.js";
import { createActiveObjective, transitionObjective, ROOT_ACTOR_ID } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
let counter = 0;
const statement = (label: string) => `objectives-core ${run} ${label} ${++counter}`;

const strategic = (label: string) => createObjective({ statement: statement(label), requiredCapabilityCodes: [], tier: "Strategic", requestedBy: ROOT_ACTOR_ID }).then((r) => r.objective);
const child = (label: string, tier: "Operational" | "Engineering", parentObjectiveId: string) =>
  createObjective({ statement: statement(label), requiredCapabilityCodes: [], tier, parentObjectiveId, requestedBy: ROOT_ACTOR_ID }).then((r) => r.objective);

async function rejectedStrategic(label: string) {
  const { objective } = await createActiveObjective({ statement: statement(label), requiredCapabilityCodes: [], tier: "Strategic", requestedBy: ROOT_ACTOR_ID });
  const rejected = await transitionObjective({ objectiveId: objective.id, targetState: "Reject", actorId: ROOT_ACTOR_ID, comment: "Rejected so that it is no longer a valid parent." });
  assert.equal(rejected.ok, true);
  return objective;
}

test("createObjective refuses a non-Strategic root, a null requester and an unknown Capability code", async () => {
  await assert.rejects(
    () => createObjective({ statement: statement("no-parent"), requiredCapabilityCodes: [], tier: "Engineering", requestedBy: ROOT_ACTOR_ID }),
    /a Engineering Objective requires a parent Objective \(only Strategic may be a root\)/
  );
  await assert.rejects(
    () => createObjective({ statement: statement("no-requester"), requiredCapabilityCodes: [], tier: "Strategic", requestedBy: null as never }),
    /must be attributed to a real requesting user/
  );
  await assert.rejects(
    () => createObjective({ statement: statement("bad-capability"), requiredCapabilityCodes: ["no-such-capability"], tier: "Strategic", requestedBy: ROOT_ACTOR_ID }),
    /unknown capability code\(s\): no-such-capability/
  );
});

test("createObjective refuses a child under a parent that is neither Defined nor Active, unless the validation is skipped", async () => {
  const parent = await rejectedStrategic("rejected-parent");
  await assert.rejects(
    () => child("refused-child", "Operational", parent.id),
    /parent Objective is not Defined or Active \(status: Reject\)/
  );
  const { objective } = await createObjective({
    statement: statement("skipped-validation-child"), requiredCapabilityCodes: [], tier: "Operational", parentObjectiveId: parent.id, requestedBy: ROOT_ACTOR_ID, skipParentValidation: true,
  });
  assert.equal(objective.parent_objective_id, parent.id);
});

test("reParentObjective refuses a root Engineering Objective, a Strategic Objective with a parent, a more strategic node under a less strategic parent, a parent that is not Defined or Active, and a cycle", async () => {
  const root = await strategic("root");
  const operationalOne = await child("operational-one", "Operational", root.id);
  const operationalTwo = await child("operational-two", "Operational", operationalOne.id);
  const engineering = await child("engineering", "Engineering", operationalOne.id);
  const rejectedParent = await rejectedStrategic("rejected-new-parent");

  await assert.rejects(() => reParentObjective(engineering.id, null), /a Engineering Objective requires a parent \(only Strategic may be a root\)/);
  await assert.rejects(() => reParentObjective(root.id, operationalOne.id), /a Strategic Objective is a root and cannot be given a parent/);
  await assert.rejects(() => reParentObjective(operationalOne.id, engineering.id), /cannot be more strategic than its new parent's tier \(Engineering\)/);
  await assert.rejects(() => reParentObjective(engineering.id, rejectedParent.id), /new parent Objective is not Defined or Active \(status: Reject\)/);
  await assert.rejects(() => reParentObjective(operationalOne.id, operationalTwo.id), /would create a cycle/);
});

test("deleteObjective refuses an id that does not exist", async () => {
  const missingId = randomUUID();
  await assert.rejects(() => deleteObjective(missingId), new RegExp(`Objective not found: ${missingId}`));
});

test("listObjectives marks children, commissionable and deletable rows, and listCommissionableObjectives keeps only the Active leaves that are not Strategic", async () => {
  const { objective: root } = await createActiveObjective({ statement: statement("list-root"), requiredCapabilityCodes: [], tier: "Strategic", requestedBy: ROOT_ACTOR_ID });
  const { objective: middle } = await createActiveObjective({ statement: statement("list-middle"), requiredCapabilityCodes: [], tier: "Operational", parentObjectiveId: root.id, requestedBy: ROOT_ACTOR_ID });
  const { objective: activeLeaf } = await createActiveObjective({ statement: statement("list-active-leaf"), requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: middle.id, requestedBy: ROOT_ACTOR_ID });
  const definedLeaf = await child("list-defined-leaf", "Engineering", middle.id);

  const tenantId = root.sponsoring_authority?.tenant;
  assert.ok(tenantId, "the Objective records the tenant of its requester");

  const all = await listObjectives(tenantId);
  const byId = new Map(all.map((o) => [o.id, o]));
  const row = (id: string) => {
    const found = byId.get(id);
    assert.ok(found, `listObjectives(tenant) lists ${id}`);
    return found;
  };
  assert.deepEqual([row(root.id).hasChildren, row(root.id).commissionable, row(root.id).deletable], [true, false, false], "a Strategic parent");
  assert.deepEqual([row(middle.id).hasChildren, row(middle.id).commissionable, row(middle.id).deletable], [true, false, false], "an Active parent");
  assert.deepEqual([row(activeLeaf.id).hasChildren, row(activeLeaf.id).commissionable, row(activeLeaf.id).deletable], [false, true, false], "an Active leaf");
  assert.deepEqual([row(definedLeaf.id).hasChildren, row(definedLeaf.id).commissionable, row(definedLeaf.id).deletable], [false, false, true], "a Defined leaf");
  assert.equal(row(activeLeaf.id).commissioned, false);
  assert.equal(row(activeLeaf.id).commissionedSeuId, null);
  assert.equal(row(activeLeaf.id).parentObjectiveId, middle.id);

  const commissionable = await listCommissionableObjectives(tenantId);
  const commissionableIds = new Set(commissionable.map((o) => o.id));
  assert.ok(commissionableIds.has(activeLeaf.id));
  for (const id of [root.id, middle.id, definedLeaf.id]) assert.ok(!commissionableIds.has(id), `${id} is not commissionable`);
  assert.ok(commissionable.every((o) => o.commissionable));

  assert.equal((await listObjectives(randomUUID())).length, 0, "another tenant sees none of these");
  assert.ok((await listObjectives()).some((o) => o.id === root.id), "no tenant filter lists every Objective");
});
