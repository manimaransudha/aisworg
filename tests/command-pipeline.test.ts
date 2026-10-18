// Command / Work Item / Dispatch Engine pipeline (CR-121 third pass). A Deliverable transition is a Command the
// Execution Engine governs and applies itself; no Work Item is involved. Work Items exist only for producing work:
// once the engine has moved a Deliverable to In Progress it generates the producing Command, the Work Item
// Generator derives a Work Item from it, and Dispatch assigns it to a Participant. Completing the Work Item records
// the reference and changes no state (Ch.32 WI-005). Run against the real dev database, no mocking.
import "dotenv/config";
import { commandTypeFor, PRODUCE_COMMAND_VERB } from "../src/dblayer/constants.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapabilityAsRoot as fulfilCapability } from "./testFixtures.js";
import { completeWorkItem } from "../src/routes/seu/core/workItems.js";
import { executionEngine } from "../src/domain/engine/executionEngine.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import { workItemsDB } from "../src/dblayer/workItemsDB.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { ensureWebAppTemplateFixture, commissionFromFormSync, waitForDispatchedWorkItem, waitUntilAsync, ensureEligibleParticipant, ensureActorParticipant, transitionDeliverableSync, getEmptyPoolTenantId } from "./testFixtures.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, TESTER_ALL_ID } from "./testFixtures.js";
import type { CommandRow } from "../src/dblayer/seuTypes.js";

async function commissionTestSeu(statementPrefix: string, beforeCommenceWork?: (seuId: string) => Promise<void>, tenantId?: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromFormSync(
    {
      statement: `${statementPrefix}-${randomUUID()}`,
      requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
      actorId: TESTER_ALL_ID, requestedBy: TESTER_ALL_ID, tenantId,
    },
    beforeCommenceWork
  );
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : "assertion failed");
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

// Fulfils "requirements-analysis" before the Execution Engine's own
// automatic commence-work attempt reaches Dispatch — see
// driveCommissioningToActive's own beforeCommenceWork comment.
async function fulfilRequirementsAnalysis(seuId: string): Promise<void> {
  const detail = await getSeuDetailView(seuId);
  const capability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  if (!capability) return;
  await fulfilCapability({ seuId, capabilityId: capability.capabilityId, capabilityCodes: ["requirements-analysis"] });
}

async function waitForCommandStatus(seuId: string, deliverableId: string, status: string): Promise<CommandRow> {
  let command: CommandRow | null = null;
  await waitUntilAsync(async () => {
    const { data: commands } = await commandsDB.findBySeuId(seuId);
    command = (commands ?? []).find((c) => c.entity_id === deliverableId) ?? null;
    return command?.status === status;
  });
  // TS narrows a `let` reassigned inside an async closure (the
  // waitUntilAsync callback above) to `never` at every read site after the
  // closure returns — a known compiler limitation, not an actual runtime
  // possibility. A local cast sidesteps it without weakening the null check.
  const resolvedCommand = command as CommandRow | null;
  assert.equal(resolvedCommand?.status, status, `expected the Command for ${deliverableId} to reach ${status}`);
  return resolvedCommand as CommandRow;
}

