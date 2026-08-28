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
import { findCandidateTemplates } from "../src/routes/seu/core/templates.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

// CR-009: Operational/Engineering Objectives require a parent (only Strategic
// may be a root). These tests build their fixtures under a fresh Strategic root.
async function strategicRoot(): Promise<string> {
  const { objective } = await createObjective({
    statement: `phase1-root-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic",
  });
  return objective.id;
}

test("createObjective rejects a child whose tier is more strategic than its parent's", async () => {
  const { objective: parent } = await createObjective({
    statement: `phase1-parent-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    tier: "Operational",
    parentObjectiveId: await strategicRoot(),
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
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(),
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
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(),
    status: "Proposed",
  });

  const skipAhead = await transitionObjective({ objectiveId: objective.id, targetState: "Archived", actorRole: "super", actorId: "1001" });
  assert.equal(skipAhead.ok, false);
  if (!skipAhead.ok && skipAhead.reason !== "not_found") assert.equal(skipAhead.reason, "no_transition_definition");

  const activate = await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorRole: "general", actorId: "1001" });
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
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(),
    status: "Proposed",
  });
  await ensureWebAppTemplateFixture();
  const { data: template } = await templatesDB.findByCode("test-enterprise-web-application");
  assert.ok(template);
  const profile = await createProfile({ templateId: template.id, environment: "development" });

  const blocked = await commissionSeu({ objectiveId: objective.id, templateId: template.id, profileId: profile.id, actorRole: "super", actorId: "1001" });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.ok(blocked.reason.includes("not Active"), `expected reason to mention "not Active", got: ${blocked.reason}`);

  const activated = await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorRole: "general", actorId: "1001" });
  assert.equal(activated.ok, true);

  const allowed = await commissionSeu({ objectiveId: objective.id, templateId: template.id, profileId: profile.id, actorRole: "super", actorId: "1001" });
  assert.equal(allowed.ok, true);
  if (allowed.ok) assert.equal(allowed.seu.lifecycle_state, "Operational");
});

test("commissionFromExistingObjective reuses the Objective's own declared Capabilities, no re-picking", async () => {
  const { objective } = await createObjective({
    statement: `phase1-existing-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(),
    // status omitted — defaults Active, matching the one-shot quick-commission path
  });

  const result = await commissionFromExistingObjective({ objectiveId: objective.id, actorRole: "super", actorId: "1001" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.seu.lifecycle_state, "Operational");
});

test("suggestCapabilityCodes matches on word overlap with a Capability's name/description", async () => {
  const codes = await suggestCapabilityCodes("We need requirements analysis work done for this engagement");
  assert.ok(codes.includes("requirements-analysis"), `expected requirements-analysis in ${JSON.stringify(codes)}`);
});

// Bug fix regression: findCandidateTemplates correctly allows a Template
// requiring MORE Capabilities than requested to satisfy (Ch.6 §11 — that's
// intentional, not a mismatch). The real defect was in what happened when
// more than one Template satisfies: the first alphabetically-sorted match
// won, not the tightest fit. This only became observable once a second real
// Template (requiring strictly more Capabilities than
// test-enterprise-web-application) existed in the Registry — see
// seedEbookLibraryPilot.ts. Requesting exactly test-enterprise-web-application's
// 3 required Capabilities must select it over any looser-fitting Template
// that also happens to satisfy, regardless of code ordering.
test("findCandidateTemplates picks the tightest-fitting satisfying Template, not whichever sorts first alphabetically", async () => {
  await ensureWebAppTemplateFixture();
  const { data: webApp } = await templatesDB.findByCode("test-enterprise-web-application");
  assert.ok(webApp, "expected test-enterprise-web-application to be seeded");
  const { data: webAppCapabilities } = await templatesDB.getRequiredCapabilities(webApp!.id);
  assert.ok(webAppCapabilities && webAppCapabilities.length > 0);

  const candidates = await findCandidateTemplates(webAppCapabilities!.map((c) => c.code));
  const satisfying = candidates.filter((c) => c.satisfies);
  assert.ok(satisfying.length >= 1);

  // Ascending by required-Capability count — the tightest fit is first.
  for (let i = 1; i < satisfying.length; i++) {
    assert.ok(satisfying[i]!.requiredCapabilityCount >= satisfying[i - 1]!.requiredCapabilityCount);
  }

  const selected = satisfying[0];
  assert.equal(selected?.code, "test-enterprise-web-application", `expected the exact-fit Template to win, got: ${selected?.code}`);
});
