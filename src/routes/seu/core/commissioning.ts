// Ch.8 commissioning pipeline (Build Plan §4, endpoint #4). Orchestrates the
// generic engine modules against the SEU-shaped tables; contains no
// transition-evaluation or composition logic itself — that stays in
// src/domain/engine/, per Build Plan §2.2's "small core" split.
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
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
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
import { raiseAttentionItem } from "./attentionItems.js";
import { raiseObligationForBlockedTransition } from "./obligations.js";
import { findCandidateTemplates } from "./templates.js";
import { findOrCreateDefaultProfile, extractProfileDetails, getProfilePackSelections, extractExposedParameterOverrides } from "./profiles.js";
import type { ProfileDetail } from "./profiles.js";
import { resolveLabels } from "./ontology.js";
import type { CommissioningReport, SeuLifecycleState, SeuRow, TemplateRow, ProfileRow, ObjectiveRow, CapabilityRow, TemplateDeliverableSeed, EbmCompositionReport, EbmComposedPack, EbmRow } from "../../../dblayer/seuTypes.js";

// commissionSeu itself can no longer produce a full CommissioningReport
// synchronously (design/mvp-build-plan/SEU Composition.md, "Structural
// consequence" — a real, human-in-the-loop manual gate means the pipeline
// can't finish inside one HTTP request). A successful "Validate Request"
// means the SEU row exists and CommissionValidated has been published — not
// that commissioning is complete. finalizeCommissioning (below) produces the
// real CommissioningReport once "Activate" actually happens.
export type CommissionResult =
  | { ok: true; seu: SeuRow }
  | { ok: false; stage: string; reason: string; seuId?: string };

// Owner: "let us stick to the order I gave. Chapter 2 is for something else
// not for definition" — Configured before Commissioned, deliberately not
// Chapter 2's own documented SEU state graph.
//
// CR-107 — Create Engineering Assets moved from after this cascade to before
// its last hop (Commissioned -> Activated), so `finalizeCommissioning` ends
// at the SEUActivated publish with nothing after it (the platform's own
// "no code after an event publish" rule). PRE_ASSETS_STEPS therefore only
// covers the two hops genuinely ahead of asset creation; Commissioned ->
// Activated is applied explicitly, as this function's own last statement.
const PRE_ASSETS_STEPS: Array<[SeuLifecycleState, SeuLifecycleState]> = [
  ["Pending", "Configured"],
  ["Configured", "Commissioned"],
];

// Chapter 8 §9 "Validate Request" — real new logic, not pure event-wrapping
// (design/mvp-build-plan/SEU Composition.md, "Validate Request does need
// real new logic"). A Profile's own status = 'Active' says nothing about
// whether what it references still is — Pack codes, capability-name/service
// Ontology codes can be retired independently, long after the Profile was
// authored, with nothing re-checking it since (assertCanonicalCategory,
// ontology.ts, is write-path only). Owner: "am I working off a current live
// abstraction?" — iterates over exactly what the owner named: template id,
// Pack codes, capability codes, service codes. Extended 2026-09-07 (owner:
// "1. Check the Objective is still active... 2. Check if Profile id is
// active") — this is what validateRequestHandler runs off
// CommissionRequested, so the Objective/Profile's own liveness (not just
// what they reference) is now checked here too, not left implicit.
// Owner: "Show details of what was checked and what passed the check and
// failed the check if it is failed" — every individual check this function
// runs, not just the failures; the Validate page renders the full list.
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

