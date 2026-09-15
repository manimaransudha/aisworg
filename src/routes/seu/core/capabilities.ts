// Ch.12 Capability Fulfilment — direct assignment, no Dispatch Engine
// (Build Plan §5 item 3). Ch.12 §18.1/§18.4 follow-up (owner: "The
// Participant name should be a dropdown that gives a list of [available]
// participants that satisfy the capability") — fulfilment now selects an
// existing, eligible participants_master resource (CR-098) rather than
// minting an ad hoc identity from freely-typed type+name; the lifecycle
// Participant's own participant_id FK (migration 195) is finally populated.
//
// Owner: "The participants dropdown should be multi-select. It chooses as
// many as it wants as eligible." — Ch.12 §7 Hybrid/Composite + FR-12.3
// ("Multiple Participants may jointly fulfil a Capability"), previously
// flagged unbuilt (§18.3). fulfilCapabilityWithParticipants creates one
// lifecycle Participant + one capability_fulfilments row per selected
// participants_master resource; fulfilmentStrategy is "Composite" when more
// than one is selected, otherwise that one Participant's own type.
import { seuCapabilitiesDB, type SeuCapabilityWithCode } from "../../../dblayer/seuCapabilitiesDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { capabilityFulfilmentsDB } from "../../../dblayer/capabilityFulfilmentsDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { dependencyDefinitionEngine } from "../../../domain/engine/dependencyDefinitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory } from "./ontology.js";
import { findEligibleParticipants, getSeuCompetencyRequirements, resolveEligibilityPolicies } from "./participantEligibility.js";
import { transitionParticipant } from "./participants.js";
import type { CapabilityFulfilmentRow, FulfilmentStrategy, ParticipantRow, ParticipantType, SeuRow } from "../../../dblayer/seuTypes.js";

export interface FulfilCapabilityResult {
  fulfilment: CapabilityFulfilmentRow;
  participant: ParticipantRow;
  seuCapabilityId: string;
  capabilityCode: string;
}

async function loadContext(seuId: string, capabilityId: string): Promise<{ seu: SeuRow; seuCapability: SeuCapabilityWithCode }> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) throw new Error(`SEU not found: ${seuId}`);

  const { data: seuCapabilities } = await seuCapabilitiesDB.findBySeuId(seuId);
  const seuCapability = (seuCapabilities ?? []).find((c) => c.capability_id === capabilityId);
  if (!seuCapability) throw new Error(`capability ${capabilityId} is not required by SEU ${seuId}`);

  return { seu, seuCapability };
}

// Resolves a participants_master id to {type, displayName}, re-deriving
// eligibility server-side through the same helper the dropdown itself was
// populated from (participantEligibility.ts) — never trusting the
// submitted id — so the two can never drift apart as more of §8's criteria
// get added to that one place. excludeParticipantMasterIds mirrors exactly
// what the dropdown itself was built with (getSeuDetailView, core/seus.ts)
// — a Participant just released from this same Capability (releaseParticipants
// below) must fail this re-check too, not just be hidden from the dropdown.
async function resolveMasterParticipant(
  seu: SeuRow,
  seuCapability: SeuCapabilityWithCode,
  participantMasterId: string,
  excludeParticipantMasterIds: string[] = []
): Promise<{ type: ParticipantType; displayName: string; participantMasterId: string }> {
  const { data: master } = await participantsMasterDB.findById(participantMasterId);
  if (!master) throw new Error(`Participant ${participantMasterId} not found`);
  if (!seu.tenant_id) throw new Error(`SEU ${seu.id} has no owning tenant`);
  const competency = await getSeuCompetencyRequirements(seu);
  const requiredPolicies = await resolveEligibilityPolicies(seu);
  const eligible = await findEligibleParticipants({ tenantId: seu.tenant_id, capabilityCode: seuCapability.capability_code, competency, requiredPolicyIds: requiredPolicies.map((p) => p.id), excludeParticipantMasterIds });
  if (!eligible.some((p) => p.id === master.id)) {
    throw new Error(`Participant "${master.display_name}" is not eligible for Capability "${seuCapability.capability_code}"`);
  }
  return { type: master.type, displayName: master.display_name, participantMasterId: master.id };
}

