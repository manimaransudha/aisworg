// CR-126 — CapabilityRequested / CapabilityFulfilled / CapabilityUnavailable. Proves, against real dev data
// (no mocking):
//   1. A request that names no Participant is fulfilled from the eligible pool by the capabilityRequested handler,
//      which publishes one CapabilityFulfilled for the request carrying the fulfilling participantIds.
//   2. A request for a Capability that no Participant holds publishes CapabilityUnavailable from the handler and
//      leaves the Capability Unfulfilled.
//   3. sweepUnavailableCapabilities re-requests a Capability whose latest event is CapabilityUnavailable once the
//      delay has passed, and leaves it alone while the re-request is in flight.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { requestCapabilityFulfilment } from "../src/routes/seu/core/capabilities.js";
import { sweepUnavailableCapabilities } from "../src/routes/seu/core/capabilityRetrySweep.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import type { EventRow } from "../src/dblayer/seuTypes.js";
import { getSystemActor, CAPABILITY_RETRY_DELAY_SECONDS } from "../src/dblayer/constants.js";
import {
  ensureWebAppTemplateFixture, commissionFromFormSync, ensureEligibleParticipant, ensureEventSubscriptionsLoaded, getEmptyPoolTenantId, deactivateParticipants, settleCapabilityRequests,
  waitForCapabilityFulfilled, ensureActorParticipant, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, TESTER_ALL_ID,
} from "./testFixtures.js";

// "change-management" is a seeded Capability that no seeded Participant holds, so its pool stays empty unless a test
// adds a Participant for it.
const UNHELD_CAPABILITY_CODE = "change-management";

async function commissionSeuWithCapability(statementPrefix: string, options?: { capabilityCode?: string; withEligibleParticipant?: boolean; tenantId?: string }): Promise<{ seuId: string; capabilityId: string }> {
  const capabilityCode = options?.capabilityCode ?? "requirements-analysis";
  const withEligibleParticipant = options?.withEligibleParticipant ?? true;
  await ensureWebAppTemplateFixture();
  await ensureEventSubscriptionsLoaded();
  let capabilityId: string | undefined;
  const result = await commissionFromFormSync(
    {
      statement: `${statementPrefix}-${randomUUID()}`,
      requiredCapabilityCodes: capabilityCode === "requirements-analysis" ? ["requirements-analysis", "architecture-design", "software-construction"] : [capabilityCode],
      actorId: TESTER_ALL_ID, requestedBy: TESTER_ALL_ID, tenantId: options?.tenantId,
    },
    async (seuId) => {
      const detail = await getSeuDetailView(seuId);
      capabilityId = detail?.capabilities.find((c) => c.code === capabilityCode)?.capabilityId;
      assert.ok(capabilityId);
      if (withEligibleParticipant) await ensureEligibleParticipant(seuId, [capabilityCode]);
    }
  );
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : "assertion failed");
  if (!result.ok || !capabilityId) throw new Error("unreachable");
  return { seuId: result.seu.id, capabilityId };
}

async function seuEventTypes(seuId: string): Promise<string[]> {
  const { data } = await eventsDB.findByOriginatingObject("SEU", seuId);
  return (data ?? []).map((e) => e.event_type);
}

