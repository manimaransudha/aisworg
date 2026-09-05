// Participant Integration & Attestation — Plan step 2 (Resolutions 3 & 4). Two
// distinct artifacts and one small gate:
//   * deliverable_references — the raw VCS reference recorded at EVERY
//     completion (production and acceptance alike), durably.
//   * attestations — minted ONLY at an acceptance transition (In Progress ->
//     Approved, Approved -> Baselined), the SEU-scoped governance outcome.
//   * the empty-centre presence check — an approval cannot be dispatched unless
//     a real reference was attached when the Deliverable was produced.
// Run against the real dev database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { completeWorkItem } from "../src/routes/seu/core/workItems.js";
import { attestationsDB } from "../src/dblayer/attestationsDB.js";
import { deliverableReferencesDB } from "../src/dblayer/deliverableReferencesDB.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function commissionAndFulfil(statementPrefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorRole: "super", actorId: "1001", requestedBy: 1001,
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const seuId = result.seu.id;
  const detail = await getSeuDetailView(seuId);
  const deliverable = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  const capability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(deliverable && capability);
  await fulfilCapability({ seuId, capabilityId: capability.capabilityId, participantType: "AI", displayName: `${statementPrefix} Analyst` });
  return { seuId, deliverableId: deliverable.id };
}

// Dispatch + report `done` in one step, for setup where the async round-trip
// isn't itself under test.
async function dispatchAndComplete(deliverableId: string, targetState: string, reference: string | null) {
  const dispatched = await transitionDeliverable({ deliverableId, targetState, actorRole: "super", actorId: "1" });
  assert.equal(dispatched.ok, true, !dispatched.ok ? JSON.stringify(dispatched) : undefined);
  if (!dispatched.ok) throw new Error("unreachable");
  const completed = await completeWorkItem({ workItemId: dispatched.workItemId, outcome: "done", reference });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : undefined);
  return dispatched.workItemId;
}

test("a reference is recorded at every completion, but an attestation is minted only at acceptance transitions", async () => {
  const { deliverableId } = await commissionAndFulfil("attestation-mint");

  // Production completion: Defined -> In Progress. Records a reference; certifies nothing.
  await dispatchAndComplete(deliverableId, "In Progress", "vcs://attest/req-spec@prod1");

  const afterProduction = (await attestationsDB.findByDeliverableId(deliverableId)).data ?? [];
  assert.equal(afterProduction.length, 0, "a production completion mints no attestation (not an acceptance transition)");

  const refsAfterProduction = (await deliverableReferencesDB.findByDeliverableId(deliverableId)).data ?? [];
  assert.equal(refsAfterProduction.length, 1, "the production reference is recorded durably");
  assert.equal(refsAfterProduction[0]?.to_state, "In Progress");
  assert.equal(refsAfterProduction[0]?.reference, "vcs://attest/req-spec@prod1");

  // Acceptance completion: In Progress -> Approved. Mints an attestation.
  await dispatchAndComplete(deliverableId, "Approved", "vcs://attest/req-spec@approved1");

  const attestations = (await attestationsDB.findByDeliverableId(deliverableId)).data ?? [];
  assert.equal(attestations.length, 1, "the In Progress -> Approved acceptance mints exactly one attestation");
  const att = attestations[0];
  assert.equal(att?.from_state, "In Progress");
  assert.equal(att?.to_state, "Approved");
  assert.equal(att?.reference, "vcs://attest/req-spec@approved1", "the attestation binds the acceptance to its commit reference");
  assert.ok(att?.participant_id, "the attestation records the Participant that produced the accepted state");
  assert.ok(att?.acting_badge_grant_id, "the attestation records the authority that certified the state");

  const allRefs = (await deliverableReferencesDB.findByDeliverableId(deliverableId)).data ?? [];
  assert.equal(allRefs.length, 2, "both completions recorded a reference");
});

test("empty-centre: an approval cannot be dispatched unless a real reference was produced", async () => {
  const { deliverableId } = await commissionAndFulfil("attestation-empty-centre");

  // Produce with NO reference — the "empty centre" the platform must not certify.
  await dispatchAndComplete(deliverableId, "In Progress", null);

  const blocked = await transitionDeliverable({ deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(blocked.ok, false, "approving an empty Deliverable must be blocked");
  if (!blocked.ok) assert.equal(blocked.reason, "empty_centre");

  // No attestation was minted, and the Deliverable did not move.
  const attestations = (await attestationsDB.findByDeliverableId(deliverableId)).data ?? [];
  assert.equal(attestations.length, 0, "a blocked approval mints no attestation");
});

test("empty-centre clears once a real reference is produced: the same Deliverable can then be approved", async () => {
  const { deliverableId } = await commissionAndFulfil("attestation-empty-then-real");

  // A real production reference this time — the presence check is satisfied.
  await dispatchAndComplete(deliverableId, "In Progress", "vcs://attest/req-spec@real");

  const approved = await transitionDeliverable({ deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(approved.ok, true, !approved.ok ? JSON.stringify(approved) : undefined);
});
