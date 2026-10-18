// Participant Integration & Attestation — Plan step 2 (Resolutions 3 & 4). Two
// distinct artifacts and one small gate:
//   * deliverable_references — the raw VCS reference recorded when a
//     Participant completes the producing Work Item, durably.
//   * attestations — minted ONLY at an acceptance transition (In Progress ->
//     Approved, Approved -> Baselined), the Command that requested it.
//   * the empty-centre presence check — an approval cannot be dispatched unless
//     a real reference was attached when the Deliverable was produced.
// Run against the real dev database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapabilityAsRoot as fulfilCapability } from "./testFixtures.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { attestationsDB } from "../src/dblayer/attestationsDB.js";
import { deliverableReferencesDB } from "../src/dblayer/deliverableReferencesDB.js";
import { ensureWebAppTemplateFixture, commissionFromFormSync, ensureEligibleParticipant, ensureActorParticipant, resolveDispatchRejectionObligations, transitionDeliverableSync, produceDeliverable } from "./testFixtures.js";
import { ROOT_ACTOR_ID, TESTER_ALL_ID } from "./testFixtures.js";

async function commissionAndFulfil(statementPrefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromFormSync(
    {
      statement: `${statementPrefix}-${randomUUID()}`,
      requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
      actorId: TESTER_ALL_ID, requestedBy: TESTER_ALL_ID,
    },
    async (seuId) => {
      const detail = await getSeuDetailView(seuId);
      const capability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
      assert.ok(capability);
      await fulfilCapability({ seuId, capabilityId: capability.capabilityId, capabilityCodes: ["requirements-analysis"] });
    }
  );
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : "assertion failed");
  if (!result.ok) throw new Error("unreachable");
  const seuId = result.seu.id;
  const detail = await getSeuDetailView(seuId);
  const deliverable = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(deliverable);
  // The automatic commence-work rescan (off SEUOperational) already hit this
  // Deliverable's own then-unfulfilled Capability — a real, by-design
  // empty_eligible_pool Obligation/Attention Item, not this test's own scenario.
  await resolveDispatchRejectionObligations(seuId);
  await ensureActorParticipant(seuId, ROOT_ACTOR_ID);
  return { seuId, deliverableId: deliverable.id };
}

test("a reference is recorded at production, but an attestation is minted only at acceptance transitions", async () => {
  const { deliverableId } = await commissionAndFulfil("attestation-mint");

  // Production completion: the Work Item of the producing Command. Records a reference; certifies nothing.
  await produceDeliverable(deliverableId, ROOT_ACTOR_ID, "vcs://attest/req-spec@prod1");

  const afterProduction = (await attestationsDB.findByDeliverableId(deliverableId)).data ?? [];
  assert.equal(afterProduction.length, 0, "a production completion mints no attestation (not an acceptance transition)");

  const refsAfterProduction = (await deliverableReferencesDB.findByDeliverableId(deliverableId)).data ?? [];
  assert.equal(refsAfterProduction.length, 1, "the production reference is recorded durably");
  assert.equal(refsAfterProduction[0]?.to_state, "In Progress");
  assert.equal(refsAfterProduction[0]?.reference, "vcs://attest/req-spec@prod1");

  // Acceptance: the Command to approve, governed and applied by the Execution Engine. Mints an attestation.
  const approved = await transitionDeliverableSync({ deliverableId, targetState: "Approved", actorId: ROOT_ACTOR_ID });
  assert.equal(approved.ok, true, !approved.ok ? JSON.stringify(approved) : "assertion failed");

  const attestations = (await attestationsDB.findByDeliverableId(deliverableId)).data ?? [];
  assert.equal(attestations.length, 1, "the In Progress -> Approved acceptance mints exactly one attestation");
  const att = attestations[0];
  assert.equal(att?.from_state, "In Progress");
  assert.equal(att?.to_state, "Approved");
  assert.ok(att?.command_id, "the attestation is the Command that requested the acceptance");
  assert.ok(att?.participant_id, "the attestation records the Participant that requested the acceptance");
  assert.ok(att?.acting_badge_type, "the attestation records the authority that certified the state");

  const allRefs = (await deliverableReferencesDB.findByDeliverableId(deliverableId)).data ?? [];
  assert.equal(allRefs.length, 1, "only the producing completion records a reference; the acceptance is recorded by the attestation");
});

test("empty-centre: an approval cannot be dispatched unless a real reference was produced", async () => {
  const { deliverableId } = await commissionAndFulfil("attestation-empty-centre");

  // Produce with NO reference — the "empty centre" the platform must not certify.
  await produceDeliverable(deliverableId, ROOT_ACTOR_ID, null);

  const blocked = await transitionDeliverable({ requestedBy: ROOT_ACTOR_ID, deliverableId, targetState: "Approved", actorId: ROOT_ACTOR_ID });
  assert.equal(blocked.ok, false, "approving an empty Deliverable must be blocked");
  if (!blocked.ok) assert.equal(blocked.reason, "empty_centre");

  // No attestation was minted, and the Deliverable did not move.
  const attestations = (await attestationsDB.findByDeliverableId(deliverableId)).data ?? [];
  assert.equal(attestations.length, 0, "a blocked approval mints no attestation");
});

test("empty-centre clears once a real reference is produced: the same Deliverable can then be approved", async () => {
  const { deliverableId } = await commissionAndFulfil("attestation-empty-then-real");

  // A real production reference this time — the presence check is satisfied.
  await produceDeliverable(deliverableId, ROOT_ACTOR_ID, "vcs://attest/req-spec@real");

  const approved = await transitionDeliverable({ requestedBy: ROOT_ACTOR_ID, deliverableId, targetState: "Approved", actorId: ROOT_ACTOR_ID });
  assert.equal(approved.ok, true, !approved.ok ? JSON.stringify(approved) : "assertion failed");
});
