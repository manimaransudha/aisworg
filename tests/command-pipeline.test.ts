// Post-MVP Phase 3 (Command / Work Item / Dispatch Engine pipeline) —
// automated coverage for what the Phase 3 audit checked by hand: a Deliverable
// transition no longer applies directly. Governance (dependency + Authority/
// Policy) still gates first, then a Command is generated, a Work Item derived
// from it, and the Dispatch Engine must actually assign that Work Item to the
// Participant fulfilling the Deliverable's producing Capability before the
// state change lands.
//
// Rewritten this session for the event-driven Execution Engine pipeline
// (executionEngine.ts/dispatchEngine.ts's own header comments):
// transitionDeliverable/executionEngine.execute report only "governance
// cleared, Command requested" now — Command generation, Work Item generation
// and Dispatch all run in their own async consumers (CommandGenerated ->
// commandGeneratedHandler, WorkItemGenerated -> workItemGeneratedHandler),
// so nothing here can read workItemId/dispatched/participantId synchronously
// off a return value any more. And an empty eligible-Participant pool (or no
// producing Capability declared at all) is Dispatch's own case 1
// (DispatchRejected, Command marked Failed, an Obligation + Attention Item
// raised) — not a deferral — per this session's own Ch.33 redesign. Run
// against the real dev database, no mocking.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { completeWorkItem } from "../src/routes/seu/core/workItems.js";
import { executionEngine } from "../src/domain/engine/executionEngine.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import { workItemsDB } from "../src/dblayer/workItemsDB.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { ensureWebAppTemplateFixture, commissionFromFormSync, waitForDispatchedWorkItem, waitUntilAsync, ensureEligibleParticipant } from "./testFixtures.js";
import type { CommandRow } from "../src/dblayer/seuTypes.js";

async function commissionTestSeu(statementPrefix: string, beforeCommenceWork?: (seuId: string) => Promise<void>) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromFormSync(
    {
      statement: `${statementPrefix}-${randomUUID()}`,
      requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
      actorRole: "super", actorId: "1001", requestedBy: 1001,
    },
    beforeCommenceWork
  );
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
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
  const participantMasterId = await ensureEligibleParticipant(seuId, ["requirements-analysis"]);
  await fulfilCapability({ seuId, capabilityId: capability.capabilityId, participantMasterId });
}

async function waitForCommandStatus(seuId: string, deliverableId: string, status: string): Promise<CommandRow> {
  let command: CommandRow | null = null;
  await waitUntilAsync(async () => {
    const { data: commands } = await commandsDB.findBySeuId(seuId);
    command = (commands ?? []).find((c) => c.entity_id === deliverableId) ?? null;
    return command?.status === status;
  });
  assert.equal(command?.status, status, `expected the Command for ${deliverableId} to reach ${status}`);
  return command as CommandRow;
}

test("transitionDeliverable rejects the transition when nobody fulfils the producing Capability yet, then dispatches once a Participant does", async () => {
  const seuId = await commissionTestSeu("phase3-defer");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec, "expected a seeded Requirements Analysis Model deliverable");
  assert.equal(requirementsSpec.lifecycleState, "Defined");

  // deliverableKickoffHandler's own automatic rescan (off SEUOperational)
  // may already have generated this exact hop's Command before this explicit
  // call lands — a real already_in_flight, not a governance rejection; either
  // way one real Command exists for this hop and waitForCommandStatus below
  // finds it regardless of which caller created it.
  const requested = await transitionDeliverable({
    deliverableId: requirementsSpec.id,
    targetState: "In Progress",
    actorRole: "super", actorId: "1",
  });
  if (!requested.ok) assert.equal(requested.reason, "already_in_flight", JSON.stringify(requested));

  await waitForCommandStatus(seuId, requirementsSpec.id, "Failed");
  const stillDefined = await getSeuDetailView(seuId);
  assert.equal(stillDefined?.deliverables.find((d) => d.name === "Requirements Analysis Model")?.lifecycleState, "Defined", "Deliverable must not move state while nobody fulfils the Capability");

  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(reqAnalysisCapability);
  await fulfilCapability({
    seuId,
    capabilityId: reqAnalysisCapability.capabilityId,
    participantMasterId: await ensureEligibleParticipant(seuId, ["requirements-analysis"]),
  });

  const dispatched = await transitionDeliverable({
    deliverableId: requirementsSpec.id,
    targetState: "In Progress",
    actorRole: "super", actorId: "1",
  });
  assert.equal(dispatched.ok, true, !dispatched.ok ? JSON.stringify(dispatched) : undefined);
  if (!dispatched.ok) throw new Error("unreachable");

  // Model A (Participant Integration Plan): dispatch does NOT move the
  // Deliverable — it stays Defined, outstanding, until the Participant reports
  // a result.
  const { workItem } = await waitForDispatchedWorkItem(requirementsSpec.id, "Defined", "In Progress");
  const stillDefinedAfterDispatch = await getSeuDetailView(seuId);
  assert.equal(stillDefinedAfterDispatch?.deliverables.find((d) => d.name === "Requirements Analysis Model")?.lifecycleState, "Defined", "dispatched, not yet applied — the transition waits for the result callback");

  const completed = await completeWorkItem({ workItemId: workItem.id, outcome: "done", reference: "vcs://phase3-defer/req-spec@abc123" });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : undefined);

  const moved = await getSeuDetailView(seuId);
  assert.equal(moved?.deliverables.find((d) => d.name === "Requirements Analysis Model")?.lifecycleState, "In Progress", "the result callback drives the governed transition");
});