test("a Deliverable does not move to In Progress while nobody fulfils its producing Capability", async () => {
  const seuId = await commissionTestSeu("phase3-defer", undefined, await getEmptyPoolTenantId());
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec, "expected a seeded Requirements Analysis Model deliverable");
  await ensureActorParticipant(seuId, ROOT_ACTOR_ID);

  // Defined -> In Progress is blocked by the Mandatory Policy until the producing Capability is Fulfilled.
  const moved = await transitionDeliverableSync({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assert.equal(moved.ok, false, "no hop without a fulfilled Capability");
  if (!moved.ok) assert.equal(moved.reason, "policy_blocked", JSON.stringify(moved));

  const after = await getSeuDetailView(seuId);
  assert.equal(after?.deliverables.find((d) => d.name === "Requirements Analysis Model")?.lifecycleState, "Defined", "the Deliverable stays in Defined");
  const { data: commands } = await commandsDB.findBySeuId(seuId);
  assert.equal((commands ?? []).filter((c) => c.entity_id === requirementsSpec.id && c.status === "Completed").length, 0, "no Command completed for the Deliverable");
});

test("the producing Command leaves a traceable Command and a Completed/Disposed Work Item assigned to the fulfilling Participant", async () => {
  const seuId = await commissionTestSeu("phase3-trace", fulfilRequirementsAnalysis);
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec);

  // Defined -> In Progress is a governed hop: the Execution Engine makes it off the kickoff, so a manual request that
  // lands after it finds the Deliverable already In Progress (no_transition_definition). The producing Command
  // (In Progress -> In Progress) is what the test then waits for.
  const result = await transitionDeliverableSync({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result) : "assertion failed");

  // Outstanding first: the producing Command and its Work Item are Dispatched, waiting for the Participant.
  const { workItem: dispatchedWorkItem } = await waitForDispatchedWorkItem(requirementsSpec.id, "In Progress", "In Progress");
  const outstanding = await getSeuDetailView(seuId);
  // The automatic rescan's own first attempt may have already hit an empty
  // eligible-Participant pool and left a real, terminal Failed Command
  // behind before fulfilment landed — a genuine, separate artifact, not part
  // of "the one dispatched transition" this assertion is actually about.
  const dispatchedCommands = (outstanding?.commands ?? []).filter((c) => c.status === "Dispatched");
  assert.equal(dispatchedCommands.length, 1, "expected exactly one Dispatched-and-outstanding Command for the one dispatched transition");
  assert.equal(dispatchedCommands[0]?.workItems[0]?.status, "Dispatched", "the Work Item waits Dispatched for the Participant's result");

  // The Participant's result drives the Work Item to Completed/Disposed.
  const completed = await completeWorkItem({ workItemId: dispatchedWorkItem.id, outcome: "done", reference: "vcs://phase3-trace/req-spec@def456" });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : "assertion failed");

  const after1 = await getSeuDetailView(seuId);
  const producingCommands = (after1?.commands ?? []).filter((c) => c.commandType === commandTypeFor("Deliverable", PRODUCE_COMMAND_VERB) && c.status === "Completed");
  assert.equal(producingCommands.length, 1, "expected exactly one Completed producing Command");
  const command = producingCommands[0];
  assert.equal(command?.fromState, "In Progress");
  assert.equal(command?.toState, "In Progress");
  assert.equal(command?.status, "Completed");
  assert.equal(command?.entityLabel, "Requirements Analysis Model");

  assert.equal(command?.workItems.length, 1, "Ch.32 FR-32.1: exactly one Work Item per Command in this MVP instance");
  const workItem = command?.workItems[0];
  assert.equal(workItem?.status, "Disposed", "Ch.32 §13: a completed Work Item is disposed");
  // ensureEligibleParticipant mints a real participants_master row with a
  // random display name (`Test Fixture Participant <uuid>`), not a fixed
  // literal — check the real label's shape, not an exact stale string.
  assert.match(workItem?.participantLabel ?? "", /^Test Fixture Participant .+ \(Human\)$/);
  // Ch.33 §9 — no dispatchStrategyPreference declared on this test's Profile,
  // so selectParticipant falls back to the baseline "capability-match"
  // strategy alone, not the pre-Ch.33-redesign "sole-eligible-participant"
  // literal.
  assert.equal(workItem?.dispatchStrategy, "capability-match");
});

test("executionEngine rejects dispatch when no Participant fulfils the producing Capability, marking the Command Failed", async () => {
  const seuId = await commissionTestSeu("phase3-engine");
  const detail = await getSeuDetailView(seuId);
  const architectureCapability = detail?.capabilities.find((c) => c.code === "architecture-design");
  assert.ok(architectureCapability);
  const { data: rawDeliverables } = await deliverablesDB.findBySeuId(seuId);
  const architectureDeliverable = (rawDeliverables ?? []).find((d) => d.producing_capability_id === architectureCapability!.capabilityId);
  assert.ok(architectureDeliverable, "expected a real, seeded Deliverable producing architecture-design (a real entity id is required — Dispatch's own reject path raises an Obligation against it)");
  await ensureActorParticipant(seuId, ROOT_ACTOR_ID);

  await ensureActorParticipant(seuId, ROOT_ACTOR_ID);
  await executionEngine.execute({
    seuId,
    commandType: commandTypeFor("Deliverable", PRODUCE_COMMAND_VERB),
    entityType: "Deliverable",
    entityId: architectureDeliverable!.id,
    fromState: "In Progress",
    toState: "In Progress",
    producingCapabilityId: architectureCapability!.capabilityId,
    requestedBy: ROOT_ACTOR_ID,
    actorId: ROOT_ACTOR_ID,
    actingBadgeType: ROOT_ACTOR_BADGE,
    correlationId: eventBus.newCorrelationId(),
  });

  await waitForCommandStatus(seuId, architectureDeliverable!.id, "Failed");
});

