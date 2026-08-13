// Ch.8 commissioning pipeline (Build Plan §4, endpoint #4). Orchestrates the
// generic engine modules against the SEU-shaped tables; contains no
// transition-evaluation or composition logic itself — that stays in
// src/domain/engine/, per Build Plan §2.2's "small core" split.
import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { seuCapabilitiesDB } from "../../../dblayer/seuCapabilitiesDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { dependencyEdgesDB } from "../../../dblayer/dependencyEdgesDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { compositionEngine } from "../../../domain/engine/compositionEngine.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { logger } from "../../../utils/logger.js";
import { createObjective, ensureOneShotContainer } from "./objectives.js";
import { findCandidateTemplates } from "./templates.js";
import { findOrCreateDefaultProfile } from "./profiles.js";
import type { CommissioningReport, SeuLifecycleState, SeuRow } from "../../../dblayer/seuTypes.js";

export type CommissionResult =
  | { ok: true; seu: SeuRow; report: CommissioningReport }
  | { ok: false; stage: string; reason: string; seuId?: string };

const AUTOMATIC_STEPS: Array<[SeuLifecycleState, SeuLifecycleState]> = [
  ["Commissioned", "Configured"],
  ["Configured", "Activated"],
  ["Activated", "Operational"],
];

