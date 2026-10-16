// CR-121 — the Execution Engine governs every Deliverable Command and applies the transition itself. Only producing
// work (In Progress -> In Progress) has a Work Item, the kickoff requests only `governed` hops, and a hop requires an
// attestation when its Transition Definition carries the policy-attestation-required Policy Definition.
// Run against the real dev database, no mocking.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { transitionEvidence } from "../src/routes/seu/core/evidence.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { workItemsDB } from "../src/dblayer/workItemsDB.js";
import { attestationsDB } from "../src/dblayer/attestationsDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { deliverableKickoffHandler } from "../src/domain/engine/deliverableKickoff.js";
import type { EventRow } from "../src/dblayer/seuTypes.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { ATTESTATION_REQUIRED_POLICY_CODE, PRODUCE_COMMAND_VERB, commandTypeFor, getPlatformTenantId } from "../src/dblayer/constants.js";
import {
  ensureWebAppTemplateFixture, ensureCoreEngineeringQualityGates, commissionFromFormSync, ensureEligibleParticipant, ensureActorParticipant,
  resolveDispatchRejectionObligations, createEvidenceAsRoot, fulfilCapabilityAsRoot as fulfilCapability, produceDeliverable, transitionDeliverableSync,
  ROOT_ACTOR_ID, TESTER_ALL_ID,
} from "./testFixtures.js";

async function commissionAndFulfil(prefix: string): Promise<{ seuId: string; deliverableId: string }> {
  await ensureWebAppTemplateFixture();
  await ensureCoreEngineeringQualityGates();
  const result = await commissionFromFormSync(
    {
      statement: `${prefix}-${randomUUID()}`,
      requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
      actorRole: "super", actorId: TESTER_ALL_ID, requestedBy: TESTER_ALL_ID,
    },
    async (seuId) => {
      const detail = await getSeuDetailView(seuId);
      const capability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
      assert.ok(capability);
      await fulfilCapability({ seuId, capabilityId: capability.capabilityId, participantMasterId: await ensureEligibleParticipant(seuId, ["requirements-analysis"]) });
    }
  );
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : "assertion failed");
  if (!result.ok) throw new Error("unreachable");
  const detail = await getSeuDetailView(result.seu.id);
  const deliverable = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(deliverable);
  await resolveDispatchRejectionObligations(result.seu.id);
  await ensureActorParticipant(result.seu.id, ROOT_ACTOR_ID);
  return { seuId: result.seu.id, deliverableId: deliverable.id };
}

