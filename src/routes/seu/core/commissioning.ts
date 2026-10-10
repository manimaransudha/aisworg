import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { eventsDB } from "../../../dblayer/eventsDB.js";
import { seuCapabilitiesDB } from "../../../dblayer/seuCapabilitiesDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { compositionEngine } from "../../../domain/engine/compositionEngine.js";
import type { CompositionSource } from "../../../domain/engine/compositionEngine.js";
import { unravelComposition, detectCompositionConflicts, formatCompositionConflict } from "../../../domain/engine/profileCompositionUnravel.js";
import type { UnraveledComposition, CompositionConflict, CompositionConflictOption } from "../../../domain/engine/profileCompositionUnravel.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { policyEngine } from "../../../domain/engine/policyEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { logger } from "../../../utils/logger.js";
import { createObjective, ensureOneShotContainer } from "./objectives.js";
import { raiseAttentionItem, resolveAuthor, resolveSystemActor } from "./attentionItems.js";
import { raiseObligationForBlockedTransition, raiseObligationsForPackDefinitions } from "./obligations.js";
import { findCandidateTemplates } from "./templates.js";
import { extractProfileDetails, getProfilePackSelections, extractExposedParameterOverrides, listRealProfilesForTemplate } from "./profiles.js";
import type { ProfileDetail } from "./profiles.js";
import { resolveLabels } from "./ontology.js";
import type { CommissioningReport, SeuLifecycleState, SeuRow, TemplateRow, ProfileRow, ObjectiveRow, CapabilityRow, TemplateDeliverableSeed, EbmCompositionReport, EbmComposedPack, EbmRow } from "../../../dblayer/seuTypes.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
 
export type CommissionResult =
  | { ok: true; seu: SeuRow }
  | { ok: false; stage: string; reason: string; seuId?: string };

const PRE_ASSETS_STEPS: Array<[SeuLifecycleState, SeuLifecycleState]> = [
  ["Pending", "Configured"],
  ["Configured", "Commissioned"],
];

export interface LivenessCheck {
  item: string;
  status: "live" | "dead";
  detail?: string;
}

export async function checkRequestLiveness(input: { objective: ObjectiveRow; templates: TemplateRow[]; profile: ProfileRow; viewerTenantId: string }): Promise<LivenessCheck[]> {
  const checks: LivenessCheck[] = [];
  const viewer = { isRoot: false, tenantId: input.viewerTenantId };

  checks.push({ item: "Objective", status: input.objective.status === "Active" ? "live" : "dead", detail: `status: ${input.objective.status}` });
  checks.push({ item: `Profile "${input.profile.code}"`, status: input.profile.status === "Active" ? "live" : "dead", detail: `status: ${input.profile.status}` });

  for (const template of input.templates) {
    checks.push({ item: `Template "${template.code}"`, status: template.status === "Active" ? "live" : "dead", detail: `status: ${template.status}` });
  }

  const packCodes = new Set<string>();
  for (const template of input.templates) {
    const { data: mandatoryCodes } = await templatesDB.getMandatoryPackCodes(template.id);
    for (const code of mandatoryCodes ?? []) packCodes.add(code);
  }
  const selections = await getProfilePackSelections(input.profile.id);
  for (const code of [
    ...(selections.optionalPackCodes ?? []),
    ...(selections.technologyPackCodes ?? []),
    ...(selections.domainPackCodes ?? []),
    ...(selections.compliancePackCodes ?? []),
    ...(selections.integrationPackCodes ?? []),
    ...(selections.engineeringPackCodes ?? []),
    ...(selections.organisationPackCodes ?? []),
  ]) packCodes.add(code);
  for (const code of packCodes) {
    const { data: pack } = await packsDB.findActiveByCode(code);
    checks.push(pack ? { item: `Pack "${code}"`, status: "live", detail: `Active version ${pack.pack_version}` } : { item: `Pack "${code}"`, status: "dead", detail: "has no Active version" });
  }

  const draft = (input.profile.draft_content ?? {}) as Record<string, unknown>;
  for (const code of (draft.additionalCapabilityCodes as string[] | undefined) ?? []) {
    const { data: concept } = await ontologyDB.findConcept("capability-name", code, viewer);
    checks.push(
      concept
        ? { item: `Capability "${code}"`, status: "live", detail: "active capability-name concept" }
        : { item: `Capability "${code}"`, status: "dead", detail: "not a live capability-name concept" }
    );
  }

  for (const override of extractExposedParameterOverrides(input.profile.draft_content)) {
    if (override.sourceType !== "service") continue;
    const { data: service } = await serviceDefinitionsDB.findActiveByCodeVisibleTo(override.sourceCode, input.viewerTenantId);
    checks.push(
      service ? { item: `Service "${override.sourceCode}"`, status: "live", detail: `Active version ${service.version}` } : { item: `Service "${override.sourceCode}"`, status: "dead", detail: "has no Active version" }
    );
  }

  return checks;
}

