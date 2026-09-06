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
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { compositionEngine } from "../../../domain/engine/compositionEngine.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { logger } from "../../../utils/logger.js";
import { createObjective, ensureOneShotContainer } from "./objectives.js";
import { findCandidateTemplates } from "./templates.js";
import { findOrCreateDefaultProfile, extractProfileDetails } from "./profiles.js";
import type { ProfileDetail } from "./profiles.js";
import { resolveLabels } from "./ontology.js";
import type { CommissioningReport, SeuLifecycleState, SeuRow, TemplateRow, ProfileRow, CapabilityRow, TemplateDeliverableSeed, EbmCompositionReport, EbmComposedPack } from "../../../dblayer/seuTypes.js";

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
  // CR-092 Part 6 (owner: "the human resolves it by picking which source's
  // value wins, right on the validation page") — a human's own prior picks
  // from the validate view, keyed the same way as
  // ParameterConflict.key ("sourceType::sourceCode::parameterName"). Passed
  // straight through to compositionEngine.compose() so an already-resolved
  // key is excluded from the blocking parameterConflicts check below; never
  // computed or guessed by this function itself.
  resolvedParameterOverrides?: Record<string, string>;
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

  const { data: seu, error: seuErr } = await seusDB.create({
    objectiveId: objective.id,
    templateId: template.id,
    profileId: profile.id,
    requestedBy: input.requestedBy,
    tenantId,
  });
  if (seuErr || !seu) return { ok: false, stage: "allocate_runtime", reason: (seuErr ?? new Error("failed to create SEU")).message };

  const correlationId = eventBus.newCorrelationId();
  // Ch.30 causation fix — first event in this activity; nothing on the Bus
  // caused it (an HTTP request did), so causationId is deliberately absent.
  const requestedEvent = await eventBus.publish({
    eventType: "SEUCommissionRequested",
    originatingObjectType: "SEU",
    originatingObjectId: seu.id,
    seuId: seu.id,
    correlationId,
    payload: { objectiveId: objective.id, templateIds: input.templateIds, profileIds: input.profileIds },
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
      seuId: seu.id,
      correlationId,
      causationId: requestedEvent.id,
      payload: gate,
    });
    return { ok: false, stage: "validate_request", reason: describeRejection(gate), seuId: seu.id };
  }

  // Ch.4 Composition Engine
  const { composedPacks, compositionReport } = await compositionEngine.compose({
    templateIds: input.templateIds,
    profileIds: input.profileIds,
    resolvedParameterOverrides: input.resolvedParameterOverrides,
  });

  // FR-3.6/3.7 & FR-21.7: behavioural/governance conflicts requiring human
  // judgement prevent commissioning until resolved. Detected at composition;
  // the SEU never reaches Operational (it stays the pre-commissioned Pending
  // row, same shape as the Authority rejection above).
  // CR-092 Part 6 — parameterConflicts is a second, independent conflict
  // list (owner: "the human resolves it by picking which source's value
  // wins, right on the validation page"); a key already resolved by the
  // human (input.resolvedParameterOverrides, threaded into compose() above)
  // is excluded there, so anything still present here genuinely was never
  // resolved — this function itself never picks a winner on its own.
  if (compositionReport.conflicts.length > 0 || compositionReport.parameterConflicts.length > 0) {
    const allConflictMessages = [
      ...compositionReport.conflicts,
      ...compositionReport.parameterConflicts.map((c) => `Parameter conflict on "${c.key}": ${c.options.map((o) => `${o.profileCode} sets "${o.value}"`).join(", ")}.`),
    ];
    await eventBus.publish({
      eventType: "SEUCommissionRejected",
      originatingObjectType: "SEU",
      originatingObjectId: seu.id,
      seuId: seu.id,
      correlationId,
      causationId: requestedEvent.id,
      payload: { reason: "composition_conflict", conflicts: allConflictMessages },
    });
    return { ok: false, stage: "compose_ebm", reason: `composition conflicts must be resolved before commissioning: ${allConflictMessages.join(" | ")}`, seuId: seu.id };
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
  let previousStepEvent = await eventBus.publish({
    eventType: "SEUCommissioned", originatingObjectType: "SEU", originatingObjectId: seu.id, seuId: seu.id, correlationId,
    causationId: requestedEvent.id, actorId: input.actorId ?? null, authorityBadge: gate.authorityBadge,
  });

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
    // Ch.30 causation fix — each cascade step is caused by the previous
    // step's own event (SEUCommissioned causes SEUConfigured causes
    // SEUActivated causes SEUOperational), a real chain, not a repeat of
    // correlationId.
    previousStepEvent = await eventBus.publish({
      eventType: `SEU${to}`, originatingObjectType: "SEU", originatingObjectId: seu.id, seuId: seu.id, correlationId,
      causationId: previousStepEvent.id, actorId: input.actorId ?? null, authorityBadge: step.authorityBadge,
    });
  }

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
  // CR-092 Part 6 — the human's own picks from the validate view, forwarded
  // straight through to commissionSeu (which forwards them to
  // compositionEngine.compose()). See commissionSeu's own field comment.
  resolvedParameterOverrides?: Record<string, string>;
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
}): Promise<{ compositionReport: EbmCompositionReport; composedPacks: EbmComposedPack[]; profileDetails: ProfileDetail[] }> {
  const templateIds = [...new Set(input.selections.map((s) => s.templateId))];
  const profileIds = [...new Set(input.selections.map((s) => s.profileId).filter((id): id is string => !!id))];
  const { compositionReport, composedPacks } = await compositionEngine.compose({ templateIds, profileIds, resolvedParameterOverrides: input.resolvedParameterOverrides });
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
  return { compositionReport, composedPacks, profileDetails };
}
