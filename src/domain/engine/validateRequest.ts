// Chapter 8 §9 "Validate Request" — the CommissionRequested consumer.
// design/mvp-build-plan/SEU Composition.md, 2026-09-07 — owner: "This is
// what should happen in previewCommissioningValidation() ... 1. Check the
// Objective is still active ... 2. Check if Profile id is active ... 3.
// Check if underlying templates, capability code and anything else that is
// supposed to be active is active ... 4. If not, Event CommissionFailed is
// emitted. 5. If all is well [Commission]Validated is emitted." Compose EBM
// itself (unravelComposition/detectCompositionConflicts) stays entirely
// inside ebmComposerHandler, off CommissionValidated — this handler never
// touches it, and is named for what it actually is (Validate Request), not
// a "preview" of anything.
//
// Payload is just {seuId} (owner: "matter of fact, payload just needs the
// seuid and nothing more") — objective_id/profile_id/template_id are read
// off the SEU row itself, never duplicated into the event.
import { seusDB } from "../../dblayer/seusDB.js";
import { objectivesDB } from "../../dblayer/objectivesDB.js";
import { templatesDB } from "../../dblayer/templatesDB.js";
import { profilesDB } from "../../dblayer/profilesDB.js";
import { checkRequestLiveness, type LivenessCheck } from "../../routes/seu/core/commissioning.js";
import { logger } from "../../utils/logger.js";
import { eventBus } from "./eventBus.js";
import { transitionEngine } from "./transitionEngine.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow, SeuRow, ObjectiveRow, TemplateRow, ProfileRow } from "../../dblayer/seuTypes.js";
import { getPlatformTenantId } from "../../dblayer/constants.js";
 
interface CommissionRequestedPayload {
  seuId: string;
}

// Same failure-reporting shape every dead-end below already publishes —
// factored out so the outer catch (a step here throwing instead of
// returning a checked result, e.g. a lookup failing) can report through the
// identical path instead of being swallowed by eventBus.dispatch's own
// generic catch (it just logs "handler failed" and moves on — no
// CommissionFailed, no Failed state, so a caller polling for either spins
// until its own timeout instead of seeing the real failure immediately).
async function failValidation(seu: { id: string }, event: EventRow, reason: string): Promise<void> {
  await seusDB.updateLifecycleState(seu.id, "Failed");
  await eventBus.publish({
    eventType: "CommissionFailed",
    originatingObjectType: "SEU",
    originatingObjectId: seu.id,
    seuId: seu.id,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id,
    authorityBadge: event.authority_badge,
    payload: { stage: "validate_request", reason },
  });
}

export const validateRequestHandler: EventHandler = async (event: EventRow) => {
  const { seuId } = event.payload as unknown as CommissionRequestedPayload;
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) {
    logger.error(`[validateRequest] SEU not found: ${seuId}`);
    return;
  }
  const { data: objective } = await objectivesDB.findById(seu.objective_id);
  const { data: template } = await templatesDB.findById(seu.template_id);
  const { data: profile } = await profilesDB.findById(seu.profile_id);
  if (!objective || !template || !profile) {
    logger.error(`[validateRequest] Objective/Template/Profile referenced by SEU ${seuId} not found`);
    return;
  }
  try {
    await runValidation(seu, objective, template, profile, event);
  } catch (err) {
    await failValidation(seu, event, (err as Error).message);
  }
};

async function runValidation(seu: SeuRow, objective: ObjectiveRow, template: TemplateRow, profile: ProfileRow, event: EventRow): Promise<void> {
  const viewerTenantId = seu.tenant_id ?? (await getPlatformTenantId());

  // Owner: "what we build has to be centered on the fundamentals that we
  // have built." — restored: this is commissionSeu's own Authority/Policy
  // gate (CR-006's noun_verb badge check, "who can commission"), dropped
  // when checkRequestLiveness moved here and never carried over with it.
  // actorRole isn't consulted for authorisation (transitionEngine.ts's own
  // comment — badge only), but a real actorId is required; event.actor_id
  // is the real human who clicked "Queue to Validate" (the web route
  // publishes CommissionRequested with the session user's own id).
  const gate = await transitionEngine.evaluate({
    entityType: "SEU",
    fromState: "Pending",
    toState: "Commissioned",
    actorRole: "system",
    actorId: event.actor_id,
    context: { profile, objective },
  });
  // Owner: "Show details of what was checked and what passed the check and
  // failed the check if it is failed" — the Authority/Policy gate is itself
  // one of Validate Request's checks, same standing as every liveness check
  // below; recorded here so the Validate page can show it alongside them.
  const authorityCheck: LivenessCheck = gate.allowed
    ? { item: "Authority (badge seu_commission)", status: "live", detail: `authorised via ${gate.authorityBadge ?? "system"}` }
    : {
        item: "Authority (badge seu_commission)",
        status: "dead",
        detail: gate.reason === "authority_denied" ? `missing badge ${gate.authorityRuleCode}` : gate.reason === "policy_blocked" ? `policy "${gate.policyCode}" blocked` : gate.reason,
      };
  if (!gate.allowed) {
    await seusDB.updateLifecycleState(seu.id, "Failed");
    await eventBus.publish({
      eventType: "CommissionFailed",
      originatingObjectType: "SEU",
      originatingObjectId: seu.id,
      seuId: seu.id,
      correlationId: event.correlation_id,
      causationId: event.id,
      actorId: event.actor_id,
      authorityBadge: event.authority_badge,
      payload: { stage: "validate_request", checks: [authorityCheck], ...gate },
    });
    return;
  }

  const livenessChecks = await checkRequestLiveness({ objective, templates: [template], profile, viewerTenantId });
  const checks = [authorityCheck, ...livenessChecks];
  const deadReferences = livenessChecks.filter((c) => c.status === "dead").map((c) => (c.detail ? `${c.item} ${c.detail}` : c.item));
  if (deadReferences.length > 0) {
    await seusDB.updateLifecycleState(seu.id, "Failed");
    await eventBus.publish({
      eventType: "CommissionFailed",
      originatingObjectType: "SEU",
      originatingObjectId: seu.id,
      seuId: seu.id,
      correlationId: event.correlation_id,
      causationId: event.id,
      actorId: event.actor_id,
      authorityBadge: event.authority_badge,
      payload: { stage: "validate_request", reason: "stale_reference", references: deadReferences, checks },
    });
    return;
  }

  await eventBus.publish({
    eventType: "CommissionValidated",
    originatingObjectType: "SEU",
    originatingObjectId: seu.id,
    seuId: seu.id,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id,
    authorityBadge: gate.authorityBadge ?? "system",
    payload: {
      objectiveId: seu.objective_id,
      templateIds: [seu.template_id],
      profileIds: [seu.profile_id],
      viewerTenantId,
      checks,
    },
  });
}