export async function checkEbmLiveness(ebm: EbmRow): Promise<string[]> {
  const dead: string[] = [];
  const { data: template } = await templatesDB.findById(ebm.template_id);
  if (!template) dead.push(`Template referenced by this EBM no longer exists`);
  else if (template.status !== "Active") dead.push(`Template "${template.code}" is not Active (status: ${template.status})`);

  const { data: profile } = await profilesDB.findById(ebm.profile_id);
  if (!profile) dead.push(`Profile referenced by this EBM no longer exists`);
  else if (profile.status !== "Active") dead.push(`Profile "${profile.code}" is not Active (status: ${profile.status})`);

  for (const p of ebm.composed_packs) {
    const { data: pack } = await packsDB.findActiveByCode(p.packCode);
    if (!pack) dead.push(`Pack "${p.packCode}" has no Active version`);
  }

  return dead;
}

export async function commissionSeu(input: {
  objectiveId: string;
  templateIds: string[];
  profileIds: string[];
  resolvedParameterOverrides?: Record<string, string>;
  resolvedCompositionConflicts?: Record<string, unknown>;
  actorRole: string;
  actorId: string;
  requestedBy: string;
  tenantId?: string | null;
}): Promise<CommissionResult> {
  const { data: objective } = await objectivesDB.findById(input.objectiveId);
  if (!objective) return { ok: false, stage: "validate_request", reason: `objective not found: ${input.objectiveId}` };
  if (input.templateIds.length === 0) return { ok: false, stage: "validate_request", reason: "at least one Template is required" };
  if (input.profileIds.length === 0) return { ok: false, stage: "validate_request", reason: "at least one Profile is required" };
  if (input.profileIds.length > 1) return { ok: false, stage: "validate_request", reason: "only one Profile may be selected for commissioning" };

  const templates: TemplateRow[] = [];
  for (const templateId of input.templateIds) {
    const { data: template } = await templatesDB.findById(templateId);
    if (!template) return { ok: false, stage: "validate_request", reason: `template not found: ${templateId}` };
    templates.push(template);
  }
  const profiles: ProfileRow[] = [];
  for (const profileId of input.profileIds) {
    const { data: profile } = await profilesDB.findById(profileId);
    if (!profile) return { ok: false, stage: "validate_request", reason: `profile not found: ${profileId}` };
    profiles.push(profile);
  }
  const templateIdSet = new Set(input.templateIds);
  for (const profile of profiles) {
    if (!templateIdSet.has(profile.base_template_id)) {
      return { ok: false, stage: "validate_request", reason: `profile "${profile.code}" does not target any of the given Templates` };
    }
  }
  const template = templates[0];
  const profile = profiles[0];
  if (objective.status !== "Active") {
    return { ok: false, stage: "validate_request", reason: `objective is not Active (status: ${objective.status}) — activate it before commissioning against it` };
  }

  if (objective.tier === "Strategic") {
    return { ok: false, stage: "validate_request", reason: `a Strategic Objective is a programme umbrella and cannot have an SEU (decompose it into Operational/Engineering objectives)` };
  }
  const { data: children } = await objectivesDB.findChildren(objective.id);
  if ((children ?? []).length > 0) {
    return { ok: false, stage: "validate_request", reason: `objective has been decomposed further — commission an SEU against its leaf objectives, not this parent` };
  }

  const { data: existingSeu } = await seusDB.findByObjectiveId(objective.id);
  const reusingExisting = !!existingSeu && existingSeu.lifecycle_state === "Pending" && existingSeu.profile_id === profile.id && existingSeu.template_id === template.id;
  if (existingSeu && !reusingExisting) {
    return { ok: false, stage: "validate_request", reason: `this Objective is already assigned to an SEU (${existingSeu.id})` };
  }

  let tenantId = input.tenantId ?? objective.sponsoring_authority?.tenant ?? null;
  if (!tenantId) {
    const { data: defaultTenant } = await tenantsDB.findDefault();
    tenantId = defaultTenant?.id ?? null;
  }
  const viewerTenantId = tenantId ?? (await getPlatformTenantId());

  let seu: SeuRow;
  let correlationId: string;
  let causationId: string | undefined;
  if (reusingExisting) {
    seu = existingSeu!;
    const { data: priorEvents } = await eventsDB.findByOriginatingObject("SEU", seu.id);
    const priorRequested = (priorEvents ?? []).find((e) => e.event_type === "CommissionRequested");
    correlationId = priorRequested?.correlation_id ?? eventBus.newCorrelationId();
    causationId = priorRequested?.id;
  } else {
    const { data: created, error: seuErr } = await seusDB.create({
      objectiveId: objective.id,
      templateId: template.id,
      profileId: profile.id,
      requestedBy: input.requestedBy,
      tenantId,
    });
    if (seuErr || !created) return { ok: false, stage: "allocate_runtime", reason: (seuErr ?? new Error("failed to create SEU")).message };
    seu = created;
    correlationId = eventBus.newCorrelationId();
    const requestedEvent = await eventBus.publish({
      eventType: "CommissionRequested",
      originatingObjectType: "SEU",
      originatingObjectId: seu.id,
      seuId: seu.id,
      correlationId,
      actorId: input.actorId,
      authorityBadge: "seu_commission",
      payload: { seuId: seu.id },
    });
    causationId = requestedEvent.id;
  }

  return { ok: true, seu };
}