// Chapter 3 §15 "Validate Engineering Model" liveness gate — design/mvp-build-plan/
// SEU Composition.md, 2026-09-07. Owner: "There is a possibility that packs,
// profiles etc could have been retired. So when EBMValidation happens, do a
// checkliveness." Time has passed since this EBM was composed; unlike
// checkRequestLiveness (which re-derives what a Template/Profile *would*
// select), this checks what the EBM actually *did* compose — its own
// composed_packs, template_id, profile_id — since retirement since then
// wouldn't change what a fresh selection derives, only whether what's
// already fixed on this row is still live.
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
  // CR-092 Part 6 (owner: "Multiple profiles are very much possible. That is
  // why composition exists. That is why validation is required") — one or
  // more of each now, not exactly one; templateIds[0]/profileIds[0] is the
  // "primary" recorded on seus.template_id/profile_id and ebms.template_id/
  // profile_id (still NOT NULL single FKs, unchanged — see this CR's own
  // "no schema migration" decision), while the full set is what actually
  // drives composition and is recorded in the Commissioning Report's own
  // identity.templateCodes/profileCodes.
  templateIds: string[];
  profileIds: string[];
  // Structurally dead since the single-Profile reversal (parameterConflicts
  // can only ever fire with 2+ Profiles) — kept only for caller signature
  // compatibility; no longer read anywhere in this function.
  resolvedParameterOverrides?: Record<string, string>;
  // The human's own prior picks from the "Queue to Validate" preview page,
  // carried straight into CommissionValidated's own payload for the EBM
  // Composer to re-run detectCompositionConflicts against — never computed
  // or guessed by this function itself (design/mvp-build-plan/
  // SEU Composition.md, "Whatever we validated is what should go into the SEU").
  resolvedCompositionConflicts?: Record<string, unknown>;
  actorRole: string;
  actorId?: string;
  requestedBy?: number | null;
  // Participant Integration — Plan step 6: which tenant owns this SEU. Defaults
  // to the seeded default tenant; determines which edge configuration its Work
  // Items run against.
  tenantId?: string | null;
}): Promise<CommissionResult> {
  const { data: objective } = await objectivesDB.findById(input.objectiveId);
  if (!objective) return { ok: false, stage: "validate_request", reason: `objective not found: ${input.objectiveId}` };
  if (input.templateIds.length === 0) return { ok: false, stage: "validate_request", reason: "at least one Template is required" };
  if (input.profileIds.length === 0) return { ok: false, stage: "validate_request", reason: "at least one Profile is required" };
  // Bug fix (owner, 2026-09-06: "Let us impose the condition that only one
  // profile can be chosen. Now it is a multi-select") — CR-092 Part 6's own
  // "allow multiple Profiles, surface the conflicts" policy is retired;
  // exactly one Profile per commissioning now, enforced here so every
  // caller (the web picker, commissionFromExistingObjective, any future
  // API caller) is bound by the same rule, not just the form UI.
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
  // Every given Profile must target one of the given Templates — the
  // set-membership generalisation of the old single-Template equality check.
  const templateIdSet = new Set(input.templateIds);
  for (const profile of profiles) {
    if (!templateIdSet.has(profile.base_template_id)) {
      return { ok: false, stage: "validate_request", reason: `profile "${profile.code}" does not target any of the given Templates` };
    }
  }
  const template = templates[0];
  const profile = profiles[0];
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

  // CR-002 (Ch.1 §18.2/§18.8): at most one *active* SEU per Objective.
  // design/mvp-build-plan/SEU Composition.md, 2026-09-07 — "Queue to
  // Validate" now creates the Pending SEU row itself and publishes
  // CommissionRequested there (web/objectives.ts's own validate-commission
  // route); by the time this function runs (the "Commission" click), that
  // row already exists for the normal case. An existing SEU matching this
  // same Template/Profile, still Pending, is expected here and reused — not
  // a second row, not a second CommissionRequested. Anything else (a
  // different Template/Profile, or a SEU already past Pending) is still a
  // real "already assigned" conflict, rejected exactly as before.
  const { data: existingSeu } = await seusDB.findByObjectiveId(objective.id);
  const reusingExisting = !!existingSeu && existingSeu.lifecycle_state === "Pending" && existingSeu.profile_id === profile.id && existingSeu.template_id === template.id;
  if (existingSeu && !reusingExisting) {
    return { ok: false, stage: "validate_request", reason: `this Objective is already assigned to an SEU (${existingSeu.id})` };
  }

  // Ch.2 §7 / Build Plan §5 item 8: 'Pending' is the pre-Commissioned working
  // state this plan adds so the pipeline has a row to attach the EBM and
  // report to before Ch.37's own lifecycle formally begins at 'Commissioned'.
  // Resolve the owning tenant, so the SEU's Work Items dispatch against that
  // tenant's edge configuration. §18.11: "An SEU's Tenant is set from its
  // Objective's Tenant, not chosen separately or defaulted" — an explicit
  // input.tenantId still wins when a caller passes one (commissionFromForm's
  // one-shot path does, deliberately: its Objective is a child of the shared
  // cross-tenant container, ensureOneShotContainer, whose own
  // sponsoring_authority reflects whichever tenant created it first, not this
  // request's actual tenant); everyone else (commissionFromExistingObjective
  // never passed one — the confirmed gap) now derives it from the Objective
  // itself instead of silently falling straight to the default tenant.
  let tenantId = input.tenantId ?? objective.sponsoring_authority?.tenant ?? null;
  if (!tenantId) {
    const { data: defaultTenant } = await tenantsDB.findDefault();
    tenantId = defaultTenant?.id ?? null;
  }
  const viewerTenantId = tenantId ?? PLATFORM_TENANT_ID;

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
    // Ch.30 causation fix — first event in this activity; nothing on the Bus
    // caused it (an HTTP request did), so causationId is deliberately absent.
    // Chapter 8 §18 "CommissionRequested" — was SEUCommissionRequested.
    const requestedEvent = await eventBus.publish({
      eventType: "CommissionRequested",
      originatingObjectType: "SEU",
      originatingObjectId: seu.id,
      seuId: seu.id,
      correlationId,
      actorId: input.actorId ?? null,
      payload: { seuId: seu.id },
    });
    causationId = requestedEvent.id;
  }

  // design/mvp-build-plan/SEU Composition.md, 2026-09-07 — validateRequestHandler
  // (subscribed to CommissionRequested) is now the one real place Validate
  // Request runs (Authority/Policy gate + checkRequestLiveness, both moved
  // there verbatim). commissionSeu used to run this same logic inline, then
  // ALSO publish CommissionRequested — every fresh call ran Validate Request
  // twice, racing (found via a real test run: validateRequestHandler logging
  // "SEU not found: undefined" because this function's own CommissionRequested
  // payload didn't even match {seuId} yet). commissionSeu's job ends at
  // creating the SEU and publishing that event, same contract the web
  // route's own "Queue to Validate" already has — a caller wanting to know
  // whether Validate Request/Compose EBM actually succeeded polls for it
  // (driveCommissioningToActive already does).
  return { ok: true, seu };
}