export async function commissionSeu(input: {
  objectiveId: string;
  templateId: string;
  profileId: string;
  actorRole: string;
  actorId?: string;
  requestedBy?: number | null;
  // Participant Integration — Plan step 6: which tenant owns this SEU. Defaults
  // to the seeded default tenant; determines which edge configuration its Work
  // Items run against.
  tenantId?: string | null;
}): Promise<CommissionResult> {
  const { data: objective } = await objectivesDB.findById(input.objectiveId);
  const { data: template } = await templatesDB.findById(input.templateId);
  const { data: profile } = await profilesDB.findById(input.profileId);
  if (!objective) return { ok: false, stage: "validate_request", reason: `objective not found: ${input.objectiveId}` };
  if (!template) return { ok: false, stage: "validate_request", reason: `template not found: ${input.templateId}` };
  if (!profile) return { ok: false, stage: "validate_request", reason: `profile not found: ${input.profileId}` };
  if (profile.base_template_id !== template.id) {
    return { ok: false, stage: "validate_request", reason: "profile does not target the given template" };
  }
  // Ch.1: an Objective must be Active to justify commissioning against it.
  // Real now that Objective has a governed lifecycle (Post-MVP Phase 1) — a
  // no-op for callers that create-and-commission an Objective in one shot,
  // since that path creates it Active by default; a real check for anything
  // still Proposed, or already Achieved/Superseded/Retired/Archived.
  if (objective.status !== "Active") {
    return { ok: false, stage: "validate_request", reason: `objective is not Active (status: ${objective.status}) — activate it before commissioning against it` };
  }

  // CR-009 (supersedes CR-002 / Ch.1 §18.2): an SEU serves the finest-grained
  // objective, so commissioning is allowed against any non-Strategic *leaf* —
  // an Operational or Engineering Objective with no children. A Strategic
  // Objective is never commissionable (it's a programme umbrella, §7); an
  // Objective that has been decomposed further isn't the leaf its children are.
  if (objective.tier === "Strategic") {
    return { ok: false, stage: "validate_request", reason: `a Strategic Objective is a programme umbrella and cannot have an SEU (decompose it into Operational/Engineering objectives)` };
  }
  const { data: children } = await objectivesDB.findChildren(objective.id);
  if ((children ?? []).length > 0) {
    return { ok: false, stage: "validate_request", reason: `objective has been decomposed further — commission an SEU against its leaf objectives, not this parent` };
  }

  // CR-002 (Ch.1 §18.2/§18.8): at most one SEU per Objective. A friendly
  // rejection ahead of the UNIQUE index, so "already assigned" reads clearly
  // (the index is the race-free backstop).
  const { data: existingSeu } = await seusDB.findByObjectiveId(objective.id);
  if (existingSeu) {
    return { ok: false, stage: "validate_request", reason: `this Objective is already assigned to an SEU (${existingSeu.id})` };
  }

  // Ch.2 §7 / Build Plan §5 item 8: 'Pending' is the pre-Commissioned working
  // state this plan adds so the pipeline has a row to attach the EBM and
  // report to before Ch.37's own lifecycle formally begins at 'Commissioned'.
  // Resolve the owning tenant (default unless one was named), so the SEU's Work
  // Items dispatch against that tenant's edge configuration.
  let tenantId = input.tenantId ?? null;
  if (!tenantId) {
    const { data: defaultTenant } = await tenantsDB.findDefault();
    tenantId = defaultTenant?.id ?? null;
  }

  const { data: seu, error: seuErr } = await seusDB.create({
    objectiveId: objective.id,
    templateId: template.id,
    profileId: profile.id,
    requestedBy: input.requestedBy,
    tenantId,
  });
  if (seuErr || !seu) return { ok: false, stage: "allocate_runtime", reason: (seuErr ?? new Error("failed to create SEU")).message };

  const correlationId = eventBus.newCorrelationId();
  await eventBus.publish({
    eventType: "SEUCommissionRequested",
    originatingObjectType: "SEU",
    originatingObjectId: seu.id,
    correlationId,
    payload: { objectiveId: objective.id, templateId: template.id, profileId: profile.id },
  });

  // Ch.8 §9 Validate Request — the minimal, real Authority + Policy check
  // (Build Plan §1: "who can commission").
  const gate = await transitionEngine.evaluate({
    entityType: "SEU",
    fromState: "Pending",
    toState: "Commissioned",
    actorRole: input.actorRole,
    actorId: input.actorId,
    context: { profile, objective },
  });
  if (!gate.allowed) {
    await eventBus.publish({
      eventType: "SEUCommissionRejected",
      originatingObjectType: "SEU",
      originatingObjectId: seu.id,
      correlationId,
      causationId: correlationId,
      payload: gate,
    });
    return { ok: false, stage: "validate_request", reason: describeRejection(gate), seuId: seu.id };
  }

  // Ch.4 Composition Engine
  const { composedPacks, compositionReport } = await compositionEngine.compose({ templateId: template.id, profileId: profile.id });

  // FR-3.6/3.7 & FR-21.7: behavioural/governance conflicts requiring human
  // judgement prevent commissioning until resolved. Detected at composition;
  // the SEU never reaches Operational (it stays the pre-commissioned Pending
  // row, same shape as the Authority rejection above).
  if (compositionReport.conflicts.length > 0) {
    await eventBus.publish({
      eventType: "SEUCommissionRejected",
      originatingObjectType: "SEU",
      originatingObjectId: seu.id,
      correlationId,
      causationId: correlationId,
      payload: { reason: "composition_conflict", conflicts: compositionReport.conflicts },
    });
    return { ok: false, stage: "compose_ebm", reason: `composition conflicts must be resolved before commissioning: ${compositionReport.conflicts.join(" | ")}`, seuId: seu.id };
  }

  const { data: ebm, error: ebmErr } = await ebmsDB.create({
    seuId: seu.id,
    templateId: template.id,
    profileId: profile.id,
    composedPacks,
    compositionReport,
  });
  if (ebmErr || !ebm) return { ok: false, stage: "compose_ebm", reason: (ebmErr ?? new Error("failed to compose EBM")).message, seuId: seu.id };
  await seusDB.setActiveEbm(seu.id, ebm.id);

  await seusDB.updateLifecycleState(seu.id, "Commissioned");
  await eventBus.publish({ eventType: "SEUCommissioned", originatingObjectType: "SEU", originatingObjectId: seu.id, correlationId, causationId: correlationId });

  // Ch.8 §12 Create Engineering Assets — required Capabilities + the
  // Template's Deliverable Catalogue, wired into the Dependency Graph.
  const { data: requiredCapabilities } = await templatesDB.getRequiredCapabilities(template.id);
  await seuCapabilitiesDB.createMany(seu.id, (requiredCapabilities ?? []).map((c) => c.id));

  const deliverableIdByCode = new Map<string, string>();
  for (const seed of template.deliverable_catalogue) {
    const producingCapability = seed.producingCapabilityCode
      ? (requiredCapabilities ?? []).find((c) => c.code === seed.producingCapabilityCode)
      : undefined;
    const { data: deliverable } = await deliverablesDB.create({
      seuId: seu.id,
      name: seed.name,
      category: seed.category,
      producingCapabilityId: producingCapability?.id ?? null,
    });
    if (deliverable) deliverableIdByCode.set(seed.code, deliverable.id);
  }
  for (const seed of template.deliverable_catalogue) {
    const fromId = deliverableIdByCode.get(seed.code);
    if (!fromId) continue;
    for (const dependsOnCode of seed.dependsOnDeliverableCodes ?? []) {
      const toId = deliverableIdByCode.get(dependsOnCode);
      if (toId) {
        await dependencyEdgesDB.createDeliverableEdge({ seuId: seu.id, fromDeliverableId: fromId, toDeliverableId: toId, requiredState: "Approved" });
      }
    }
    // Ch.9 §8 / Ch.11 §9 (Post-MVP Phase 2): a Capability edge names the
    // specific Service, not the bare Capability — satisfied once the SEU's
    // requirement for that Service's providing Capability is Fulfilled.
    // Distinct from the Deliverable edge above: that asks whether the
    // upstream artefact reached a state; this asks whether anyone is actually
    // assigned to the upstream Capability at all.
    for (const capabilityCode of seed.dependsOnCapabilityServiceCodes ?? []) {
      const capability = (requiredCapabilities ?? []).find((c) => c.code === capabilityCode);
      if (!capability) continue;
      const { data: services } = await servicesDB.findByCapabilityId(capability.id);
      for (const service of services ?? []) {
        await dependencyEdgesDB.createCapabilityEdge({ seuId: seu.id, fromDeliverableId: fromId, toServiceId: service.id });
      }
    }
  }

  // Ch.37 — remaining transitions are system-internal for MVP (no Authority/
  // Policy declared on them in the seed data), but still routed through
  // transitionEngine so the mechanism is real, not bypassed for convenience.
  for (const [from, to] of AUTOMATIC_STEPS) {
    const step = await transitionEngine.evaluate({ entityType: "SEU", fromState: from, toState: to, actorRole: input.actorRole,
    actorId: input.actorId, context: {} });
    if (!step.allowed) {
      return { ok: false, stage: `transition_${from}_to_${to}`, reason: describeRejection(step), seuId: seu.id };
    }
    await seusDB.updateLifecycleState(seu.id, to);
    await eventBus.publish({ eventType: `SEU${to}`, originatingObjectType: "SEU", originatingObjectId: seu.id, correlationId, causationId: correlationId });
  }

  const report: CommissioningReport = {
    identity: { seuId: seu.id, templateCode: template.code, profileCode: profile.code, ebmId: ebm.id },
    composition: { packsUsed: composedPacks.map((p) => p.packCode), warnings: compositionReport.warnings, conflicts: compositionReport.conflicts },
    validation: { errors: [] },
    runtime: {
      initialCapabilities: (requiredCapabilities ?? []).map((c) => c.code),
      initialDeliverables: [...deliverableIdByCode.keys()],
    },
  };
  await seusDB.setCommissioningReport(seu.id, report);

  const { data: finalSeu, error: finalErr } = await seusDB.findById(seu.id);
  if (finalErr || !finalSeu) {
    logger.error("[commissioning] failed to reload SEU after commissioning", finalErr as Error);
    return { ok: false, stage: "finalise", reason: "SEU commissioned but could not be reloaded", seuId: seu.id };
  }

  return { ok: true, seu: finalSeu, report };
}