export type FinalizeCommissioningResult =
  | { ok: true; seu: SeuRow; report: CommissioningReport }
  | { ok: false; stage: string; reason: string; seuId?: string };

export async function finalizeCommissioning(input: {
  seu: SeuRow;
  ebm: EbmRow;
  templates: TemplateRow[];
  profiles: ProfileRow[];
  tenantId: string | null;
  actorRole: string;
  actorId: string;
  correlationId: string;
  causationId: string;
}): Promise<FinalizeCommissioningResult> {
  const { seu, ebm, templates, profiles, tenantId, correlationId } = input;
  const template = templates[0];
  const profile = profiles[0];
  const composedPacks = ebm.composed_packs;
  const compositionReport = ebm.composition_report;

  let previousStepEvent = { id: input.causationId };
  for (const [from, to] of PRE_ASSETS_STEPS) {
    const step = await transitionEngine.evaluate({ entityType: "SEU", fromState: from, toState: to, actorRole: input.actorRole, actorId: input.actorId, entityId: seu.id, context: {} });
    if (!step.allowed) {
      return { ok: false, stage: `transition_${from}_to_${to}`, reason: describeRejection(step), seuId: seu.id };
    }
    await seusDB.updateLifecycleState(seu.id, to);
    previousStepEvent = await eventBus.publish({
      eventType: step.eventType ?? `SEU${to}`, originatingObjectType: "SEU", originatingObjectId: seu.id, seuId: seu.id, correlationId,
      causationId: previousStepEvent.id, actorId: input.actorId, authorityBadge: step.authorityBadge ?? "system",
    });
  }

  const requiredCapabilitiesById = new Map<string, CapabilityRow>();
  for (const t of templates) {
    const { data: caps } = await templatesDB.getRequiredCapabilities(t.id);
    for (const c of caps ?? []) requiredCapabilitiesById.set(c.id, c);
  }
  const requiredCapabilities = [...requiredCapabilitiesById.values()];
  const systemActor = await resolveSystemActor(seu.id);
  const { authorId: capabilityAuthorId } = await resolveAuthor(seu.id, systemActor.actorId);
  await seuCapabilitiesDB.createMany(seu.id, requiredCapabilities.map((c) => c.id), capabilityAuthorId, systemActor.authorBadge);

  const deliverableLabelByCode = await resolveLabels(tenantId, "deliverable-name");
  const { data: serviceDefinitions } = await serviceDefinitionsDB.findAllVisibleTo(tenantId ?? (await getPlatformTenantId()));
  const producingCapabilityByDeliverableCode = new Map<string, { id: string }>();
  for (const capability of requiredCapabilities ?? []) {
    const def = (serviceDefinitions ?? []).find((d) => d.capability_code === capability.code && d.status === "Active");
    const outputs = (def?.outputs as unknown as string[] | null) ?? [];
    for (const outputCode of outputs) {
      if (!producingCapabilityByDeliverableCode.has(outputCode)) {
        producingCapabilityByDeliverableCode.set(outputCode, { id: capability.id });
      }
    }
  }
  const deliverableCatalogueByCode = new Map<string, TemplateDeliverableSeed>();
  for (const t of templates) {
    for (const seed of t.deliverable_catalogue) deliverableCatalogueByCode.set(seed.code, seed);
  }
  const deliverableAuthorId = capabilityAuthorId;
  const deliverableIdByName = new Map<string, string>();
  for (const seed of deliverableCatalogueByCode.values()) {
    const producingCapability = producingCapabilityByDeliverableCode.get(seed.code);
    const name = deliverableLabelByCode[seed.code] ?? seed.code;
    const { data: deliverable } = await deliverablesDB.create({
      seuId: seu.id,
      name,
      code: seed.code,
      producingCapabilityId: producingCapability?.id ?? null,
      authorId: deliverableAuthorId,
      authorBadge: systemActor.authorBadge,
    });
    if (deliverable) deliverableIdByName.set(name, deliverable.id);
  }

  const report: CommissioningReport = {
    identity: { seuId: seu.id, templateCode: template.code, profileCode: profile.code, templateCodes: templates.map((t) => t.code), profileCodes: profiles.map((p) => p.code), ebmId: ebm.id },
    composition: { packsUsed: composedPacks.map((p) => p.packCode), warnings: compositionReport.warnings, conflicts: compositionReport.conflicts },
    validation: { errors: [] },
    runtime: {
      initialCapabilities: (requiredCapabilities ?? []).map((c) => c.code),
      initialDeliverables: [...deliverableIdByName.keys()],
    },
  };
  await seusDB.setCommissioningReport(seu.id, report);

  const finalStep = await transitionEngine.evaluate({ entityType: "SEU", fromState: "Commissioned", toState: "Activated", actorRole: input.actorRole, actorId: input.actorId, entityId: seu.id, context: {} });
  if (!finalStep.allowed) {
    return { ok: false, stage: "transition_Commissioned_to_Activated", reason: describeRejection(finalStep), seuId: seu.id };
  }
  const { data: activatedSeu, error: activateErr } = await seusDB.updateLifecycleState(seu.id, "Activated");
  if (activateErr || !activatedSeu) {
    return { ok: false, stage: "transition_Commissioned_to_Activated", reason: "failed to persist Activated lifecycle_state", seuId: seu.id };
  }
  await eventBus.publish({
    eventType: finalStep.eventType ?? "SEUActivated", originatingObjectType: "SEU", originatingObjectId: seu.id, seuId: seu.id, correlationId,
    causationId: previousStepEvent.id, actorId: input.actorId, authorityBadge: finalStep.authorityBadge ?? "system",
  });
  return { ok: true, seu: activatedSeu, report };
}

