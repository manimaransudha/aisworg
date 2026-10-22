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
import { transitionEntity, publishTransition, type TransitionEntityResult } from "../../../domain/engine/entityTransition.js";
import { raiseObligationForBlockedTransition, raiseObligationsForPackDefinitions } from "./obligations.js";
import { findCandidateTemplates } from "./templates.js";
import { extractProfileDetails, getProfilePackCodes, extractExposedParameterOverrides, listRealProfilesForTemplate } from "./profiles.js";
import type { ProfileDetail } from "./profiles.js";
import { resolveLabels } from "./ontology.js";
import type { CommissioningReport, SeuLifecycleState, SeuRow, TemplateRow, ProfileRow, ObjectiveRow, CapabilityRow, TemplateDeliverableSeed, EbmCompositionReport, EbmComposedPack, EbmRow } from "../../../dblayer/seuTypes.js";
import { EBM_RETIRED_STATE, EBM_VALIDATED_STATE, SEU_ACTIVATED_STATE, SEU_COMMISSIONED_STATE, SEU_CONFIGURED_STATE, SEU_FAILED_STATE, SEU_INITIATED_STATE, SEU_OPERATIONAL_STATE, SEU_VALIDATED_STATE, getPlatformTenantId, getSystemActor, ensureSeuSystemParticipant } from "../../../dblayer/constants.js";
import { SeuLivenessError } from "../../../actions/validateSeuRequest.js";
 