function describeRejection(outcome: { reason: string } & Record<string, unknown>): string {
  const { reason, ...rest } = outcome;
  const detail = Object.entries(rest)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ");
  return detail ? `${reason} (${detail})` : reason;
}

export type CommissionFromFormResult =
  | CommissionResult
  | { ok: false; stage: "select_template"; reason: string };

// The "New SEU" admin-UI form collapses steps 1–4 of the API journey (create
// Objective → find candidate Template → apply Profile → commission) into one
// submit, calling the exact same core functions the API layer calls — no
// duplicated business logic, per coding_principles.md's Controller Architecture.
export async function commissionFromForm(input: {
  statement: string;
  requiredCapabilityCodes: string[];
  actorRole: string;
  actorId?: string;
  requestedBy?: number | null;
  tenantId?: string | null;
}): Promise<CommissionFromFormResult> {
  // CR-009: a bare Engineering Objective needs a parent — hang it under the
  // reused Strategic container root (owner decision, 2026-08-13).
  const container = await ensureOneShotContainer(input.requestedBy);
  const { objective } = await createObjective({
    statement: input.statement,
    requiredCapabilityCodes: input.requiredCapabilityCodes,
    parentObjectiveId: container.id,
    requestedBy: input.requestedBy,
  });

  const candidates = await findCandidateTemplates(input.requiredCapabilityCodes);
  const template = candidates.find((c) => c.satisfies);
  if (!template) {
    return {
      ok: false,
      stage: "select_template",
      reason: `no Template satisfies every required Capability (candidates checked: ${candidates.map((c) => c.code).join(", ") || "none"})`,
    };
  }

  const profile = await findOrCreateDefaultProfile(template.id);

  return commissionSeu({
    objectiveId: objective.id,
    templateId: template.id,
    profileId: profile.id,
    actorRole: input.actorRole,
    actorId: input.actorId,
    requestedBy: input.requestedBy,
    tenantId: input.tenantId,
  });
}