// commissionSeu's old tail, extracted rather than deleted (design/mvp-build-plan/
// SEU Composition.md, plan step 6): once a human Activates a Validated EBM
// (the SEU detail page's own real "Activate" action, transitionEbm's Active
// branch below), this is what actually finishes commissioning — Pending ->
// Configured -> Commissioned -> Activated (PRE_ASSETS_STEPS), Create
// Engineering Assets (Ch.8 §12), then Activated -> Operational. Called
// synchronously, inside that one real manual request — not off an async
// event subscription (ebmVersioningHandler/seuActivationHandler/
// createEngineeringAssetsHandler, deleted: "Subscription to an event and
// manual trigger of transition definition are 2 different things").
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
  actorId?: string;
  correlationId: string;
  causationId: string;
}): Promise<FinalizeCommissioningResult> {
  const { seu, ebm, templates, profiles, tenantId, correlationId } = input;
  const template = templates[0];
  const profile = profiles[0];
  const composedPacks = ebm.composed_packs;
  const compositionReport = ebm.composition_report;

  // Ch.37 — Pending -> Configured -> Commissioned, in that deliberately
  // reordered sequence (see PRE_ASSETS_STEPS's own comment); Commissioned ->
  // Activated is applied explicitly, below, after Create Engineering Assets.
  // Ungoverned for MVP (no Authority/Policy declared on these rows in the
  // seed data), but still routed through transitionEngine so the mechanism
  // is real, not bypassed for convenience.
  //
  // Version Feature Plan.md §3/§4 (Ch.2, migration 189) — event_type is now
  // read off the resolved Transition Definition instead of the ad hoc
  // `SEU${to}` string this used to build directly; the fallback keeps the
  // exact same name for any future SEU row added without event_type set.
  // No version_event anywhere for SEU (confirmed with the owner): SEU's
  // lifecycle_state is a runtime execution lifecycle, not the definition/
  // authoring one this plan's Revision-vs-Version distinction is about.
  let previousStepEvent = { id: input.causationId };
  for (const [from, to] of PRE_ASSETS_STEPS) {
    const step = await transitionEngine.evaluate({ entityType: "SEU", fromState: from, toState: to, actorRole: input.actorRole, actorId: input.actorId, entityId: seu.id, context: {} });
    if (!step.allowed) {
      return { ok: false, stage: `transition_${from}_to_${to}`, reason: describeRejection(step), seuId: seu.id };
    }
    await seusDB.updateLifecycleState(seu.id, to);
    previousStepEvent = await eventBus.publish({
      eventType: step.eventType ?? `SEU${to}`, originatingObjectType: "SEU", originatingObjectId: seu.id, seuId: seu.id, correlationId,
      causationId: previousStepEvent.id, actorId: input.actorId ?? null, authorityBadge: step.authorityBadge,
    });
  }

  // Ch.8 §12 Create Engineering Assets — required Capabilities + the
  // Template's Deliverable Catalogue, wired into the Dependency Graph.
  // CR-092 Part 6 — unioned across every given Template (dedup by id), not
  // just the primary one, same "compose across everything selected"
  // discipline the Composition Engine itself already applies to Packs.
  const requiredCapabilitiesById = new Map<string, CapabilityRow>();
  for (const t of templates) {
    const { data: caps } = await templatesDB.getRequiredCapabilities(t.id);
    for (const c of caps ?? []) requiredCapabilitiesById.set(c.id, c);
  }
  const requiredCapabilities = [...requiredCapabilitiesById.values()];
  await seuCapabilitiesDB.createMany(seu.id, requiredCapabilities.map((c) => c.id));

  // CR-039/CR-041 — the dependency graph itself is not created here. It's
  // owner-scoped (dependency_definitions, CR-043's polymorphic owner),
  // materialised once when the Template is authored/seeded
  // (materialiseDependencyGraph, called from each of those call sites) — not
  // re-derived per SEU. Commissioning only creates this SEU's own Deliverable
  // instances; the canonical graph they'll be evaluated against already
  // exists independent of this commission ever happening.
  // CR-087 — deliverable_catalogue entries carry a real deliverable-name
  // Ontology CODE now (seed.code), not free-typed display text; resolved to
  // its tenant-aware label here (same resolveLabels materialiseDependencyGraph.ts
  // uses to write dependency_definitions' own to_name/from_name) so
  // deliverables.name — matched against those columns by the gating engine
  // via plain string equality — stays exactly the value the graph expects.
  const deliverableLabelByCode = await resolveLabels(tenantId, "deliverable-name");
  // CR-087 follow-up — producingCapabilityCode is no longer authored on the
  // Deliverable Catalogue at all (owner: "producing capability code does not
  // require an editable field. That can be automatically generated"): which
  // Capability produces a given catalogue entry is derived here instead, off
  // this SEU's own required Capabilities' Active Service Definition outputs
  // (Ch.11) — the same inputs/outputs contract materialiseDependencyGraph.ts
  // already trusts for Capability-type dependency edges. A catalogue entry
  // whose code isn't declared as an output by any required Capability's
  // Service Definition gets no producing Capability — the same, already-
  // supported "no Capability declared" path dispatchEngine.ts takes (dispatched
  // unassigned rather than routed), not an error.
  // ServiceDefinitionRow.outputs is mistyped `string | null` (pre-existing —
  // the column itself is a real Postgres TEXT[], migration 159); cast to the
  // actual runtime shape rather than widen that shared type here.
  const { data: serviceDefinitions } = await serviceDefinitionsDB.findAllVisibleTo(tenantId ?? PLATFORM_TENANT_ID);
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
  // CR-092 Part 6 — unioned across every given Template's own Deliverable
  // Catalogue (dedup by code — the same identity a single Template's own
  // catalogue is already keyed by), not just the primary Template's.
  const deliverableCatalogueByCode = new Map<string, TemplateDeliverableSeed>();
  for (const t of templates) {
    for (const seed of t.deliverable_catalogue) deliverableCatalogueByCode.set(seed.code, seed);
  }
  const deliverableIdByName = new Map<string, string>();
  for (const seed of deliverableCatalogueByCode.values()) {
    const producingCapability = producingCapabilityByDeliverableCode.get(seed.code);
    const name = deliverableLabelByCode[seed.code] ?? seed.code;
    const { data: deliverable } = await deliverablesDB.create({
      seuId: seu.id,
      name,
      producingCapabilityId: producingCapability?.id ?? null,
    });
    if (deliverable) deliverableIdByName.set(name, deliverable.id);
  }

  // CR-107 — the CommissioningReport is recorded here, right after Create
  // Engineering Assets, not after an Activated -> Operational attempt (this
  // function no longer makes one, see below): it describes what
  // commissioning composed and created, independent of whether/when the SEU
  // later reaches Operational — the Execution Engine's own job from here,
  // off the SEUActivated event this function publishes below.
  const report: CommissioningReport = {
    // CR-092 Part 6 — templateCode/profileCode stay the primary (backward
    // compat for anything reading the singular fields); templateCodes/
    // profileCodes record the full set that actually participated, since
    // seus.template_id/profile_id can only ever hold the one primary each.
    identity: { seuId: seu.id, templateCode: template.code, profileCode: profile.code, templateCodes: templates.map((t) => t.code), profileCodes: profiles.map((p) => p.code), ebmId: ebm.id },
    composition: { packsUsed: composedPacks.map((p) => p.packCode), warnings: compositionReport.warnings, conflicts: compositionReport.conflicts },
    validation: { errors: [] },
    runtime: {
      initialCapabilities: (requiredCapabilities ?? []).map((c) => c.code),
      initialDeliverables: [...deliverableIdByName.keys()],
    },
  };
  await seusDB.setCommissioningReport(seu.id, report);

  // Ch.8 §12's own last pre-Activated hop, and this function's own last
  // statement (CR-107 — the platform's own "no code after an event publish"
  // rule: nothing runs here after SEUActivated is published, not even a
  // reload). SEU|Activated|Operational is now trigger: "governed" — the
  // Execution Engine (off SEUActivated, and off ObligationTransitioned for a
  // later retry) owns attempting that hop from here, including the
  // SEU-scoped commence-work Policy CR-104/CR-106 introduced. This function
  // must never attempt Activated -> Operational itself again, or the exact
  // double-invocation risk the platform's own subscriber comments already
  // warn about (ebmActivated.ts) returns.
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
    causationId: previousStepEvent.id, actorId: input.actorId ?? null, authorityBadge: finalStep.authorityBadge,
  });
  return { ok: true, seu: activatedSeu, report };
}