export async function attemptSeuCommenceWork(input: { seuId: string; correlationId: string; causationId: string; actorId: string }): Promise<void> {
  const { data: seu } = await seusDB.findById(input.seuId);
  if (!seu) {
    logger.error(`[executionEngine] attemptSeuCommenceWork: SEU not found: ${input.seuId}`);
    return;
  }
  if (seu.lifecycle_state !== "Activated") return;

  const { data: definition } = await transitionDefinitionsDB.find("SEU", "Activated", "Operational");
  if (!definition) {
    logger.error(`[executionEngine] attemptSeuCommenceWork: no Transition Definition for SEU Activated -> Operational (SEU ${seu.id})`);
    return;
  }
  if (definition.verb) {
    const requiredBadge = `seu_${definition.verb}`;
    const auth = await badgeAuthorityEngine.authorise({ actorId: input.actorId, requiredBadge });
    if (!auth.allowed) {
      logger.info(`[executionEngine] attemptSeuCommenceWork: SEU ${seu.id} not authorised under ${requiredBadge} — leaving Activated`);
      return;
    }
  }

  const commenceWorkPolicy = await policyEngine.evaluate({ entityType: "SEU", seuId: seu.id, fromState: "Activated", toState: "Operational", context: {}, authorId: input.actorId, authorBadge: definition.verb ? `seu_${definition.verb}` : "system" });
  if (commenceWorkPolicy.outcome === "Blocked") {
    await raiseObligationForBlockedTransition({
      seuId: seu.id, relatedObjectType: "SEU", relatedObjectId: seu.id,
      fromState: "Activated", toState: "Operational", policyCode: commenceWorkPolicy.policyCode,
    });
    return;
  }

  if (seu.active_ebm_id) {
    const packObligations = await raiseObligationsForPackDefinitions({
      seuId: seu.id, ebmId: seu.active_ebm_id, relatedObjectType: "SEU", relatedObjectId: seu.id,
      fromState: "Activated", toState: "Operational",
    });
    if (packObligations.obligations.length > 0) return;
  }

  await seusDB.updateLifecycleState(seu.id, "Operational");
  await eventBus.publish({
    eventType: definition.event_type ?? "SEUOperational", originatingObjectType: "SEU", originatingObjectId: seu.id, seuId: seu.id,
    correlationId: input.correlationId, causationId: input.causationId, actorId: input.actorId,
    authorityBadge: definition.verb ? `seu_${definition.verb}` : "system",
  });
}