export type CommissionResult =
  | { ok: true; seu: SeuRow }
  | { ok: false; stage: string; reason: string; seuId?: string };

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
  for (const code of await getProfilePackCodes(input.profile.id)) packCodes.add(code);
  const { data: activePacks } = await packsDB.findActiveByCodes([...packCodes]);
  const activePackByCode = new Map((activePacks ?? []).map((p) => [p.code, p]));
  for (const code of packCodes) {
    const pack = activePackByCode.get(code);
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

export type InitiateSeuResult = { ok: true; seu: SeuRow } | { ok: false; reason: string };

// The Save button of the commission form (CR-128): the birth of an SEU, `None -> Initiated`. It checks that an Objective and a
// Profile were chosen, creates the row in the birth row's state and publishes the birth event as its last statement.
export async function initiateSeu(input: { objectiveId?: string | null; profileId?: string | null; actorId: string; tenantId?: string | null }): Promise<InitiateSeuResult> {
  if (!input.objectiveId) return { ok: false, reason: "Choose an Objective to commission against." };
  if (!input.profileId) return { ok: false, reason: "Choose a Profile to commission against." };
  const { data: objective } = await objectivesDB.findById(input.objectiveId);
  if (!objective) return { ok: false, reason: `objective not found: ${input.objectiveId}` };
  const { data: profile } = await profilesDB.findById(input.profileId);
  if (!profile) return { ok: false, reason: `profile not found: ${input.profileId}` };
  const { data: template } = await templatesDB.findById(profile.base_template_id);
  if (!template) return { ok: false, reason: `template not found: ${profile.base_template_id}` };
  if (objective.status !== "Active") {
    return { ok: false, reason: `objective is not Active (status: ${objective.status}) — activate it before commissioning against it` };
  }
  if (objective.tier === "Strategic") {
    return { ok: false, reason: `a Strategic Objective is a programme umbrella and cannot have an SEU (decompose it into Operational/Engineering objectives)` };
  }
  const { data: children } = await objectivesDB.findChildren(objective.id);
  if ((children ?? []).length > 0) {
    return { ok: false, reason: `objective has been decomposed further — commission an SEU against its leaf objectives, not this parent` };
  }
  const { data: existingSeu } = await seusDB.findByObjectiveId(objective.id);
  if (existingSeu) {
    const reusingExisting = existingSeu.lifecycle_state === SEU_INITIATED_STATE && existingSeu.profile_id === profile.id && existingSeu.template_id === template.id;
    if (reusingExisting) return { ok: true, seu: existingSeu };
    return { ok: false, reason: `this Objective is already assigned to an SEU (${existingSeu.id})` };
  }

  let tenantId = input.tenantId ?? objective.sponsoring_authority?.tenant ?? null;
  if (!tenantId) {
    const { data: defaultTenant } = await tenantsDB.findDefault();
    tenantId = defaultTenant?.id ?? null;
  }
  const birth = await transitionEngine.beginBirth({ entityType: "SEU", actorId: input.actorId });
  const { data: seu, error } = await seusDB.create({
    objectiveId: objective.id,
    templateId: template.id,
    profileId: profile.id,
    requestedBy: input.actorId,
    authorBadge: birth.authorityBadge,
    lifecycleState: birth.initialState as SeuLifecycleState,
    tenantId,
  });
  if (error || !seu) return { ok: false, reason: (error ?? new Error("failed to create SEU")).message };
  await eventBus.publish({
    eventType: birth.eventType,
    versionEvent: birth.versionEvent,
    originatingObjectType: "SEU",
    originatingObjectId: seu.id,
    seuId: seu.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { seuId: seu.id },
    actorId: input.actorId,
    authorityBadge: birth.authorityBadge,
  });
  return { ok: true, seu };
}

// The correlation and cause of an SEU's commissioning: the birth event, when it exists.
async function commissioningChain(seuId: string): Promise<{ correlationId: string; causationId: string | null }> {
  const { data: events } = await eventsDB.findByOriginatingObject("SEU", seuId);
  const initiated = (events ?? []).find((e) => e.event_type === "CommissionInitiated");
  return { correlationId: initiated?.correlation_id ?? eventBus.newCorrelationId(), causationId: initiated?.id ?? null };
}

// Moves an SEU to Failed through the governed row of its current state and publishes CommissionFailed (CR-128).
export async function failSeu(input: {
  seuId: string;
  actorId: string;
  stage: string;
  reason: string;
  references?: string[];
  checks?: LivenessCheck[];
  correlationId?: string;
  causationId?: string | null;
}): Promise<void> {
  const failed = await transitionEntity({ entityType: "SEU", entityId: input.seuId, targetState: SEU_FAILED_STATE, actorId: input.actorId, seuId: input.seuId });
  if (!failed.ok) throw new Error(`cannot move SEU ${input.seuId} to ${SEU_FAILED_STATE}: ${"detail" in failed ? failed.detail : failed.reason}`);
  const chain = input.correlationId ? { correlationId: input.correlationId, causationId: input.causationId } : await commissioningChain(input.seuId);
  await publishTransition(failed, {
    payload: { stage: input.stage, reason: input.reason, references: input.references, checks: input.checks },
    correlationId: chain.correlationId,
    causationId: chain.causationId,
  });
}

export type ValidateSeuResult =
  | { ok: true; seu: SeuRow }
  | { ok: false; reason: "commission_failed"; detail: string }
  | Exclude<TransitionEntityResult, { ok: true }>;

// The Validate button (CR-128): the hop Initiated -> Validated. Its action code checks that every reference is live. A dead
// reference rolls the hop back and takes the governed Failed row instead, and CommissionFailed is published.
export async function validateSeu(input: { seuId: string; actorId: string }): Promise<ValidateSeuResult> {
  const livenessChecks: LivenessCheck[] = [];
  const chain = await commissioningChain(input.seuId);
  try {
    const validated = await transitionEntity({ entityType: "SEU", entityId: input.seuId, targetState: SEU_VALIDATED_STATE, actorId: input.actorId, seuId: input.seuId, context: { livenessChecks } });
    if (!validated.ok) return validated;
    const seu = validated.row as SeuRow;
    await publishTransition(validated, {
      payload: { objectiveId: seu.objective_id, templateIds: [seu.template_id], profileIds: [seu.profile_id], viewerTenantId: seu.tenant_id ?? (await getPlatformTenantId()), checks: livenessChecks },
      ...chain,
    });
    return { ok: true, seu };
  } catch (err) {
    if (!(err instanceof SeuLivenessError)) throw err;
    await failSeu({ seuId: input.seuId, actorId: input.actorId, stage: "validate_request", reason: "stale_reference", references: err.references, checks: err.checks, ...chain });
    return { ok: false, reason: "commission_failed", detail: err.message };
  }
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
  actorId: string;
  correlationId: string;
  causationId: string;
}): Promise<FinalizeCommissioningResult> {
  const { seu, ebm, templates, profiles, tenantId, correlationId } = input;
  const template = templates[0];
  const profile = profiles[0];
  const composedPacks = ebm.composed_packs;
  const compositionReport = ebm.composition_report;

  const requiredCapabilitiesById = new Map<string, CapabilityRow>();
  for (const t of templates) {
    const { data: caps } = await templatesDB.getRequiredCapabilities(t.id);
    for (const c of caps ?? []) requiredCapabilitiesById.set(c.id, c);
  }
  const requiredCapabilities = [...requiredCapabilitiesById.values()];
  await ensureSeuSystemParticipant(seu.id);
  const systemActor = await getSystemActor(seu.id);
  await seuCapabilitiesDB.createMany(seu.id, requiredCapabilities.map((c) => c.id), systemActor.authorId, systemActor.authorBadge);

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
  const deliverableAuthorId = systemActor.authorId;
  // The starting state of a Deliverable is the to-state of its birth row. Commissioning creates the Deliverables as the SEU's system participant, as before.
  const { data: deliverableBirth } = await transitionDefinitionsDB.findBirth("Deliverable");
  if (!deliverableBirth) throw new Error("no birth Transition Definition for Deliverable");
  const deliverableIdByName = new Map<string, string>();
  for (const seed of deliverableCatalogueByCode.values()) {
    const producingCapability = producingCapabilityByDeliverableCode.get(seed.code);
    const name = deliverableLabelByCode[seed.code] ?? seed.code;
    const { data: deliverable } = await deliverablesDB.create({
      seuId: seu.id,
      name,
      code: seed.code,
      producingCapabilityId: producingCapability?.id ?? null,
      state: deliverableBirth.to_state,
      authorId: deliverableAuthorId,
      authorBadge: systemActor.authorBadge,
    });
    if (deliverable) deliverableIdByName.set(name, deliverable.id);
  }

  let previousStepEvent: { id: string } = { id: input.causationId };
  for (const to of [SEU_CONFIGURED_STATE, SEU_COMMISSIONED_STATE]) {
    const step = await transitionEntity({ entityType: "SEU", entityId: seu.id, targetState: to, actorId: input.actorId, seuId: seu.id });
    if (!step.ok) return { ok: false, stage: `transition_to_${to}`, reason: "detail" in step ? step.detail : step.reason, seuId: seu.id };
    previousStepEvent = await publishTransition(step, { correlationId, causationId: previousStepEvent.id });
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

  const finalStep = await transitionEntity({ entityType: "SEU", entityId: seu.id, targetState: SEU_ACTIVATED_STATE, actorId: input.actorId, seuId: seu.id });
  if (!finalStep.ok) return { ok: false, stage: `transition_to_${SEU_ACTIVATED_STATE}`, reason: "detail" in finalStep ? finalStep.detail : finalStep.reason, seuId: seu.id };
  await publishTransition(finalStep, { correlationId, causationId: previousStepEvent.id });
  return { ok: true, seu: finalStep.row as SeuRow, report };
}

export async function attemptSeuCommenceWork(input: { seuId: string; correlationId: string; causationId: string; actorId: string }): Promise<void> {
  const { data: seu } = await seusDB.findById(input.seuId);
  if (!seu) {
    logger.error(`[executionEngine] attemptSeuCommenceWork: SEU not found: ${input.seuId}`);
    return;
  }
  if (seu.lifecycle_state !== SEU_ACTIVATED_STATE) return;

  // The SEU-scoped Policies the EBM composed are resolved by the policy engine from the SEU; the transition row's own
  // Policies are checked again by transitionEntity below.
  const { data: definition } = await transitionDefinitionsDB.find("SEU", SEU_ACTIVATED_STATE, SEU_OPERATIONAL_STATE);
  if (!definition) {
    logger.error(`[executionEngine] attemptSeuCommenceWork: no Transition Definition for SEU ${SEU_ACTIVATED_STATE} -> ${SEU_OPERATIONAL_STATE} (SEU ${seu.id})`);
    return;
  }
  const commenceBadge = definition.verb ? await badgeAuthorityEngine.resolveAuthorBadge(input.actorId, `seu_${definition.verb}`) : "system";
  const commenceWorkPolicy = await policyEngine.evaluate({ entityType: "SEU", seuId: seu.id, fromState: SEU_ACTIVATED_STATE, toState: SEU_OPERATIONAL_STATE, context: {}, authorId: input.actorId, authorBadge: commenceBadge });
  if (commenceWorkPolicy.outcome === "Blocked") {
    await raiseObligationForBlockedTransition({
      seuId: seu.id, relatedObjectType: "SEU", relatedObjectId: seu.id,
      fromState: SEU_ACTIVATED_STATE, toState: SEU_OPERATIONAL_STATE, policyCode: commenceWorkPolicy.policyCode,
    });
    return;
  }

  if (seu.active_ebm_id) {
    const packObligations = await raiseObligationsForPackDefinitions({
      seuId: seu.id, ebmId: seu.active_ebm_id, relatedObjectType: "SEU", relatedObjectId: seu.id,
      fromState: SEU_ACTIVATED_STATE, toState: SEU_OPERATIONAL_STATE,
    });
    if (packObligations.obligations.length > 0) return;
  }

  const commence = await transitionEntity({ entityType: "SEU", entityId: seu.id, targetState: SEU_OPERATIONAL_STATE, actorId: input.actorId, seuId: seu.id });
  if (!commence.ok) {
    if (commence.reason === "policy_blocked" && commence.policyCode) {
      await raiseObligationForBlockedTransition({
        seuId: seu.id, relatedObjectType: "SEU", relatedObjectId: seu.id,
        fromState: SEU_ACTIVATED_STATE, toState: SEU_OPERATIONAL_STATE, policyCode: commence.policyCode,
      });
      return;
    }
    logger.error(`[executionEngine] attemptSeuCommenceWork: ${commence.reason} for SEU ${seu.id}`);
    return;
  }
  await publishTransition(commence, { correlationId: input.correlationId, causationId: input.causationId });
}

export type ValidateEbmResult =
  | { ok: true; ebm: EbmRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "ebm_retired"; detail: string }
  | Exclude<TransitionEntityResult, { ok: true }>;

// Validate attempt on a Composed EBM (CR-128). A dead reference takes the governed Composed -> Retired row instead; its action
// raises the Attention Item in the same transaction as the state write.
export async function validateEbm(input: { ebmId: string; actorId: string }): Promise<ValidateEbmResult> {
  const { data: ebm } = await ebmsDB.findById(input.ebmId);
  if (!ebm) return { ok: false, reason: "not_found" };

  const deadReferences = await checkEbmLiveness(ebm);
  if (deadReferences.length > 0) {
    const retired = await transitionEntity({ entityType: "EBM", entityId: ebm.id, targetState: EBM_RETIRED_STATE, actorId: input.actorId, seuId: ebm.seu_id, context: { deadReferences } });
    if (!retired.ok) return retired;
    await publishTransition(retired);
    return { ok: false, reason: "ebm_retired", detail: `references no longer live: ${deadReferences.join("; ")}` };
  }
  const validated = await transitionEntity({ entityType: "EBM", entityId: ebm.id, targetState: EBM_VALIDATED_STATE, actorId: input.actorId, seuId: ebm.seu_id });
  if (!validated.ok) return validated;
  await publishTransition(validated);
  return { ok: true, ebm: validated.row as EbmRow, appliedTransition: validated.appliedTransition };
}

export type CommissionFromFormResult =
  | CommissionResult
  | { ok: false; stage: "select_template"; reason: string };

export async function commissionFromForm(input: {
  statement: string;
  requiredCapabilityCodes: string[];
  actorId: string;
  requestedBy: string;
  tenantId?: string | null;
}): Promise<CommissionFromFormResult> {
  const container = await ensureOneShotContainer(input.requestedBy);

  const { objective: created } = await createObjective({
    statement: input.statement,
    requiredCapabilityCodes: input.requiredCapabilityCodes,
    parentObjectiveId: container.id,
    requestedBy: input.requestedBy,
    skipParentValidation: true,
  });
  const activated = await transitionEntity({ entityType: "Objective", entityId: created.id, targetState: "Active", actorId: input.requestedBy });
  if (!activated.ok) throw new Error(`commissionFromForm: ${"detail" in activated ? activated.detail : activated.reason}`);
  await publishTransition(activated);
  const objective = activated.row as ObjectiveRow;

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

  const initiated = await initiateSeu({ objectiveId: objective.id, profileId: profile.id, actorId: input.actorId, tenantId });
  if (!initiated.ok) return { ok: false, stage: "initiate_seu", reason: initiated.reason };
  const validated = await validateSeu({ seuId: initiated.seu.id, actorId: input.actorId });
  if (!validated.ok) return { ok: false, stage: "validate_request", reason: "detail" in validated ? validated.detail : validated.reason, seuId: initiated.seu.id };
  return { ok: true, seu: validated.seu };
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