test("executionEngine rejects dispatch when the entity has no producing Capability declared at all", async () => {
  const seuId = await commissionTestSeu("phase3-no-capability");
  const detail = await getSeuDetailView(seuId);
  // The architecture Deliverable depends on the requirements one, so the kickoff has not generated any Command for it.
  const architectureSpec = detail?.deliverables.find((d) => d.name === "Architecture Decision Record");
  assert.ok(architectureSpec);

  // Ch.33's own redesign (this session, owner: "this is the same as
  // participant eligibility") — "no producing Capability declared" is no
  // longer a silent, unconditional dispatch; it's Dispatch's own case 1,
  // same Obligation + Action-Required Attention Item + Command-Failed
  // treatment as an empty pool.
  await ensureActorParticipant(seuId, ROOT_ACTOR_ID);
  await executionEngine.execute({
    seuId,
    commandType: commandTypeFor("Deliverable", PRODUCE_COMMAND_VERB),
    entityType: "Deliverable",
    entityId: architectureSpec!.id,
    fromState: "In Progress",
    toState: "In Progress",
    producingCapabilityId: null,
    requestedBy: ROOT_ACTOR_ID,
    actorId: ROOT_ACTOR_ID,
    actingBadgeType: ROOT_ACTOR_BADGE,
    correlationId: eventBus.newCorrelationId(),
  });

  await waitForCommandStatus(seuId, architectureSpec!.id, "Failed");
});

// Participant Integration & Attestation — Plan step 1 : the `blocked`/
// `failed` result path. A Participant that could not complete the Work Item
// reports the outcome, and the platform must NOT apply the governed transition,
// must fail the Work Item and Command, and must raise a single Attention Item —
// exactly the "cannot automatically continue" case (Ch.34).
test("a Participant reporting 'blocked' fails the Work Item, and raises an Attention Item", async () => {
  const seuId = await commissionTestSeu("phase3-blocked", fulfilRequirementsAnalysis);
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec);

  const dispatched = await transitionDeliverableSync({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assert.equal(dispatched.ok, true, !dispatched.ok ? JSON.stringify(dispatched) : "assertion failed");

  const { workItem: dispatchedWorkItem } = await waitForDispatchedWorkItem(requirementsSpec.id, "In Progress", "In Progress");
  const completed = await completeWorkItem({ workItemId: dispatchedWorkItem.id, outcome: "blocked", reference: "vcs://phase3-blocked/partial@wip" });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : "assertion failed");
  if (!completed.ok) throw new Error("unreachable");
  assert.equal(completed.outcome, "blocked");

  // A blocked result changes no engineering state: the Deliverable stays where the engine put it.
  const after = await getSeuDetailView(seuId);
  assert.equal(after?.deliverables.find((d) => d.name === "Requirements Analysis Model")?.lifecycleState, "In Progress", "a blocked result never changes the Deliverable's state");

  // Work Item Failed, Command Failed, but the raw reference is still stored.
  const { data: workItem } = await workItemsDB.findById(dispatchedWorkItem.id);
  assert.equal(workItem?.status, "Failed");
  assert.equal(workItem?.output_reference, "vcs://phase3-blocked/partial@wip", "candidate output is stored even on a blocked outcome");
  const { data: command } = await commandsDB.findById(workItem!.command_id);
  assert.equal(command?.status, "Failed");

  // Exactly one Exception Attention Item, deduplicated per (SEU, Deliverable).
  const { data: openException } = await attentionItemsDB.findOpenByRelatedObject(seuId, "Exception", "Deliverable", requirementsSpec.id);
  assert.ok(openException, "expected an open Exception Attention Item for the blocked Deliverable");
});

test("completeWorkItem is idempotent-safe: a second result on an already-completed Work Item is rejected, not re-applied", async () => {
  const seuId = await commissionTestSeu("phase3-double", fulfilRequirementsAnalysis);
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec);

  const dispatched = await transitionDeliverableSync({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assert.equal(dispatched.ok, true, !dispatched.ok ? JSON.stringify(dispatched) : "assertion failed");

  const { workItem } = await waitForDispatchedWorkItem(requirementsSpec.id, "In Progress", "In Progress");
  const first = await completeWorkItem({ workItemId: workItem.id, outcome: "done", reference: "vcs://phase3-double/req-spec@1" });
  assert.equal(first.ok, true);

  const second = await completeWorkItem({ workItemId: workItem.id, outcome: "done", reference: "vcs://phase3-double/req-spec@2" });
  assert.equal(second.ok, false, "a Work Item that is no longer outstanding must not be completed again");
  if (!second.ok) assert.equal(second.reason, "not_outstanding");

  const unknown = await completeWorkItem({ workItemId: randomUUID(), outcome: "done" });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.reason, "not_found");
});