function describeRejection(outcome: { reason: string } & Record<string, unknown>): string {
  const { reason, ...rest } = outcome;
  const detail = Object.entries(rest)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ");
  return detail ? `${reason} (${detail})` : reason;
}

export type TransitionEbmResult =
  | { ok: true; ebm: EbmRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string }
  | { ok: false; reason: "ebm_retired"; detail: string };

export async function transitionEbm(input: { ebmId: string; targetState: string; actorRole: string; actorId: string }): Promise<TransitionEbmResult> {
  const { data: ebm } = await ebmsDB.findById(input.ebmId);
  if (!ebm) return { ok: false, reason: "not_found" };

  const fromState = ebm.status;
  const gate = await transitionEngine.evaluate({
    entityType: "EBM",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    entityId: ebm.id,
    context: { ebm },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for EBM ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "not_submitted") return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge ${gate.submitBadge})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "policy_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  if (input.targetState === "Validated") {
    const deadReferences = await checkEbmLiveness(ebm);
    if (deadReferences.length > 0) {
      const { data: retired, error: retireErr } = await ebmsDB.updateStatus(ebm.id, "Retired");
      if (retireErr || !retired) throw retireErr ?? new Error("failed to set EBM to Retired");
      if (!input.actorId) throw new Error(`EBM ${ebm.id} retirement has no acting user to record as this Attention Item's author`);
      if (!gate.authorityBadge) throw new Error(`EBM ${ebm.id} retirement has no resolved authority badge to record as this Attention Item's author badge`);
      const retiredCorrelationId = eventBus.newCorrelationId();
      const retiredEvent = await eventBus.publish({
        eventType: "EBMRetired",
        originatingObjectType: "EBM",
        originatingObjectId: ebm.id,
        seuId: ebm.seu_id,
        correlationId: retiredCorrelationId,
        payload: { references: deadReferences },
        actorId: input.actorId,
        authorityBadge: gate.authorityBadge,
      });
      await raiseAttentionItem({
        seuId: ebm.seu_id,
        category: "EBM Retired",
        priority: "High",
        title: `EBM for this SEU was retired — references no longer live`,
        description: deadReferences.join("; "),
        relatedObjectType: "EBM",
        relatedObjectId: ebm.id,
        triggeringEventId: retiredEvent.id,
        actorId: input.actorId,
        authorBadge: gate.authorityBadge,
      });
      return { ok: false, reason: "ebm_retired", detail: `references no longer live: ${deadReferences.join("; ")}` };
    }
  }

  const { data: updated, error } = await ebmsDB.updateStatus(ebm.id, input.targetState as EbmRow["status"]);
  if (error || !updated) throw error ?? new Error("failed to update EBM status");

  const correlationId = eventBus.newCorrelationId();
  await eventBus.publish({
    eventType: gate.eventType ?? "EBMTransitioned",
    originatingObjectType: "EBM",
    originatingObjectId: ebm.id,
    seuId: ebm.seu_id,
    correlationId,
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId,
    authorityBadge: gate.authorityBadge ?? "root",
    versionEvent: gate.versionEvent,
    fromState,
    toState: input.targetState,
  });

  return { ok: true, ebm: updated, appliedTransition: { fromState, toState: input.targetState } };
}

