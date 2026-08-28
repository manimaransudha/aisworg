// Participant Integration & Attestation — Plan step 4 (Decision 8, Resolution 9).
// The stall/timeout half of first-class async failure handling: an outstanding
// Work Item that neither completes nor fails within its producing Capability's
// declared SLA (turnaround_time on the Service Level) raises an Escalation
// Attention Item, unattended. Timing is driven by an injected `now` so the test
// is deterministic (no sleeping). Run against the real dev database.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { sweepStalledWorkItems } from "../src/routes/seu/core/workItemHeartbeat.js";
import { servicesDB } from "../src/dblayer/servicesDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

const SLA_SECONDS = 60;

async function commissionDispatchAndDeclareSla(prefix: string, opts?: { slaSeconds?: number; targetCompletionAt?: Date | null }) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${prefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super", actorId: "1001",
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const seuId = result.seu.id;

  const detail = await getSeuDetailView(seuId);
  const deliverable = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const capability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(deliverable && capability);

  // Declare the SLA on the producing Capability's Service Level (net-new
  // turnaround_time, Resolution 9). Set explicitly so the test does not depend
  // on whether the shared dev DB was re-seeded since the pack gained the field.
  // CR-064 — Service Level is no longer an ad-hoc runtime PATCH; it's a real,
  // versioned republish via upsertFromPack (same path every Pack publish
  // uses), matching dispatchEngine.ts's own resolveTurnaroundSeconds reader
  // (matches any service_level item whose label contains "turnaround",
  // target parsed as a bare number of seconds).
  const { data: services } = await servicesDB.findByCapabilityId(capability.capabilityId);
  assert.ok(services && services.length > 0, "the producing Capability should provide a Service carrying the SLA");
  const svc = services[0];
  await servicesDB.upsertFromPack({
    code: svc.code,
    providingCapabilityId: svc.providing_capability_id,
    name: svc.name,
    contractDescription: svc.contract_description,
    serviceLevel: [
      ...svc.service_level.filter((item) => !/turnaround/i.test(item.label)),
      { label: "Turnaround Time", target: String(opts?.slaSeconds ?? SLA_SECONDS) },
    ],
    originatingPackId: svc.originating_pack_id!,
  });

  await fulfilCapability({ seuId, capabilityId: capability.capabilityId, participantType: "AI", displayName: `${prefix} Analyst` });

  // Dispatch and DO NOT complete — the Work Item is now genuinely outstanding.
  // The target is the SLA-derived default unless the caller overrides it.
  const dispatched = await transitionDeliverable({ deliverableId: deliverable.id, targetState: "In Progress", actorRole: "super", actorId: "1", targetCompletionAt: opts?.targetCompletionAt ?? null });
  assert.equal(dispatched.ok, true, !dispatched.ok ? JSON.stringify(dispatched) : undefined);
  if (!dispatched.ok) throw new Error("unreachable");

  return { seuId, deliverableId: deliverable.id, workItemId: dispatched.workItemId };
}

test("an outstanding Work Item within its SLA is not escalated; past its SLA it raises exactly one Escalation Attention Item, unattended", async () => {
  const { seuId, deliverableId, workItemId } = await commissionDispatchAndDeclareSla("stall");

  // Within the SLA (swept ~immediately after dispatch): not escalated.
  const early = await sweepStalledWorkItems({ now: new Date(), seuId });
  assert.equal(early.escalatedWorkItemIds.includes(workItemId), false, "a freshly-dispatched Work Item is inside its turnaround SLA");
  const noAttentionYet = await attentionItemsDB.findOpenByRelatedObject(seuId, "Escalation", "Deliverable", deliverableId);
  assert.equal(noAttentionYet.data, null, "no Escalation raised while inside the SLA");

  // Past the SLA (swept an hour later, SLA is 60s): escalated, unattended — no
  // Participant callback was involved.
  const late = await sweepStalledWorkItems({ now: new Date(Date.now() + 3600_000), seuId });
  assert.equal(late.escalatedWorkItemIds.includes(workItemId), true, "an outstanding Work Item past its SLA must escalate");

  const attention = await attentionItemsDB.findOpenByRelatedObject(seuId, "Escalation", "Deliverable", deliverableId);
  assert.ok(attention.data, "expected an open Escalation Attention Item for the stalled Deliverable");
  assert.equal(attention.data?.priority, "High");
  assert.match(attention.data?.title ?? "", /stalled/i);

  // Idempotent: sweeping again (even later) does not raise a second one.
  const again = await sweepStalledWorkItems({ now: new Date(Date.now() + 7200_000), seuId });
  assert.equal(again.escalatedWorkItemIds.includes(workItemId), false, "one stalled situation produces exactly one Escalation, however many times the sweep runs");
});

test("a completed Work Item is no longer outstanding, so the stall sweep never escalates it", async () => {
  const { seuId, workItemId } = await commissionDispatchAndDeclareSla("stall-completed");

  // Complete it via the result callback path first.
  const { completeWorkItem } = await import("../src/routes/seu/core/workItems.js");
  const done = await completeWorkItem({ workItemId, outcome: "done", reference: "vcs://stall/req@done" });
  assert.equal(done.ok, true);

  const swept = await sweepStalledWorkItems({ now: new Date(Date.now() + 86400_000), seuId });
  assert.equal(swept.escalatedWorkItemIds.includes(workItemId), false, "a Disposed Work Item is not outstanding and cannot stall");
});

test("the assigner's explicit target overrides the SLA-derived default", async () => {
  // Declare a long SLA (24h) so the default target would NOT be overdue now,
  // then override with a target one minute in the past. Only the override makes
  // the item stalled at the present moment — proving the override, not the SLA,
  // set the deadline.
  const { seuId, workItemId } = await commissionDispatchAndDeclareSla("stall-override", {
    slaSeconds: 86400,
    targetCompletionAt: new Date(Date.now() - 60_000),
  });

  const swept = await sweepStalledWorkItems({ now: new Date(), seuId });
  assert.equal(swept.escalatedWorkItemIds.includes(workItemId), true, "an explicit past target overrides the 24h SLA default and is immediately stalled");
});

test("a Participant that responds before the target is processed normally (the deadline never blocks an early result)", async () => {
  const { deliverableId, workItemId } = await commissionDispatchAndDeclareSla("stall-early");

  // Well within the 60s SLA target: completing now must succeed and apply the transition.
  const { completeWorkItem } = await import("../src/routes/seu/core/workItems.js");
  const done = await completeWorkItem({ workItemId, outcome: "done", reference: "vcs://stall/req@early" });
  assert.equal(done.ok, true, !done.ok ? JSON.stringify(done) : undefined);
  if (done.ok && done.outcome === "done") assert.equal(done.deliverable.id, deliverableId);
});
