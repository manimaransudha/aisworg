// CR-107 — Execution Engine must own deciding when a Deliverable is eligible
// to start, so a blocking Obligation on the owning SEU actually gates
// engineering work. Before this fix, transitionDeliverable checked only
// dependency readiness, Quality Gates, Policy, and Authority for the
// Deliverable's own hop — it never read the owning SEU's own blocked state,
// so a head-of-chain Deliverable (no incoming dependency_definitions row)
// could reach "In Progress" even while its owning SEU sat blocked at
// "Activated" with a real, open commence-work Obligation on record (CR-104/
// CR-106's own mechanism). Run against the real dev database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionSeu } from "../src/routes/seu/core/commissioning.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { transitionObligation } from "../src/routes/seu/core/obligations.js";
import { publishPack } from "../src/routes/seu/core/packs.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { uniqueTestPackVersion, driveCommissioningToActive, ensureEventSubscriptionsLoaded, waitUntilAsync } from "./testFixtures.js";
import type { SeuRow } from "../src/dblayer/seuTypes.js";

async function registerOrganisationName(code: string): Promise<void> {
  await pool.query(
    "INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES ('organisation-name', $1, $2, '11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING",
    [code, code]
  );
}

after(async () => {
  await pool.end();
});

// Shared setup: a Template whose Template carries an always-unsatisfied
// SEU-scoped Policy on "SEU|Activated|Operational" (same mechanism CR-104's
// own test already exercises) and one head-of-chain Deliverable in its
// catalogue (no dependencyGraph entry needed — a Deliverable with no
// incoming dependency_definitions row resolves dependency-ready trivially,
// exactly the "head-of-chain" shape CR-107 was raised over).
async function commissionBlockedSeu(run: string) {
  const pack = { code: `cr107-seu-policy-pack-${run}`, name: "CR-107 SEU Policy Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: {} };
  await registerOrganisationName(pack.code);
  const published = await publishPack({ seed: pack as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(published.ok, `seu policy pack must publish: ${!published.ok ? JSON.stringify(published) : ""}`);
  const { data: packRow } = await packsDB.findActiveByCode(pack.code);

  const { data: seuPolicy } = await policiesDB.upsert({
    code: `cr107-seu-commence-work-${run}`, name: `CR-107 commence-work policy ${run}`, constraintType: "Policy",
    scope: "Transition", governedTransition: "SEU|Activated|Operational",
    condition: { type: "field_in", field: "neverSet", values: ["only-this-satisfies"] },
    originatingPackId: packRow!.id,
  });
  assert.ok(seuPolicy);

  const { data: template } = await templatesDB.upsert({
    code: `cr107-tpl-${run}`, name: "CR-107 Template",
    deliverableCatalogue: [{ code: "requirements-analysis-model" }],
  });
  await templatesDB.setMandatoryPacks(template!.id, [pack.code]);
  await templatesDB.setRequiredCapabilities(template!.id, []);

  await ensureEventSubscriptionsLoaded();
  const { objective: root } = await createObjective({ statement: `cr107-root-${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed" });
  const { objective } = await createObjective({ statement: `cr107-${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: root.id, requestedBy: 1001 });
  const { data: profile } = await profilesDB.upsert({ code: `cr107-profile-${run}`, name: "CR-107 Profile", baseTemplateId: template!.id, environment: "development" });
  const requested = await commissionSeu({ objectiveId: objective.id, templateIds: [template!.id], profileIds: [profile!.id], actorRole: "super", actorId: "1001" });
  assert.equal(requested.ok, true, !requested.ok ? `Validate Request failed: ${requested.reason}` : undefined);
  if (!requested.ok) throw new Error("unreachable");

  const result = await driveCommissioningToActive({ seuId: requested.seu.id, actorRole: "super", actorId: "1001", timeoutMs: 30000 });
  assert.equal(result.ok, false, "an unsatisfied SEU-scoped Policy must block the Activated -> Operational hop");
  if (!result.ok) assert.equal(result.stage, "blocked");

  const { data: seu } = await seusDB.findById(requested.seu.id);
  assert.equal(seu?.lifecycle_state, "Activated", "a Policy block leaves the SEU Activated, not Operational");

  // Not matched by name: "requirements-analysis-model" is a deliverable-name
  // Ontology code, and finalizeCommissioning resolves it through
  // resolveLabels — the real dev DB already has this code registered (other
  // fixtures share it) with a friendlier label ("Requirements Analysis
  // Model"), so the created row's own `name` is that label, not the raw
  // code. This Template's catalogue has exactly one entry, so there's
  // exactly one Deliverable to find.
  const { data: deliverables } = await deliverablesDB.findBySeuId(seu!.id);
  const headOfChain = (deliverables ?? [])[0];
  assert.ok(headOfChain, "the head-of-chain Deliverable must exist even though the SEU is stuck Activated (Create Engineering Assets runs before Activated is even reached)");
  assert.equal(headOfChain!.lifecycle_state, "Defined");

  const { data: obligations } = await obligationsDB.findByRelatedObject("SEU", seu!.id);
  const blockingObligation = (obligations ?? []).find((o) => o.blocked_to_state === "Operational");
  assert.ok(blockingObligation, "a real Obligation must be raised against the SEU for the blocked commence-work hop");

  return { seu: seu!, headOfChain: headOfChain!, blockingObligation: blockingObligation!, packId: packRow!.id, policyCode: seuPolicy!.code };
}

test("CR-107: a Deliverable cannot start while its owning SEU is blocked by an open commence-work Obligation", async () => {
  const run = randomUUID().slice(0, 8);
  const { headOfChain } = await commissionBlockedSeu(run);

  // The actual bug this CR was raised over: before the fix, nothing checked
  // the owning SEU's own state here, so this call would succeed (dispatched)
  // despite the SEU sitting blocked.
  const transitionResult = await transitionDeliverable({ deliverableId: headOfChain.id, targetState: "In Progress", actorRole: "super", actorId: "1001" });
  assert.equal(transitionResult.ok, false, "a head-of-chain Deliverable must not be able to start while its owning SEU is blocked");
  if (!transitionResult.ok) {
    assert.equal(transitionResult.reason, "seu_blocked");
    assert.match((transitionResult as { detail: string }).detail, /owning SEU is blocked/);
  }

  // The Deliverable itself must genuinely be untouched — a block is a
  // refusal, not a partial/silent apply.
  const { data: reloaded } = await deliverablesDB.findById(headOfChain.id);
  assert.equal(reloaded?.lifecycle_state, "Defined");
});

test("CR-107: once the blocking commence-work Obligation resolves, the Execution Engine's own retry unblocks both the SEU and its Deliverable", async () => {
  const run = randomUUID().slice(0, 8);
  const { seu, headOfChain, blockingObligation, packId, policyCode } = await commissionBlockedSeu(run);

  // Confirmed blocked at the Deliverable level too, same as the test above —
  // establishing the "before" state this test's own resolution is judged
  // against.
  const beforeResolve = await transitionDeliverable({ deliverableId: headOfChain.id, targetState: "In Progress", actorRole: "super", actorId: "1001" });
  assert.equal(beforeResolve.ok, false);

  // The blocking Policy's own condition ({field_in: neverSet}) never becomes
  // satisfiable on its own — attemptSeuCommenceWork's retry re-evaluates it
  // against the same empty context every time (a real, separately-tracked
  // gap: policyEngine's context has no DB lookup of its own). Simulating
  // "the real-world condition this Policy stands for actually got resolved"
  // (e.g. the customer sign-off happened) the same way an author would:
  // re-publish the same Policy (same code + originatingPackId, so this
  // upserts the existing row in place, same id) with a condition that does
  // pass — always_true — so the retry below has something real to succeed
  // against, not just the Obligation's own status.
  await policiesDB.upsert({
    code: policyCode, name: `CR-107 commence-work policy ${run} (resolved)`, constraintType: "Policy",
    scope: "Transition", governedTransition: "SEU|Activated|Operational",
    condition: { type: "always_true" },
    originatingPackId: packId,
  });

  // Drive the real Obligation through its full lifecycle to Verified — the
  // same real transitionObligation path a human/API caller uses, not a
  // direct DB write. Every hop is ungoverned (verb: null), so no badge is
  // needed.
  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    const step = await transitionObligation({ obligationId: blockingObligation.id, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(step.ok, true, !step.ok ? `Obligation ${targetState} step failed: ${JSON.stringify(step)}` : undefined);
  }

  // ObligationTransitioned (published by that last "Verified" hop) wakes
  // executionEngineKickoff, which re-attempts the SEU's own
  // Activated -> Operational hop off the real Policy re-evaluation — no
  // direct call into attemptSeuCommenceWork from this test.
  let seuAfter: SeuRow | null = null;
  await waitUntilAsync(async () => {
    const { data: reloaded } = await seusDB.findById(seu.id);
    seuAfter = reloaded ?? null;
    return reloaded?.lifecycle_state === "Operational";
  });
  assert.equal(seuAfter?.lifecycle_state, "Operational", "resolving the blocking Obligation must let the Execution Engine's own retry reach Operational");

  // And the Deliverable-level block (item 6/CR-107's own fix) must have
  // cleared too — the same fifth check that refused it above now finds no
  // open blocking Obligation on the SEU.
  const afterResolve = await transitionDeliverable({ deliverableId: headOfChain.id, targetState: "In Progress", actorRole: "super", actorId: "1001" });
  assert.notEqual((afterResolve as { reason?: string }).reason, "seu_blocked", "the Deliverable-level SEU-blocked check must clear once the SEU itself reaches Operational");
});