async function fulfilOne(
  seu: SeuRow,
  seuCapability: SeuCapabilityWithCode,
  resolved: { type: ParticipantType; displayName: string; participantMasterId: string | null },
  strategyOverride?: FulfilmentStrategy
): Promise<FulfilCapabilityResult> {
  const { data: participant, error: participantErr } = await participantsDB.create({
    seuId: seu.id,
    type: resolved.type,
    displayName: resolved.displayName,
    participantId: resolved.participantMasterId,
  });
  if (participantErr || !participant) throw participantErr ?? new Error("failed to create participant");

  const { data: fulfilment, error: fulfilmentErr } = await capabilityFulfilmentsDB.create({
    seuCapabilityId: seuCapability.id,
    participantId: participant.id,
    fulfilmentStrategy: strategyOverride ?? resolved.type,
  });
  if (fulfilmentErr || !fulfilment) throw fulfilmentErr ?? new Error("failed to create capability fulfilment");

  await seuCapabilitiesDB.markFulfilled(seuCapability.id);

  // CR-042 — dependency_definitions Capability-type rows are keyed by
  // Service code, not the bare Capability code (materialiseDependencyGraph
  // already expands one fromCapabilityCode into one row per Service that
  // Capability provides), so push-evaluation fires once per Service here.
  const { data: fulfilledServices } = await servicesDB.findByCapabilityId(seuCapability.capability_id);
  for (const service of fulfilledServices ?? []) {
    await dependencyDefinitionEngine.evaluateAndPublishFromTransition({
      seuId: seu.id,
      entityType: "Capability",
      name: service.code,
      newState: "Fulfilled",
    });
  }

  // Ch.13 §16 — about the Participant now existing, not about the
  // Capability being fulfilled (CapabilityFulfilled, published right below,
  // unchanged) — two different facts from the same call.
  await eventBus.publish({
    eventType: "ParticipantCreated",
    originatingObjectType: "Participant",
    originatingObjectId: participant.id,
    seuId: seu.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { participantType: resolved.type, participantMasterId: resolved.participantMasterId },
  });

  await eventBus.publish({
    eventType: "CapabilityFulfilled",
    originatingObjectType: "SEU",
    originatingObjectId: seu.id,
    seuId: seu.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { capabilityId: seuCapability.capability_id, participantId: participant.id },
  });

  return { fulfilment, participant, seuCapabilityId: seuCapability.id, capabilityCode: seuCapability.capability_code };
}

// Two ways in: the SEU detail page's own Fulfil dropdown selects one or more
// existing, eligible participants_master resources (CR-098; see
// fulfilCapabilityWithParticipants below for the multi-select path); the
// JSON API (api/seus.ts) and every existing test still create a single ad
// hoc Participant directly from a freely-supplied type+name, exactly as
// before this dropdown existed — kept working deliberately rather than
// migrated in the same pass (17 call sites; a real, separate decision, not
// mechanical).
export async function fulfilCapability(input: {
  seuId: string;
  capabilityId: string;
  participantMasterId?: string;
  participantType?: ParticipantType;
  displayName?: string;
}): Promise<FulfilCapabilityResult> {
  const { seu, seuCapability } = await loadContext(input.seuId, input.capabilityId);

  if (input.participantMasterId) {
    const { data: excludeParticipantMasterIds } = await capabilityFulfilmentsDB.findReleasedParticipantMasterIds(seuCapability.id);
    const resolved = await resolveMasterParticipant(seu, seuCapability, input.participantMasterId, excludeParticipantMasterIds ?? []);
    return fulfilOne(seu, seuCapability, resolved);
  }
  if (input.participantType && input.displayName) {
    await assertCanonicalCategory("participant-types", input.participantType);
    return fulfilOne(seu, seuCapability, { type: input.participantType, displayName: input.displayName, participantMasterId: null });
  }
  throw new Error("either participantMasterId or participantType+displayName is required");
}