test("a dispatched transition leaves a traceable Command and a Completed/Disposed Work Item assigned to the fulfilling Participant", async () => {
  const seuId = await commissionTestSeu("phase3-trace", fulfilRequirementsAnalysis);
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec);

  // deliverableKickoffHandler (off SEUOperational) re-scans every Deliverable
  // in the SEU and attempts each one's own next governed transition
  // unprompted — the same governed check this manual call also runs, and
  // "manual" trigger only controls button visibility, not who/what may
  // attempt the transition. Fulfilling before commence-work (above) means
  // that automatic rescan can now legitimately win the race and already have
  // a Command in flight (already_in_flight) before this call lands — same
  // tolerance tenant-contract.test.ts's own commissionAndDispatch uses.
  const result = await transitionDeliverable({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  if (!result.ok) assert.equal(result.reason, "already_in_flight", JSON.stringify(result));

  // Outstanding first: Model A leaves the Command and Work Item Dispatched
  // (waiting for the result callback), not Completed.
  const { workItem: dispatchedWorkItem } = await waitForDispatchedWorkItem(requirementsSpec.id, "Defined", "In Progress");
  const outstanding = await getSeuDetailView(seuId);
  // The automatic rescan's own first attempt may have already hit an empty
  // eligible-Participant pool and left a real, terminal Failed Command
  // behind before fulfilment landed — a genuine, separate artifact, not part
  // of "the one dispatched transition" this assertion is actually about.
  const dispatchedCommands = (outstanding?.commands ?? []).filter((c) => c.status === "Dispatched");
  assert.equal(dispatchedCommands.length, 1, "expected exactly one Dispatched-and-outstanding Command for the one dispatched transition");
  assert.equal(dispatchedCommands[0]?.workItems[0]?.status, "Dispatched", "the Work Item waits Dispatched for the Participant's result");

  // The result callback drives it to Completed/Disposed.
  const completed = await completeWorkItem({ workItemId: dispatchedWorkItem.id, outcome: "done", reference: "vcs://phase3-trace/req-spec@def456" });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : undefined);

  const after1 = await getSeuDetailView(seuId);
  const completedCommands = (after1?.commands ?? []).filter((c) => c.status === "Completed");
  assert.equal(completedCommands.length, 1, "expected exactly one Completed Command for the one dispatched transition");
  const command = completedCommands[0];
  assert.equal(command?.fromState, "Defined");
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

  await executionEngine.execute({
    seuId,
    entityType: "Deliverable",
    entityId: architectureDeliverable!.id,
    fromState: "Defined",
    toState: "In Progress",
    producingCapabilityId: architectureCapability!.capabilityId,
    requestedBy: null,
    correlationId: eventBus.newCorrelationId(),
  });

  await waitForCommandStatus(seuId, architectureDeliverable!.id, "Failed");
});

test("executionEngine rejects dispatch when the entity has no producing Capability declared at all", async () => {
  const seuId = await commissionTestSeu("phase3-no-capability");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec);

  // Ch.33's own redesign (this session, owner: "this is the same as
  // participant eligibility") — "no producing Capability declared" is no
  // longer a silent, unconditional dispatch; it's Dispatch's own case 1,
  // same Obligation + Action-Required Attention Item + Command-Failed
  // treatment as an empty pool.
  await executionEngine.execute({
    seuId,
    entityType: "Deliverable",
    entityId: requirementsSpec!.id,
    fromState: "Defined",
    toState: "In Progress",
    producingCapabilityId: null,
    requestedBy: null,
    correlationId: eventBus.newCorrelationId(),
  });

  await waitForCommandStatus(seuId, requirementsSpec!.id, "Failed");
});

// Participant Integration & Attestation — Plan step 1 (Model A): the `blocked`/
// `failed` result path. A Participant that could not complete the Work Item
// reports the outcome, and the platform must NOT apply the governed transition,
// must fail the Work Item and Command, and must raise a single Attention Item —
// exactly the "cannot automatically continue" case (Ch.34).
test("a Participant reporting 'blocked' fails the Work Item without applying the transition, and raises an Attention Item", async () => {
  const seuId = await commissionTestSeu("phase3-blocked", fulfilRequirementsAnalysis);
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec);

  const dispatched = await transitionDeliverable({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  if (!dispatched.ok) assert.equal(dispatched.reason, "already_in_flight", JSON.stringify(dispatched));

  const { workItem: dispatchedWorkItem } = await waitForDispatchedWorkItem(requirementsSpec.id, "Defined", "In Progress");
  const completed = await completeWorkItem({ workItemId: dispatchedWorkItem.id, outcome: "blocked", reference: "vcs://phase3-blocked/partial@wip" });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : undefined);
  if (!completed.ok) throw new Error("unreachable");
  assert.equal(completed.outcome, "blocked");

  // The Deliverable must NOT have moved.
  const after = await getSeuDetailView(seuId);
  assert.equal(after?.deliverables.find((d) => d.name === "Requirements Analysis Model")?.lifecycleState, "Defined", "a blocked result must never apply the transition");

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

  const dispatched = await transitionDeliverable({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  if (!dispatched.ok) assert.equal(dispatched.reason, "already_in_flight", JSON.stringify(dispatched));

  const { workItem } = await waitForDispatchedWorkItem(requirementsSpec.id, "Defined", "In Progress");
  const first = await completeWorkItem({ workItemId: workItem.id, outcome: "done", reference: "vcs://phase3-double/req-spec@1" });
  assert.equal(first.ok, true);

  const second = await completeWorkItem({ workItemId: workItem.id, outcome: "done", reference: "vcs://phase3-double/req-spec@2" });
  assert.equal(second.ok, false, "a Work Item that is no longer outstanding must not be completed again");
  if (!second.ok) assert.equal(second.reason, "not_outstanding");

  const unknown = await completeWorkItem({ workItemId: randomUUID(), outcome: "done" });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.reason, "not_found");
});