// CR-107 — the Execution Engine's own attempt at the SEU's own
// Activated -> Operational commence-work hop. The single, shared
// implementation for both triggers: the first attempt (off SEUActivated,
// executionEngineKickoff.ts) and every retry after a blocked-on-it
// Obligation resolves (off ObligationTransitioned, same handler file) — no
// separate retry function, replacing the old retrySeuCommenceWork.
// Deliberately NOT a re-run of finalizeCommissioning itself: that function
// creates this SEU's Engineering Assets (Deliverables), which must never be
// recreated on a later attempt.
//
// Stateless per EE-005 (Ch.31): no watch-list of which SEUs are pending —
// every call re-checks this one SEU's live lifecycle_state before doing
// anything, the same self-filter obligationResolvedHandler already used.
// A SEU no longer at "Activated" (already Operational via another path, or
// genuinely failed since) is a no-op, not an error.
export async function attemptSeuCommenceWork(input: { seuId: string; correlationId: string; causationId: string; actorId?: string }): Promise<void> {
  const { data: seu } = await seusDB.findById(input.seuId);
  if (!seu) {
    logger.error(`[executionEngine] attemptSeuCommenceWork: SEU not found: ${input.seuId}`);
    return;
  }
  if (seu.lifecycle_state !== "Activated") return;

  // CR-107 item 10 — Authority/Policy evaluated directly, not through
  // transitionEngine.evaluate's own bundled check: that function doesn't
  // apply state or publish either, so reusing it here would still leave the
  // apply/publish step to write out separately, for no benefit. The
  // Activated -> Operational row itself declares no verb today (no badge
  // required) — this still checks `definition.verb` directly, for the case
  // a future Pack ever attaches one.
  const { data: definition } = await transitionDefinitionsDB.find("SEU", "Activated", "Operational");
  if (!definition) {
    logger.error(`[executionEngine] attemptSeuCommenceWork: no Transition Definition for SEU Activated -> Operational (SEU ${seu.id})`);
    return;
  }
  if (definition.verb) {
    const requiredBadge = `seu_${definition.verb}`;
    const auth = await badgeAuthorityEngine.authorise({ actorId: input.actorId ?? "", requiredBadge });
    if (!auth.allowed) {
      logger.info(`[executionEngine] attemptSeuCommenceWork: SEU ${seu.id} not authorised under ${requiredBadge} — leaving Activated`);
      return;
    }
  }

  // CR-104 — the SEU's own commence-work check: Policies a composed Pack
  // declared on "SEU|Activated|Operational" (a client sign-off, an active
  // contract, ...), materialised onto this EBM's own seu_scoped_policy_ids
  // (compositionCompleted.ts) — never applicable_policy_ids, which is
  // entity-scoped governance for owned Deliverables/AttentionItems/etc, not
  // the SEU's own transition.
  const commenceWorkPolicy = await policyEngine.evaluate({ entityType: "SEU", seuId: seu.id, fromState: "Activated", toState: "Operational", context: {} });
  if (commenceWorkPolicy.outcome === "Blocked") {
    // CR-106 Option C — a Policy not yet satisfied is a legitimate, expected
    // gate (a customer sign-off pending, say), not a genuinely broken
    // commission: raise/reuse the real Obligation + Attention Item (idempotent
    // against an already-open one) and leave the SEU exactly at Activated —
    // never forced into the hard, terminal Failed state a genuinely broken
    // commission uses. Consolidated here (both the first attempt and every
    // retry raise it the same way) rather than split across a caller.
    await raiseObligationForBlockedTransition({
      seuId: seu.id, relatedObjectType: "SEU", relatedObjectId: seu.id,
      fromState: "Activated", toState: "Operational", policyCode: commenceWorkPolicy.policyCode,
    });
    return;
  }

  await seusDB.updateLifecycleState(seu.id, "Operational");
  await eventBus.publish({
    eventType: definition.event_type ?? "SEUOperational", originatingObjectType: "SEU", originatingObjectId: seu.id, seuId: seu.id,
    correlationId: input.correlationId, causationId: input.causationId, actorId: input.actorId ?? null,
  });
}