// Owner: "The participants dropdown should be multi-select. It chooses as
// many as it wants as eligible." One lifecycle Participant + one
// capability_fulfilments row per selected participants_master resource,
// all against the same SEU Capability — Ch.12 §7's Hybrid/Composite made
// real. fulfilmentStrategy is "Composite" whenever more than one Participant
// is selected together (each one's own type is still recorded on its own
// `participants.type`); a single selection keeps behaving exactly like
// fulfilCapability's own participantMasterId path (that one participant's
// own type as the strategy).
export async function fulfilCapabilityWithParticipants(input: {
  seuId: string;
  capabilityId: string;
  participantMasterIds: string[];
}): Promise<FulfilCapabilityResult[]> {
  if (input.participantMasterIds.length === 0) throw new Error("at least one Participant is required");

  const { seu, seuCapability } = await loadContext(input.seuId, input.capabilityId);
  const strategy: FulfilmentStrategy | undefined = input.participantMasterIds.length > 1 ? "Composite" : undefined;
  const { data: excludeParticipantMasterIds } = await capabilityFulfilmentsDB.findReleasedParticipantMasterIds(seuCapability.id);

  const results: FulfilCapabilityResult[] = [];
  for (const participantMasterId of input.participantMasterIds) {
    const resolved = await resolveMasterParticipant(seu, seuCapability, participantMasterId, excludeParticipantMasterIds ?? []);
    results.push(await fulfilOne(seu, seuCapability, resolved, strategy));
  }
  return results;
}

// Owner: "it should show the list of already assigned participants, by
// participant type. Choose and click on replace. Replace should take it
// back to unfilled state... Howmany ever number of participants are
// released, it should remain the same [-> Unfulfilled]." Replaces the
// detail page's own use of the old atomic replaceParticipant swap
// (core/participants.ts, left untouched — still used by the JSON dry-run
// suite's own separate web route) with a two-step flow: release drives
// each selected Participant through the same governed Released -> Archived
// transitions and revokes their fulfilment, then unconditionally reverts
// the Capability to Unfulfilled, regardless of how many (or how few) of
// its current fulfilments were released. The human then picks
// replacement(s) through the ordinary Fulfil/Assign path
// (fulfilCapabilityWithParticipants above), which already excludes
// whoever was just released via findReleasedParticipantMasterIds.
export async function releaseParticipants(input: {
  seuId: string;
  capabilityId: string;
  participantIds: string[];
  actorRole: string;
  actorId?: string;
}): Promise<ParticipantRow[]> {
  if (input.participantIds.length === 0) throw new Error("at least one Participant is required");
  const { seuCapability } = await loadContext(input.seuId, input.capabilityId);

  const released: ParticipantRow[] = [];
  for (const participantId of input.participantIds) {
    const { data: participant } = await participantsDB.findById(participantId);
    if (!participant) throw new Error(`Participant not found: ${participantId}`);

    const { data: fulfilment } = await capabilityFulfilmentsDB.findActiveByParticipantId(participant.id);
    if (!fulfilment || fulfilment.seu_capability_id !== seuCapability.id) {
      throw new Error(`Participant ${participantId} has no active Capability Fulfilment for Capability "${seuCapability.capability_code}"`);
    }

    if (participant.state !== "Released") {
      const toReleased = await transitionParticipant({ participantId: participant.id, targetState: "Released", actorRole: input.actorRole, actorId: input.actorId });
      if (!toReleased.ok) throw new Error(`failed to release Participant ${participant.id}: ${toReleased.reason}`);
    }
    const toArchived = await transitionParticipant({ participantId: participant.id, targetState: "Archived", actorRole: input.actorRole, actorId: input.actorId });
    if (!toArchived.ok) throw new Error(`failed to archive Participant ${participant.id}: ${toArchived.reason}`);

    await capabilityFulfilmentsDB.revoke(fulfilment.id);
    released.push(toArchived.participant);
  }

  await seuCapabilitiesDB.markUnfulfilled(seuCapability.id);
  return released;
}