export type CommissionFromFormResult =
  | CommissionResult
  | { ok: false; stage: "select_template"; reason: string };

export async function commissionFromForm(input: {
  statement: string;
  requiredCapabilityCodes: string[];
  actorRole: string;
  actorId: string;
  requestedBy: string;
  tenantId?: string | null;
}): Promise<CommissionFromFormResult> {
  const container = await ensureOneShotContainer(input.requestedBy);

  const { objective } = await createObjective({
    statement: input.statement,
    requiredCapabilityCodes: input.requiredCapabilityCodes,
    parentObjectiveId: container.id,
    requestedBy: input.requestedBy,
    skipParentValidation: true,
  });

  const candidates = await findCandidateTemplates(input.requiredCapabilityCodes, input.tenantId);
  const template = candidates.find((c) => c.satisfies);
  if (!template) {
    return {
      ok: false,
      stage: "select_template",
      reason: `no Template satisfies every required Capability (candidates checked: ${candidates.map((c) => c.code).join(", ") || "none"})`,
    };
  }

  const realProfiles = await listRealProfilesForTemplate(template.id);
  const profile = realProfiles.find((p) => p.environment === "development") ?? realProfiles[0];
  if (!profile) {
    return {
      ok: false,
      stage: "select_template",
      reason: `no real Profile exists yet for Template ${template.code} — a Profile must be authored before commissioning`,
    };
  }

  let tenantId = input.tenantId ?? null;
  if (!tenantId) {
    const { data: defaultTenant } = await tenantsDB.findDefault();
    tenantId = defaultTenant?.id ?? null;
  }

  return commissionSeu({
    objectiveId: objective.id,
    templateIds: [template.id],
    profileIds: [profile.id],
    actorRole: input.actorRole,
    actorId: input.actorId,
    requestedBy: input.requestedBy,
    tenantId,
  });
}

export async function commissionFromExistingObjective(input: {
  objectiveId: string;
  selections: Array<{
    templateId: string;
    profileId?: string;
  }>;
  resolvedParameterOverrides?: Record<string, string>;
  resolvedCompositionConflicts?: Record<string, unknown>;
  actorRole: string;
  actorId: string;
  requestedBy: string;
}): Promise<CommissionResult> {
  const templateIds = [...new Set(input.selections.map((s) => s.templateId))];
  const profileIds: string[] = [];
  for (const s of input.selections) {
    if (!s.profileId) {
      return { ok: false, stage: "select_profile", reason: `no Profile chosen for Template ${s.templateId} — a real Profile must be selected before commissioning` };
    }
    profileIds.push(s.profileId);
  }

  return commissionSeu({
    objectiveId: input.objectiveId,
    templateIds,
    profileIds: [...new Set(profileIds)],
    resolvedParameterOverrides: input.resolvedParameterOverrides,
    resolvedCompositionConflicts: input.resolvedCompositionConflicts,
    actorRole: input.actorRole,
    actorId: input.actorId,
    requestedBy: input.requestedBy,
  });
}