function describeRejection(outcome: { reason: string } & Record<string, unknown>): string {
  const { reason, ...rest } = outcome;
  const detail = Object.entries(rest)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ");
  return detail ? `${reason} (${detail})` : reason;
}

// Chapter 3 §15 "Validate Engineering Model"/"Activate" (design/mvp-build-plan/
// SEU Composition.md, plan step 6) — the SEU detail page's own EBM transition
// route, identical shape to the existing Deliverable/Obligation/Evidence/
// Knowledge/Decision/External-Interaction ones (transitionObligation is the
// closest precedent: a direct entity transition, no async dispatch). Manual,
// ungoverned by design (owner: "That is how the transitions work today...
// manual and not governed") — same as PRE_ASSETS_STEPS, no Authority Rule
// required, but still routed through transitionEngine for a real, attributed
// record.
export type TransitionEbmResult =
  | { ok: true; ebm: EbmRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string }
  | { ok: false; reason: "ebm_retired"; detail: string };

export async function transitionEbm(input: { ebmId: string; targetState: string; actorRole: string; actorId?: string }): Promise<TransitionEbmResult> {
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

  // Owner: "There is a possibility that packs, profiles etc could have been
  // retired. So when EBMValidation happens, do a checkliveness. If it is
  // all still valid, then EBMValidation is emitted. If not, emit EBMRetired"
  // — time has passed since this EBM was composed; re-check what it
  // actually references, not just re-derive a fresh selection.
  if (input.targetState === "Validated") {
    const deadReferences = await checkEbmLiveness(ebm);
    if (deadReferences.length > 0) {
      const { data: retired, error: retireErr } = await ebmsDB.updateStatus(ebm.id, "Retired");
      if (retireErr || !retired) throw retireErr ?? new Error("failed to set EBM to Retired");
      const retiredCorrelationId = eventBus.newCorrelationId();
      const retiredEvent = await eventBus.publish({
        eventType: "EBMRetired",
        originatingObjectType: "EBM",
        originatingObjectId: ebm.id,
        seuId: ebm.seu_id,
        correlationId: retiredCorrelationId,
        payload: { references: deadReferences },
        actorId: input.actorId ?? null,
      });
      // Owner: "the user has to be notified" — raiseAttentionItem (Ch.34),
      // the same deduplication-aware mechanism other core modules already
      // exist to call, just never had a live caller until now.
      await raiseAttentionItem({
        seuId: ebm.seu_id,
        category: "EBM Retired",
        priority: "High",
        title: `EBM for this SEU was retired — references no longer live`,
        description: deadReferences.join("; "),
        relatedObjectType: "EBM",
        relatedObjectId: ebm.id,
        triggeringEventId: retiredEvent.id,
      });
      return { ok: false, reason: "ebm_retired", detail: `references no longer live: ${deadReferences.join("; ")}` };
    }
  }

  // Owner: "did i not say version is not part of validation" — versioning
  // (a new ebms row) is EBMVersioned's own concern, not EBMValidated's;
  // Validate updates this row's status in place, same as every other
  // transition here. Confirmed the same way at the transition_definitions
  // level (Version Feature Plan.md §3/§4, migration 189): both this hop and
  // Validated -> Active carry a real event_type but no version_event.
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
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });

  // Activate is the one transition with a real consequence beyond the EBM's
  // own status (design/mvp-build-plan/SEU Composition.md — "indirectly the
  // SEU"): historically this function itself went on to call
  // finalizeCommissioning (Create Engineering Assets through
  // PRE_ASSETS_STEPS, commissionSeu's own old tail) right here, inline —
  // code running after the EBMActivated publish above, which the platform's
  // own event-publishing rule forbids. CR-102: that whole cascade now runs
  // in ebmActivatedHandler (domain/engine/ebmActivated.ts), an async
  // subscriber off EBMActivated — this function does not call
  // finalizeCommissioning itself, and never should again (the same
  // double-invocation bug CR-092's own history already found once, for
  // CommissionRequested/validateRequestHandler). Failure past this point is
  // reported via seus.lifecycle_state = "Failed" + CommissionFailed, not a
  // return from this call. Does NOT publish CompositionCompleted — that
  // event means Compose EBM itself finished (owner: "The conflicts if
  // resolved emits Composition completed. composition completes here"),
  // published from ebmComposerHandler/compose-ebm's own conflict-resolution
  // path, both consumed by compositionCompletedHandler to create the ebms
  // row. Superseding a prior Active version (recomposition) is deliberately
  // not handled here — that loop is a later, execution-time concern (owner:
  // "we have not reached there yet"), and this pass never produces a second
  // EBM version for the same SEU to begin with.

  return { ok: true, ebm: updated, appliedTransition: { fromState, toState: input.targetState } };
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
    // The shared container is reused across every tenant, permanently
    // Active, by design (its own comment above) — it can never pass the
    // normal parent-tenant reach check, nor the "parent must be Proposed"
    // edit-scope check (CR-075).
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

  const profile = await findOrCreateDefaultProfile(template.id);

  // Resolved explicitly here, not left to commissionSeu's own fallback: that
  // fallback now derives from the Objective's sponsoring_authority (§18.11)
  // when no tenantId is given, but THIS Objective's sponsoring_authority is
  // inherited from the shared cross-tenant container (ensureOneShotContainer,
  // above) — whichever tenant created it first, not this request's tenant.
  // So an unnamed tenant here must still mean "the seeded default", exactly
  // as before, never the container's borrowed one.
  let tenantId = input.tenantId ?? null;
  if (!tenantId) {
    const { data: defaultTenant } = await tenantsDB.findDefault();
    tenantId = defaultTenant?.id ?? null;
  }

  // CR-092 Part 6 — commissionSeu itself now takes arrays; this one-shot
  // freeform path always resolves exactly one Template/Profile, so it just
  // wraps them. External signature/behaviour of commissionFromForm is
  // otherwise unchanged — ~35 test files call it directly as a fixture
  // helper and none of them need to change for this.
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