test("DRIVEN: a request naming no Participant is fulfilled from the eligible pool and publishes one CapabilityFulfilled", async () => {
  // Commissioned where the pool is empty, so the commissioning's own request ends Unavailable and the request under
  // test is the only one that finds the Participant added afterwards.
  const { seuId, capabilityId } = await commissionSeuWithCapability("cr126-pool-fulfil", { withEligibleParticipant: false, tenantId: await getEmptyPoolTenantId() });
  await settleCapabilityRequests(seuId, capabilityId);
  const fixtureParticipantId = await ensureEligibleParticipant(seuId, ["requirements-analysis"]);
  try {
    const before = new Set(((await eventsDB.findByOriginatingObject("SEU", seuId)).data ?? []).map((e) => e.id));

    await ensureActorParticipant(seuId, ROOT_ACTOR_ID);
    await requestCapabilityFulfilment({ seuId, capabilityId, actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
    await waitForCapabilityFulfilled(seuId, capabilityId);

    const { data: events } = await eventsDB.findByOriginatingObject("SEU", seuId);
    const added = (events ?? []).filter((e) => !before.has(e.id));
    const requested = added.filter((e) => e.event_type === "CapabilityRequested");
    const fulfilled = added.filter((e) => e.event_type === "CapabilityFulfilled" && (e.payload as { capabilityId?: string }).capabilityId === capabilityId);
    assert.equal(requested.length, 1);
    assert.equal(fulfilled.length, 1, "one CapabilityFulfilled per request, not per Participant");
    assert.ok(((fulfilled[0].payload as { participantIds?: string[] }).participantIds ?? []).length >= 1);
    assert.equal(requested[0].actor_id, ROOT_ACTOR_ID);
    assert.equal(requested[0].authority_badge, ROOT_ACTOR_BADGE);
  } finally {
    await deactivateParticipants([fixtureParticipantId]);
  }
});

test("DRIVEN: a request for a Capability no Participant holds publishes CapabilityUnavailable and leaves it Unfulfilled", async () => {
  const { seuId, capabilityId } = await commissionSeuWithCapability("cr126-unavailable", { capabilityCode: UNHELD_CAPABILITY_CODE, withEligibleParticipant: false });

  await ensureActorParticipant(seuId, ROOT_ACTOR_ID);
  await requestCapabilityFulfilment({ seuId, capabilityId, actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });

  let unavailable: EventRow | undefined;
  for (let attempt = 0; attempt < 100 && !unavailable; attempt++) {
    const { data: events } = await eventsDB.findByOriginatingObject("SEU", seuId);
    unavailable = (events ?? []).find((e) => e.event_type === "CapabilityUnavailable" && (e.payload as { capabilityId?: string }).capabilityId === capabilityId);
    if (!unavailable) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(unavailable, "expected a CapabilityUnavailable event");
  assert.equal(unavailable.actor_id, ROOT_ACTOR_ID);
  assert.equal(unavailable.authority_badge, ROOT_ACTOR_BADGE);
  assert.ok(!(await seuEventTypes(seuId)).includes("CapabilityFulfilled"), "an empty pool fulfils nothing");

  const detail = await getSeuDetailView(seuId);
  assert.equal(detail?.capabilities.find((c) => c.capabilityId === capabilityId)?.status, "Unfulfilled");
});

test("DRIVEN: the retry sweep re-requests an unavailable Capability after the delay and skips one already in flight", async () => {
  const { seuId, capabilityId } = await commissionSeuWithCapability("cr126-retry-sweep");
  const systemActor = await getSystemActor(seuId);

  await eventBus.publish({
    eventType: "CapabilityUnavailable",
    originatingObjectType: "SEU",
    originatingObjectId: seuId,
    seuId,
    correlationId: eventBus.newCorrelationId(),
    actorId: systemActor.actorId,
    authorityBadge: systemActor.authorBadge,
    payload: { capabilityId },
  });

  const tooEarly = await sweepUnavailableCapabilities({ seuId, now: new Date() });
  assert.ok(!tooEarly.requestedCapabilityIds.includes(capabilityId), "a Capability inside the delay is not re-requested");

  const afterDelay = new Date(Date.now() + (CAPABILITY_RETRY_DELAY_SECONDS + 1) * 1000);
  const swept = await sweepUnavailableCapabilities({ seuId, now: afterDelay });
  assert.ok(swept.requestedCapabilityIds.includes(capabilityId), "a Capability past the delay is re-requested");
  assert.ok((await seuEventTypes(seuId)).includes("CapabilityRequested"));

  const again = await sweepUnavailableCapabilities({ seuId, now: afterDelay });
  assert.ok(!again.requestedCapabilityIds.includes(capabilityId), "a Capability whose latest event is a request is in flight and is skipped");

  await waitForCapabilityFulfilled(seuId, capabilityId);
});