export type CommissionFromObjectiveResult =
  | CommissionResult
  | { ok: false; stage: "select_template"; reason: string };

// The Objective-first path (Post-MVP Phase 1): commission against an
// Objective that already exists — and is Active — instead of creating one
// inline. Required Capabilities come from the Objective's own declared set,
// not re-picked via checkboxes.
export async function commissionFromExistingObjective(input: {
  objectiveId: string;
  actorRole: string;
  actorId?: string;
  requestedBy?: number | null;
  // Real choice, not a heuristic override: findOrCreateDefaultProfile's own
  // comment flagged this as unsolved — this is the caller (the web route's
  // real dropdown, sourced from listRealProfilesForTemplate) closing it.
  // commissionSeu's own base_template_id check catches a mismatched id, so
  // this doesn't re-validate it belongs to the matched Template.
  profileId?: string;
}): Promise<CommissionFromObjectiveResult> {
  const { data: requiredCapabilities } = await objectivesDB.getRequiredCapabilities(input.objectiveId);
  const capabilityCodes = (requiredCapabilities ?? []).map((c) => c.code);

  const candidates = await findCandidateTemplates(capabilityCodes);
  const template = candidates.find((c) => c.satisfies);
  if (!template) {
    return {
      ok: false,
      stage: "select_template",
      reason: `no Template satisfies every required Capability (candidates checked: ${candidates.map((c) => c.code).join(", ") || "none"})`,
    };
  }

  const profileId = input.profileId ?? (await findOrCreateDefaultProfile(template.id)).id;

  return commissionSeu({
    objectiveId: input.objectiveId,
    templateId: template.id,
    profileId,
    actorRole: input.actorRole,
    actorId: input.actorId,
    requestedBy: input.requestedBy,
  });
}