// The Objective-first path (Post-MVP Phase 1): commission against an
// Objective that already exists — and is Active — instead of creating one
// inline.
//
// Bug fix (owner, 2026-09-05: "Objectives only propose capabilities. They do
// not take the final call... capability-name -> templates -> profile And
// allow the user to choose a profile. If an additional capability is
// required, profiles have provision for that.") — this used to auto-derive
// the Template itself (findCandidateTemplates + the first full superset
// match), hard-failing whenever no single Template covered every declared
// Capability. That made the Objective's own Capability list a strict gate,
// which the owner says is backwards: it's a proposal the human weighs when
// picking a Template, not a filter this function enforces — and any gap a
// chosen Template leaves is exactly what a Profile's own
// additionalCapabilityCodes (CR-091 §5) exists to cover. templateId is now a
// real, required, human choice (the web route's own capability -> templates
// -> profile tree, fed by getObjectiveDetail's own commissioningOptions,
// core/objectives.ts) — this function no longer computes or second-guesses
// it, so there is no more "select_template" failure stage at all; whatever
// commissionSeu itself would reject (wrong Profile for the Template,
// Objective not eligible, ...) is the only way this can still fail.
// CR-092 Part 6 (owner: "Multiple profiles are very much possible. That is
// why composition exists. That is why validation is required") — one or
// more (Template, Profile) selections now, not exactly one. Each selection
// is its own pair rather than a flat templateIds[]/profileIds[] so a
// per-pair omitted profileId can fall back to findOrCreateDefaultProfile for
// THAT specific Template (the same fallback this function already had for
// the single-selection case) — a flat pair of arrays would lose which
// omitted profileId belonged to which Template.
export async function commissionFromExistingObjective(input: {
  objectiveId: string;
  selections: Array<{
    templateId: string;
    // Real choice, not a heuristic override: findOrCreateDefaultProfile's
    // own comment flagged this as unsolved — this is the caller (the web
    // route's own picker, sourced from getObjectiveDetail's
    // commissioningOptions) closing it, per pair. commissionSeu's own
    // base_template_id set-membership check catches a mismatched pairing,
    // so this doesn't re-validate it belongs to the chosen Template.
    profileId?: string;
  }>;
  // Structurally dead since the single-Profile reversal — kept only for
  // caller signature compatibility. See commissionSeu's own field comment.
  resolvedParameterOverrides?: Record<string, string>;
  // The human's own prior picks from the "Queue to Validate" preview page —
  // forwarded straight through to commissionSeu's own CommissionValidated
  // payload for the EBM Composer. See commissionSeu's own field comment.
  resolvedCompositionConflicts?: Record<string, unknown>;
  actorRole: string;
  actorId?: string;
  requestedBy?: number | null;
}): Promise<CommissionResult> {
  const templateIds = [...new Set(input.selections.map((s) => s.templateId))];
  const profileIds: string[] = [];
  for (const s of input.selections) {
    const profileId = s.profileId ?? (await findOrCreateDefaultProfile(s.templateId)).id;
    profileIds.push(profileId);
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

// CR-092 Part 6 — the "Queue to validate" action's own backend (owner: "has
// to queue to validate. The validation view/form is what should show all
// the conflicting packs / parameters / instructions"). A read-only preview
// of what commissioning this exact selection would compose, run BEFORE any
// SEU row exists — there's nothing to roll back if conflicts are found,
// unlike commissionSeu's own Pending row (already created before its
// equivalent check runs today). Selections with no explicit profileId are
// included for their Template's own mandatory Packs only — a
// not-yet-created default Profile has no optional Packs or
// exposedParameterOverrides to conflict with anything, so there is nothing
// meaningful to preview for it beyond that. Same conflict list
// commissionSeu itself will block on (compositionEngine.compose is the one
// shared implementation, not a parallel check).
export async function previewCommissioningValidation(input: {
  selections: Array<{ templateId: string; profileId?: string }>;
  // CR-092 Part 6 — re-previewing after the human picks a winning value per
  // conflict on the validate page should reflect those picks (so the
  // re-rendered report shows the conflict as resolved), without ever
  // computing a pick itself. Same field shape as commissionSeu's own.
  resolvedParameterOverrides?: Record<string, string>;
  // Same idea, for compositionConflicts below: a key already resolved (the
  // human already picked a composition strategy for it on a prior
  // "Re-validate" round) is honoured and excluded, not re-flagged.
  resolvedCompositionConflicts?: Record<string, unknown>;
  viewerTenantId: string;
}): Promise<{ compositionReport: EbmCompositionReport; composedPacks: EbmComposedPack[]; profileDetails: ProfileDetail[]; unraveled: UnraveledComposition; compositionConflicts: CompositionConflict[] }> {
  const templateIds = [...new Set(input.selections.map((s) => s.templateId))];
  const profileIds = [...new Set(input.selections.map((s) => s.profileId).filter((id): id is string => !!id))];
  // Owner, 2026-09-07: "I want compose() commented out as the very first
  // step" — compositionEngine.compose() must not be called anywhere in this
  // flow (design/mvp-build-plan/SEU Composition.md). composedPacks/warnings
  // now come from unravelComposition's own extended return shape (plan step
  // 5), computed below — not a second, independent computation.
  // const { compositionReport, composedPacks } = await compositionEngine.compose({ templateIds, profileIds, resolvedParameterOverrides: input.resolvedParameterOverrides });
  // CR-092 Part 6 (owner: "On the Validation page, list all the profile
  // details. Not the heading or meta data. ALL THE DETAILS.") — every
  // selected Profile's own full content, surfaced regardless of whether any
  // conflict was found; "no conflicts" was hiding the substance of what's
  // actually being commissioned, not just the disagreements.
  const profiles: ProfileRow[] = [];
  for (const profileId of profileIds) {
    const { data: profile } = await profilesDB.findById(profileId);
    if (profile) profiles.push(profile);
  }
  const profileDetails = await Promise.all(profiles.map(extractProfileDetails));

  // Unravel the full composition and detect real cross-source conflicts
  // against it — a separate feature entirely (owner: "build the conflict
  // detection from scratch as a separate feature"), independent of
  // compositionEngine.compose(); it resolves the Pack set itself, on its own,
  // and never calls into compose()'s own logic. composedPacks/warnings are
  // sourced from here directly now, not from compose().
  const unraveled = await unravelComposition({ templateIds, profileIds }, input.viewerTenantId);
  const compositionConflicts = detectCompositionConflicts(unraveled, input.resolvedCompositionConflicts);
  const composedPacks = unraveled.composedPacks;
  // TODO(ebmComposer): compositionReport.conflicts/parameterConflicts are
  // retired in favour of compositionConflicts above (plan step 7 removes the
  // old alert/section from validate.ejs entirely) — kept as an empty stub
  // only until that view cleanup lands, so the return type stays unchanged
  // in the meantime.
  const compositionReport: EbmCompositionReport = { warnings: unraveled.warnings, conflicts: [], parameterConflicts: [], resolutions: [] };

  return { compositionReport, composedPacks, profileDetails, unraveled, compositionConflicts };
}

// The one piece of existing machinery this whole feature reuses (owner:
// "Only resolution will use the composestrategy mechanism already built for
// packs") — applying a chosen composition strategy to just the disagreeing
// sub-field of one conflict (owner: "for now just the disagreeing
// subfield"), never the whole containing object. Returns the resolved value
// for that one property, to carry forward the same way
// resolvedParameterOverrides already does (re-submitted as a hidden field
// through "Re-validate" until commissioning).
//
// `strategy` is a raw code from the real Ontology `composition-strategy`
// vocabulary (migration 069: override/merge/supplement/union/intersection/
// alias — the same 6 values Pack's own authoring page picks from), not
// compositionEngine.ts's own CompositionStrategyCode type — the two
// vocabularies don't line up 1:1 ("alias" has no dedicated function here,
// "specialization" isn't an Ontology code at all). Only merge/union/
// intersection/supplement have a real, dedicated function; "override"/
// "alias"/anything else falls back to Specialization (an exact copy of one
// chosen source) — the same "falls to override" default
// strategyRequirements() itself already applies to an unrecognised code.
//
// Owner, correcting an earlier version of this function that refused to run
// merge/union/intersection at all here: "that is not for you to decide. If
// the user says union, there is a union." Every strategy the human picks
// actually runs, for real, against the real function — whatever it
// genuinely produces is what's returned, including an empty value when that
// IS the honest answer (union/merge exclude a field neither side agrees on
// from `fields` by their own real design, same as they would for any other
// caller of these functions; that's not a failure to hide, it's the true
// result of running union on values that disagree). `note` carries the
// underlying function's own explanation when the value comes back empty, so
// the human sees why, rather than a bare blank.
//
// Owner, on which sources actually participate: "you dont assume any base.
// i have been repeating this saying user has to choose." No positional
// defaults anywhere here — `selection.checkedSourceIds` (a checkbox per
// option, "include this source") and `selection.baseSourceId` (a radio, "the
// base/chosen source" — supplement's own base, specialize/override/alias's
// one copy-from source) are both explicit human input from the view, never
// inferred from array order. merge/union/intersection use exactly the
// checked set and lean on those functions' own real, existing
// STRATEGY_REQUIREMENTS-based arity check (owner: verified this already
// exists, mirroring composeAuthoringDraft's identical use of
// strategyRequirements() — not re-implemented here, just reached the same
// way) — too few checked sources surfaces as that function's own real error.
// supplement/specialize require the radio explicitly; an HTML radio group
// can only ever yield at most one value, so "too many for specialization"
// is structurally impossible here, not something to separately validate —
// "none chosen" is the one real gap left to check for it.
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
  // Owner: "So what is your suggestion?... I agree with union. intersection
  // of scalars also will take the same route." Union/intersection are pure
  // set operations with a real, self-computable answer even when scalars
  // disagree — unlike merge ("reconciled into one"), which genuinely has
  // none. Matches the platform's own Ontology definition (migration 069):
  // union is "every item... treated as equal peers, nothing dropped" (both
  // disagreeing scalars survive); intersection is "only what both agree on
  // survives" (nothing survives when they don't). compositionEngine.union()/
  // intersection() themselves are left untouched — this is a shape-specific
  // shortcut only for plain scalars, computed directly rather than through
  // combineFields (which is the right tool for combining whole OBJECTS with
  // mostly-agreeing fields, e.g. a Service's own contribution, not two bare
  // disagreeing strings) — objects/arrays still delegate to the real
  // function, which recurses into them correctly.
  const isScalar = (v: unknown): boolean => v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
  if ((strategy === "union" || strategy === "intersection") && checked.every((s) => isScalar(s.fields.value))) {
    // Same real arity check the delegated-to functions themselves would
    // apply (compositionEngine.strategyRequirements) — the scalar shortcut
    // bypasses those functions entirely, so it must not also bypass their
    // own "at least 2 sources" precondition.
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
  // "override"/"alias"/"specialization" (and anything unrecognised) fall back
  // to Specialization's own shape — an exact copy of the human's own chosen
  // (radio-marked) source, matching compositionEngine.strategyRequirements's
  // own "falls to override" default for a strategy code it doesn't
  // otherwise define.
  if (!baseOption) return { ok: false, error: `Choose a source (mark it as the base) before applying "${strategy}".` };
  const result = compositionEngine.specialize(toSource(baseOption));
  return { ok: true, value: result.fields.value };
}