export async function previewCommissioningValidation(input: {
  selections: Array<{ templateId: string; profileId?: string }>;
  resolvedParameterOverrides?: Record<string, string>;
  resolvedCompositionConflicts?: Record<string, unknown>;
  viewerTenantId: string;
}): Promise<{ compositionReport: EbmCompositionReport; composedPacks: EbmComposedPack[]; profileDetails: ProfileDetail[]; unraveled: UnraveledComposition; compositionConflicts: CompositionConflict[] }> {
  const templateIds = [...new Set(input.selections.map((s) => s.templateId))];
  const profileIds = [...new Set(input.selections.map((s) => s.profileId).filter((id): id is string => !!id))];
  const profiles: ProfileRow[] = [];
  for (const profileId of profileIds) {
    const { data: profile } = await profilesDB.findById(profileId);
    if (profile) profiles.push(profile);
  }
  const profileDetails = await Promise.all(profiles.map(extractProfileDetails));

  const unraveled = await unravelComposition({ templateIds, profileIds }, input.viewerTenantId);
  const compositionConflicts = detectCompositionConflicts(unraveled, input.resolvedCompositionConflicts);
  const composedPacks = unraveled.composedPacks;
  const compositionReport: EbmCompositionReport = { warnings: unraveled.warnings, conflicts: [], parameterConflicts: [], resolutions: [] };

  return { compositionReport, composedPacks, profileDetails, unraveled, compositionConflicts };
}

export function applyConflictStrategy(
  conflict: CompositionConflict,
  strategy: string,
  selection: { checkedSourceIds: string[]; baseSourceId?: string }
): { ok: true; value: unknown; note?: string } | { ok: false; error: string } {
  const toSource = (o: CompositionConflictOption): CompositionSource => ({ id: o.source.id, code: o.source.code, fields: { value: o.value } });
  const checked = conflict.options.filter((o) => selection.checkedSourceIds.includes(o.source.id)).map(toSource);
  const baseOption = selection.baseSourceId ? conflict.options.find((o) => o.source.id === selection.baseSourceId) : undefined;

  if (strategy === "merge") {
    const result = compositionEngine.merge(checked);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, value: result.fields.value, note: result.conflicts[0] };
  }
  const isScalar = (v: unknown): boolean => v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
  if ((strategy === "union" || strategy === "intersection") && checked.every((s) => isScalar(s.fields.value))) {
    const req = compositionEngine.strategyRequirements(strategy);
    if (checked.length < req.minSources) return { ok: false, error: `${strategy === "union" ? "Union" : "Intersection"} requires at least ${req.minSources} sources, got ${checked.length}.` };
    const distinct = [...new Set(checked.map((s) => s.fields.value))];
    if (strategy === "union") return { ok: true, value: distinct };
    if (distinct.length === 1) return { ok: true, value: distinct[0] };
    return { ok: true, value: undefined, note: `Intersection: the checked sources don't all agree (${distinct.map((v) => JSON.stringify(v)).join(", ")}), so nothing survived for this field.` };
  }
  if (strategy === "union") {
    const result = compositionEngine.union(checked);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, value: result.fields.value, note: result.conflicts[0] };
  }
  if (strategy === "intersection") {
    const result = compositionEngine.intersection(checked);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, value: result.fields.value, note: "value" in result.fields ? undefined : "Intersection: the sources are not unanimous, so nothing survived for this field." };
  }
  if (strategy === "supplement") {
    if (!baseOption) return { ok: false, error: `Supplement needs a base source — mark one as the base before applying.` };
    const rest = checked.filter((s) => s.id !== baseOption.source.id);
    const result = compositionEngine.supplement(toSource(baseOption), rest);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, value: result.fields.value };
  }
  if (!baseOption) return { ok: false, error: `Choose a source (mark it as the base) before applying "${strategy}".` };
  const result = compositionEngine.specialize(toSource(baseOption));
  return { ok: true, value: result.fields.value };
}
