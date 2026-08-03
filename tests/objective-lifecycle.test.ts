// Post-MVP Phase 1 (Formalize Objective) — automated coverage for what the
// Phase 1 audit in design/mvp-build-plan/Post-MVP Build Sequence.md checked
// by hand: decomposition/tier validation, the Ch.1 lifecycle, real versioning,
// the "Objective must be Active to commission" gate, and the Objective-first
// commissioning path. Run against the real dev database, same discipline as
// tests/engine.test.ts — no mocking, unique statements per test so fixtures
// never collide with seed data or each other.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { createObjective, getObjectiveDetail, transitionObjective, updateObjective, suggestCapabilityCodes } from "../src/routes/seu/core/objectives.js";
import { createProfile } from "../src/routes/seu/core/profiles.js";
import { commissionSeu, commissionFromExistingObjective } from "../src/routes/seu/core/commissioning.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";

after(async () => {
  await pool.end();
});

test("createObjective rejects a child whose tier is more strategic than its parent's", async () => {
  const { objective: parent } = await createObjective({
    statement: `phase1-parent-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    tier: "Operational",
  });

  await assert.rejects(
    () =>
      createObjective({
        statement: `phase1-bad-child-${randomUUID()}`,
        requiredCapabilityCodes: ["architecture"],
        tier: "Strategic",
        parentObjectiveId: parent.id,
      }),
    /cannot be more strategic than its parent/
  );
});

test("createObjective accepts a valid child, and getObjectiveDetail shows both sides of the decomposition tree", async () => {
  const { objective: parent } = await createObjective({
    statement: `phase1-parent-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    tier: "Strategic",
  });
  const { objective: child } = await createObjective({
    statement: `phase1-child-${randomUUID()}`,
    requiredCapabilityCodes: ["development"],
    tier: "Operational",
    parentObjectiveId: parent.id,
  });

  const parentDetail = await getObjectiveDetail(parent.id);
  assert.equal(parentDetail?.children.length, 1);
  assert.equal(parentDetail?.children[0]?.id, child.id);

  const childDetail = await getObjectiveDetail(child.id);
  assert.equal(childDetail?.parent?.id, parent.id);
});

test("updateObjective increments version and applies the edit", async () => {
  const { objective } = await createObjective({
    statement: `phase1-versioned-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
  });
  assert.equal(objective.version, 1);

  const updated = await updateObjective(objective.id, { statement: "phase1-revised-statement" });
  assert.equal(updated.version, 2);
  assert.equal(updated.statement, "phase1-revised-statement");
});

test("transitionObjective follows the Ch.1 lifecycle and rejects an undefined transition", async () => {
  const { objective } = await createObjective({
    statement: `phase1-lifecycle-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    status: "Proposed",
  });

  const skipAhead = await transitionObjective({ objectiveId: objective.id, targetState: "Archived", actorRole: "super" });
  assert.equal(skipAhead.ok, false);
  if (!skipAhead.ok && skipAhead.reason !== "not_found") assert.equal(skipAhead.reason, "no_transition_definition");

  const activate = await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorRole: "general" });
  assert.equal(activate.ok, true);
  if (activate.ok) {
    assert.equal(activate.objective.status, "Active");
    assert.deepEqual(activate.appliedTransition, { fromState: "Proposed", toState: "Active" });
  }
});

test("commissionSeu requires the Objective to be Active — blocks Proposed, succeeds once Activated", async () => {
  const { objective } = await createObjective({
    statement: `phase1-gate-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    status: "Proposed",
  });
  const { data: template } = await templatesDB.findByCode("template-web-application");
  assert.ok(template);
  const profile = await createProfile({ templateId: template.id, environment: "development" });

  const blocked = await commissionSeu({ objectiveId: objective.id, templateId: template.id, profileId: profile.id, actorRole: "super" });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.ok(blocked.reason.includes("not Active"), `expected reason to mention "not Active", got: ${blocked.reason}`);

  const activated = await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorRole: "general" });
  assert.equal(activated.ok, true);

  const allowed = await commissionSeu({ objectiveId: objective.id, templateId: template.id, profileId: profile.id, actorRole: "super" });
  assert.equal(allowed.ok, true);
  if (allowed.ok) assert.equal(allowed.seu.lifecycle_state, "Operational");
});

test("commissionFromExistingObjective reuses the Objective's own declared Capabilities, no re-picking", async () => {
  const { objective } = await createObjective({
    statement: `phase1-existing-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    // status omitted — defaults Active, matching the one-shot quick-commission path
  });

  const result = await commissionFromExistingObjective({ objectiveId: objective.id, actorRole: "super" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.seu.lifecycle_state, "Operational");
});

test("suggestCapabilityCodes matches on word overlap with a Capability's name/description", async () => {
  const codes = await suggestCapabilityCodes("We need requirements analysis work done for this engagement");
  assert.ok(codes.includes("requirements-analysis"), `expected requirements-analysis in ${JSON.stringify(codes)}`);
});