test("only producing work has a Work Item: the engine's own hops (start, approve, baseline) create none, and each acceptance hop is attested by its Command", async () => {
  const { seuId, deliverableId } = await commissionAndFulfil("cr121-no-work-item");
  const productionWorkItemId = await produceDeliverable(deliverableId, ROOT_ACTOR_ID);

  const approved = await transitionDeliverableSync({ deliverableId, targetState: "Approved", actorRole: "super", actorId: ROOT_ACTOR_ID });
  assert.equal(approved.ok, true, !approved.ok ? JSON.stringify(approved) : "assertion failed");

  const evidence = await createEvidenceAsRoot({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Validation Evidence", title: "CR-121 baseline evidence" });
  await transitionEvidence({ evidenceId: evidence.id, targetState: "Validated", actorRole: "general", actorId: TESTER_ALL_ID });
  await transitionEvidence({ evidenceId: evidence.id, targetState: "Accepted", actorRole: "general", actorId: TESTER_ALL_ID });
  const baselined = await transitionDeliverableSync({ deliverableId, targetState: "Baselined", actorRole: "super", actorId: ROOT_ACTOR_ID });
  assert.equal(baselined.ok, true, !baselined.ok ? JSON.stringify(baselined) : "assertion failed");

  const { data: commands } = await commandsDB.findBySeuId(seuId);
  const own = (commands ?? []).filter((c) => c.entity_id === deliverableId);
  const hop = (from: string, to: string) => own.filter((c) => c.from_state === from && c.to_state === to);
  const workItemCount = async (commandId: string) => ((await workItemsDB.findByCommandIds([commandId])).data ?? []).length;

  const start = hop("Defined", "In Progress");
  assert.equal(start.length, 1, "exactly one Command for the governed start hop");
  assert.equal(await workItemCount(start[0].id), 0, "the start hop is made by the engine and has no Work Item");

  const producing = hop("In Progress", "In Progress").filter((c) => c.command_type === commandTypeFor("Deliverable", PRODUCE_COMMAND_VERB) && c.status === "Completed");
  assert.equal(producing.length, 1, "exactly one Completed producing Command");
  const producingWorkItems = (await workItemsDB.findByCommandIds([producing[0].id])).data ?? [];
  assert.deepEqual(producingWorkItems.map((w) => w.id), [productionWorkItemId], "the producing Command has the one Work Item");

  for (const [from, to] of [["In Progress", "Approved"], ["Approved", "Baselined"]]) {
    const commandsForHop = hop(from, to);
    assert.equal(commandsForHop.length, 1, `exactly one Command for ${from} -> ${to}`);
    assert.equal(commandsForHop[0].status, "Completed");
    assert.equal(await workItemCount(commandsForHop[0].id), 0, `${from} -> ${to} is made by the engine and has no Work Item`);
  }

  const { data: attestations } = await attestationsDB.findByDeliverableId(deliverableId);
  const attestedCommandIds = (attestations ?? []).map((a) => a.command_id).sort();
  assert.deepEqual(attestedCommandIds, [hop("In Progress", "Approved")[0].id, hop("Approved", "Baselined")[0].id].sort(), "each acceptance hop is attested by its own Command, and no other hop is");
});

test("the kickoff requests only governed hops: a manual hop stays where it is until a participant requests it", async () => {
  const { seuId, deliverableId } = await commissionAndFulfil("cr121-manual-hop");
  await produceDeliverable(deliverableId, ROOT_ACTOR_ID);

  // Resolving Obligations publishes ObligationTransitioned, which wakes the kickoff for a full rescan.
  await resolveDispatchRejectionObligations(seuId);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const { data: deliverable } = await deliverablesDB.findById(deliverableId);
  assert.equal(deliverable?.lifecycle_state, "In Progress", "In Progress -> Approved is a manual hop, so no rescan moves it");
  const { data: commands } = await commandsDB.findBySeuId(seuId);
  assert.equal((commands ?? []).some((c) => c.entity_id === deliverableId && c.to_state === "Approved"), false, "the kickoff created no Command for the manual hop");

  const approved = await transitionDeliverableSync({ deliverableId, targetState: "Approved", actorRole: "super", actorId: ROOT_ACTOR_ID });
  assert.equal(approved.ok, true, !approved.ok ? JSON.stringify(approved) : "assertion failed");
});

test("the seed stores the attestation Policy Definition's UUID on exactly the hops that require an attestation", async () => {
  const { data: policyDefinition } = await policyDefinitionsDB.findActiveByCodeVisibleTo(ATTESTATION_REQUIRED_POLICY_CODE, await getPlatformTenantId());
  assert.ok(policyDefinition, `${ATTESTATION_REQUIRED_POLICY_CODE} must be seeded as an Active Policy Definition`);

  for (const [from, to, expected] of [["Defined", "In Progress", false], ["In Progress", "Approved", true], ["Approved", "Baselined", true]] as const) {
    const { data: definition } = await transitionDefinitionsDB.find("Deliverable", from, to);
    assert.ok(definition, `Deliverable ${from} -> ${to} must have a Transition Definition`);
    assert.equal(definition.required_policy_ids.includes(policyDefinition.id), expected, `Deliverable ${from} -> ${to} attestation policy`);
  }
});

// The kickoff runs on several events, and the event bus dispatches each without waiting, so two runs can be in flight
// at once. Approving Requirements Analysis Model makes Architecture Decision Record's governed hop ready: the
// DeliverableTransitioned the approval publishes starts one run, and two more runs are started here at the same
// moment. The hop must be made once.
test("overlapping kickoff runs make a governed hop once: one start Command and one DeliverableTransitioned to In Progress", async () => {
  const { seuId, deliverableId } = await commissionAndFulfil("cr121-overlap");
  await produceDeliverable(deliverableId, ROOT_ACTOR_ID);

  const detail = await getSeuDetailView(seuId);
  const architecture = detail?.deliverables.find((d) => d.name === "Architecture Decision Record");
  assert.ok(architecture);
  assert.equal(architecture.lifecycleState, "Defined");

  const approved = await transitionDeliverableSync({ deliverableId, targetState: "Approved", actorRole: "super", actorId: ROOT_ACTOR_ID });
  assert.equal(approved.ok, true, !approved.ok ? JSON.stringify(approved) : "assertion failed");

  const overlapping = (): EventRow => ({
    id: randomUUID(), event_type: "ObligationTransitioned", seu_id: seuId, correlation_id: randomUUID(),
    originating_object_id: randomUUID(), originating_object_type: "Obligation", payload: { toState: "Verified" },
  } as unknown as EventRow);
  await Promise.all([deliverableKickoffHandler(overlapping()), deliverableKickoffHandler(overlapping())]);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const { data: commands } = await commandsDB.findBySeuId(seuId);
  const starts = (commands ?? []).filter((c) => c.entity_id === architecture.id && c.from_state === "Defined" && c.to_state === "In Progress");
  assert.equal(starts.length, 1, "exactly one Command for the governed start hop");

  const { data: events } = await eventsDB.findByOriginatingObject("Deliverable", architecture.id);
  const startedEvents = (events ?? []).filter((e) => e.event_type === "DeliverableTransitioned" && (e.payload as { toState?: string } | null)?.toState === "In Progress");
  assert.equal(startedEvents.length, 1, "exactly one DeliverableTransitioned to In Progress, so exactly one producing Command follows");
});
