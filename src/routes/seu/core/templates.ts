import { templatesDB } from "../../../dblayer/templatesDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import type { TemplateDeliverableSeed, TemplateRow } from "../../../dblayer/seuTypes.js";

export interface TemplateCandidate {
  id: string;
  code: string;
  name: string;
  satisfies: boolean;
  missingCapabilities: string[];
  requiredCapabilityCount: number;
}

// Ch.6 §11 — a Template is a candidate only if it supports every Capability
// the Objective requires (its required-Capability set is a superset of the
// requested codes) — a Template offering more than requested is a valid,
// intentional match, not a mismatch.
//
// Bug fix: with only one Template ever seeded, the first satisfying
// candidate was always the only correct one, so picking .find(c =>
// c.satisfies) off an alphabetically-ordered list never mattered. Once a
// second, legitimately-satisfying Template existed (one requiring more
// Capabilities than asked for), alphabetical order could pick the loosest
// match over the tightest one. The superset filter above is correct and
// unchanged — the fix is choosing among multiple satisfying candidates by
// ascending required-Capability count (tightest fit first), not by code.
//
// Bug fix (owner, 2026-08-19 — traced via a reproducible full-suite failure):
// this used to call templatesDB.findAllActive(), unscoped by tenant. CR-026's
// own Template Inheritance model lets a tenant author a Derived Template that
// keeps its parent's exact code (Ch.6 §20.4/§20.14) — while such a Derived
// Template is briefly Active (e.g. a test walking a same-required-capabilities
// clone through its lifecycle), it satisfied this same superset check for
// ANY caller, not just the tenant that owns it — handing a completely
// unrelated caller a candidate that's actually another tenant's private
// Template. Scoped to Platform + the caller's own tenant now
// (templatesDB.findActiveVisibleTo), matching the visibility model already
// established for Packs/Templates elsewhere (Ch.7 §19.7). No viewerTenantId
// given (root/system context, no real caller tenant) narrows to Platform only
// — never "see every tenant's Templates," which findAllActive's own removal
// makes structurally unreachable from here now.
export async function findCandidateTemplates(capabilityCodes: string[], viewerTenantId?: string | null): Promise<TemplateCandidate[]> {
  const { data: templates, error } = await templatesDB.findActiveVisibleTo(viewerTenantId ?? PLATFORM_TENANT_ID);
  if (error) throw error;

  const candidates: TemplateCandidate[] = [];
  for (const template of templates ?? []) {
    const { data: required } = await templatesDB.getRequiredCapabilities(template.id);
    const templateCodes = new Set((required ?? []).map((c) => c.code));
    const missingCapabilities = capabilityCodes.filter((code) => !templateCodes.has(code));
    candidates.push({
      id: template.id,
      code: template.code,
      name: template.name,
      satisfies: missingCapabilities.length === 0,
      missingCapabilities,
      requiredCapabilityCount: templateCodes.size,
    });
  }
  return candidates.sort((a, b) => a.requiredCapabilityCount - b.requiredCapabilityCount);
}

// SDK UI Layer Plan — the SDK's own "structural + referential" check for
// Template, same reasoning as validatePackSeed (core/packs.ts). Ch.6
// grounding: requiredCapabilityCodes/mandatoryPackCodes/deliverableCatalogue
// are the grammar implemented now (see the plan's Template section).
export interface TemplateSeedInput {
  code: string;
  name: string;
  // CR-024 — versioning/immutability, mirroring Pack (Ch.41 VM-002) exactly.
  templateVersion: string;
  requiredCapabilityCodes: string[];
  mandatoryPackCodes: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
  // CR-026 — Template ownership, mirroring PackSeedInput.tenantId. Optional:
  // seed scripts/the CLI publishing with no human author default to Platform
  // (templatesDB.upsert's own default); interactive authoring always sets it
  // from the real author's own tenant.
  tenantId?: string;
  // CR-026 — Template Inheritance (Ch.6 §9/§20.4). Set only when this
  // Template was started via the "Inherit" control; a Derived Template's
  // mandatoryPackCodes must remain a superset of its parent's (validated
  // below) and its code is locked to the parent's own (enforced at Draft
  // creation — core/sdkAuthoring.ts — not re-checked on every save, since
  // code becomes read-only once a parent is chosen).
  parentTemplateId?: string | null;
}

export type TemplateValidationResult = { ok: true } | { ok: false; errors: string[] };

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export async function validateTemplateSeed(seed: TemplateSeedInput): Promise<TemplateValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!seed.name?.trim()) errors.push("name is required");
  if (!SEMVER_RE.test(seed.templateVersion ?? "")) errors.push(`templateVersion must be semver (x.y.z), got: "${seed.templateVersion}"`);

  for (const code of seed.requiredCapabilityCodes ?? []) {
    const { data } = await capabilitiesDB.findByCodes([code]);
    if (!data?.[0]) errors.push(`requiredCapabilityCodes references unknown Capability "${code}"`);
  }
  for (const code of seed.mandatoryPackCodes ?? []) {
    const { data } = await packsDB.findByCode(code);
    if (!data) errors.push(`mandatoryPackCodes references unknown Pack code "${code}"`);
  }

  const seenDeliverableCodes = new Set<string>();
  for (const entry of seed.deliverableCatalogue ?? []) {
    if (!entry.code?.trim()) errors.push("deliverableCatalogue entry is missing a code");
    if (!entry.name?.trim()) errors.push(`deliverableCatalogue entry "${entry.code}" is missing a name`);
    if (!entry.category?.trim()) errors.push(`deliverableCatalogue entry "${entry.code}" is missing a category`);
    if (entry.producingCapabilityCode && !(seed.requiredCapabilityCodes ?? []).includes(entry.producingCapabilityCode)) {
      errors.push(`deliverableCatalogue entry "${entry.code}" producingCapabilityCode "${entry.producingCapabilityCode}" is not in requiredCapabilityCodes`);
    }
    // Referential check the schema itself can't express (SDK UI Layer Plan):
    // dependsOnDeliverableCodes must reference an entry earlier in this same
    // catalogue, checked live, not as a grammar constraint.
    for (const dep of entry.dependsOnDeliverableCodes ?? []) {
      if (!seenDeliverableCodes.has(dep)) {
        errors.push(`deliverableCatalogue entry "${entry.code}" dependsOnDeliverableCodes references "${dep}", which must appear earlier in the catalogue`);
      }
    }
    if (entry.code) seenDeliverableCodes.add(entry.code);
  }

  // CR-026 Template Inheritance (Ch.6 §9, owner: "All mandatory packs in the
  // parent template have to remain mandatory in the inherited one also"): a
  // Derived Template's identity is locked to its parent's code (enforced at
  // Draft creation, not re-litigated here) and its mandatoryPackCodes must
  // stay a superset of the parent's CURRENT mandatory set — checked live, not
  // frozen at inheritance time, so a parent that later adds a mandatory Pack
  // still binds its existing children.
  if (seed.parentTemplateId) {
    const { data: parent } = await templatesDB.findById(seed.parentTemplateId);
    if (!parent) {
      errors.push(`parentTemplateId "${seed.parentTemplateId}" not found`);
    } else {
      if (seed.code !== parent.code) {
        errors.push(`an inherited Template must keep its parent's code ("${parent.code}") — Derived Templates shall not modify parent Templates (Ch.6 §9)`);
      }
      const { data: parentMandatory } = await templatesDB.getMandatoryPackCodes(parent.id);
      const missing = (parentMandatory ?? []).filter((code) => !(seed.mandatoryPackCodes ?? []).includes(code));
      if (missing.length > 0) {
        errors.push(`an inherited Template must keep all of its parent's mandatory Packs — missing: ${missing.join(", ")}`);
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export type PublishTemplateResult = { ok: true; templateId: string } | { ok: false; errors: string[] };

// CR-024 — now immutably versioned the way Pack is (Ch.41 VM-002):
// templates.upsert's ON CONFLICT target is (code, template_version), so a
// second call with the same code but a different templateVersion creates a
// new row rather than overwriting. (No real caller today — every seed
// script calls templatesDB.upsert directly, not this function — but this is
// the intended "publish a Template the proper way" entry point, kept correct.)
export async function publishTemplate(seed: TemplateSeedInput): Promise<PublishTemplateResult> {
  const validation = await validateTemplateSeed(seed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const { data: template, error } = await templatesDB.upsert({ code: seed.code, name: seed.name, templateVersion: seed.templateVersion, deliverableCatalogue: seed.deliverableCatalogue, tenantId: seed.tenantId });
  if (error || !template) return { ok: false, errors: [(error ?? new Error("failed to upsert template")).message] };

  const capabilityIds: string[] = [];
  for (const code of seed.requiredCapabilityCodes ?? []) {
    const { data } = await capabilitiesDB.findByCodes([code]);
    if (data?.[0]) capabilityIds.push(data[0].id);
  }
  await templatesDB.setRequiredCapabilities(template.id, capabilityIds);
  await templatesDB.setMandatoryPacks(template.id, seed.mandatoryPackCodes ?? []);

  // CR-025 — real named events (Ch.6 §16), mirroring PackRegistered
  // (core/packs.ts's createPackDraft) exactly, including the same asymmetry:
  // this fires from the "proper" publish entry point, not from interactive
  // authoring's createAuthoringDraft (core/sdkAuthoring.ts) — Pack's own
  // PackRegistered doesn't fire from there either.
  await eventBus.publish({
    eventType: "TemplateCreated",
    originatingObjectType: "Template",
    originatingObjectId: template.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { code: template.code, templateVersion: template.template_version },
  });

  return { ok: true, templateId: template.id };
}

// Entity-direct authoring (bug fix correcting CR-014): a governed status
// transition on a Template, authorised on its own noun × verb (Draft -> Active
// is verb `publish` → template_publish) under the REAL actor, with the actor +
// badge captured on the event. Mirrors transitionPack — no Deliverable
// indirection, no system actor.
export type TransitionTemplateResult = { ok: true; template: TemplateRow } | { ok: false; reason: string; detail?: string };

// Ch.41 VM-002 "Versions are immutable" (CR-024, mirroring transitionPack
// exactly) — reactivating a Deprecated/Retired/Archived Template back to
// Active must never resurrect the old row in place; that would mutate a
// published Version after the fact. A terminal-state row transitioning to
// Active instead publishes a brand new Version carrying the same content,
// auto-bumping the patch number until an unused (code, template_version) is
// found, then walks it through Draft -> Validated -> Published -> Active —
// which also supersedes whatever else is currently Active for this code, the
// same as any other activation. The old row itself is untouched and stays at
// its old status forever.
const TERMINAL_REACTIVATABLE_STATES = new Set(["Deprecated", "Retired", "Archived"]);

// CR-025 (Ch.6 §16, owner: "20.10 Events... Fix this. Similar to what is on
// pack") — real per-state-named events instead of one generic
// "TemplateTransitioned" for every hop, mirroring Pack's own
// EVENT_BY_TARGET_STATE (core/packs.ts) exactly. §16's own text names six
// events and omits "TemplateArchived" — the same omission Pack's chapter
// doesn't have (Ch.5 §16 lists all seven, PackRegistered included) — treated
// as an oversight, not a deliberate difference, so Archived is included here
// for real parity with Pack rather than followed literally.
const EVENT_BY_TARGET_STATE: Record<string, string> = {
  Validated: "TemplateValidated",
  Published: "TemplatePublished",
  Active: "TemplateActivated",
  Deprecated: "TemplateDeprecated",
  Retired: "TemplateRetired",
  Archived: "TemplateArchived",
};

export async function transitionTemplate(input: { templateId: string; targetState: TemplateRow["status"]; actorRole: string; actorId?: string }): Promise<TransitionTemplateResult> {
  const { data: template } = await templatesDB.findById(input.templateId);
  if (!template) return { ok: false, reason: "not_found" };
  const fromState = template.status;
  const gate = await transitionEngine.evaluate({ entityType: "Template", fromState, toState: input.targetState, actorRole: input.actorRole, actorId: input.actorId, context: { template } });
  if (!gate.allowed) {
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Template ${fromState} -> ${input.targetState}` };
    if (gate.reason === "policy_blocked") return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
    return { ok: false, reason: gate.reason };
  }

  if (input.targetState === "Active" && TERMINAL_REACTIVATABLE_STATES.has(fromState)) {
    return reactivateAsNewVersion(template, input.actorRole, input.actorId);
  }

  const { data: updated, error } = await templatesDB.updateStatus(template.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update template status");
  await eventBus.publish({
    eventType: EVENT_BY_TARGET_STATE[input.targetState] ?? "TemplateTransitioned",
    originatingObjectType: "Template",
    originatingObjectId: template.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: template.code },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });
  return { ok: true, template: updated };
}

// CR-026: scoped to the reactivating Template's own tenant — a bumped
// version only needs to dodge THIS tenant's own existing rows (mirrors
// core/packs.ts's nextAvailablePatchVersion exactly).
async function nextAvailablePatchVersion(code: string, fromVersion: string, tenantId: string): Promise<string> {
  const [major, minor, startingPatch] = fromVersion.split(".").map(Number);
  let patch = startingPatch ?? 0;
  for (let attempts = 0; attempts < 1000; attempts++) {
    patch += 1;
    const candidate = `${major}.${minor}.${patch}`;
    const { data: existing } = await templatesDB.findByCodeAndVersion(code, candidate, tenantId);
    if (!existing) return candidate;
  }
  throw new Error(`could not find an unused version for Template ${code} after bumping from ${fromVersion}`);
}

// Clones an existing (terminal) Template row's full authored content into a
// brand-new Draft at the next available patch version, then drives it
// straight through Draft -> Validated -> Published -> Active under the same
// actor — mirroring reactivateAsNewVersion in core/packs.ts exactly. `purpose`
// (CR-023) lives only in draft_content, not a real column, so it's carried
// through explicitly rather than via templatesDB.getRequiredCapabilities-style
// column reads.
async function reactivateAsNewVersion(template: TemplateRow, actorRole: string, actorId: string | undefined): Promise<TransitionTemplateResult> {
  const nextVersion = await nextAvailablePatchVersion(template.code, template.template_version, template.tenant_id);
  const { data: requiredCaps } = await templatesDB.getRequiredCapabilities(template.id);
  const { data: mandatoryPackCodes } = await templatesDB.getMandatoryPackCodes(template.id);
  const seed: TemplateSeedInput = {
    code: template.code,
    name: template.name,
    templateVersion: nextVersion,
    requiredCapabilityCodes: (requiredCaps ?? []).map((c) => c.code),
    mandatoryPackCodes: mandatoryPackCodes ?? [],
    deliverableCatalogue: template.deliverable_catalogue,
    // Reactivation is versioning, not a change of ownership or lineage — the
    // new Version stays owned by the same tenant and keeps the same parent
    // (or lack of one), mirroring reactivateAsNewVersion in core/packs.ts's
    // own tenantId treatment exactly.
    tenantId: template.tenant_id,
    parentTemplateId: template.parent_template_id,
  };
  const purpose = typeof (template.draft_content as Record<string, unknown> | null)?.purpose === "string" ? (template.draft_content as Record<string, unknown>).purpose : undefined;

  const { data: newDraft, error } = await templatesDB.createDraft({
    code: seed.code,
    name: seed.name,
    templateVersion: nextVersion,
    authoredBy: template.authored_by,
    draftContent: { ...seed, purpose },
    tenantId: template.tenant_id,
    parentTemplateId: template.parent_template_id,
  });
  if (error || !newDraft) return { ok: false, reason: "policy_blocked", detail: (error ?? new Error("failed to create new Template version")).message };

  await materialiseTemplateDraft(newDraft.id, seed);

  let current = newDraft;
  for (const targetState of ["Validated", "Published", "Active"] as const) {
    const result = await transitionTemplate({ templateId: current.id, targetState, actorRole, actorId });
    if (!result.ok) return result;
    current = result.template;
  }

  const { data: previousActive } = await templatesDB.findActiveByCode(template.code, template.tenant_id);
  if (previousActive && previousActive.id !== current.id) {
    await transitionTemplate({ templateId: previousActive.id, targetState: "Deprecated", actorRole, actorId });
  }

  return { ok: true, template: current };
}

// Registry "Copy" action (owner, 2026-08-19: "Add a Copy button... enabled
// for users that have *_define badge. It should create a copy and bump up
// the version"). Same content reconstruction as reactivateAsNewVersion above,
// but stops at Draft instead of driving straight through to Active — a real,
// editable starting point, not an instant republish. Unlike reactivation
// (which only ever fires on a terminal row being brought back), Copy works
// from ANY status including Active itself, so it deliberately does not
// require the source to be terminal. No new lineage — parentTemplateId
// carries through unchanged from the source (a copy of a Derived Template is
// still Derived from the same parent; a copy is not itself a new Inheritance
// edge).
export async function copyTemplateAsNewDraft(templateId: string, actorId: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await templatesDB.findById(templateId);
  if (!source) return { ok: false, errors: ["Template not found"] };
  const nextVersion = await nextAvailablePatchVersion(source.code, source.template_version, source.tenant_id);
  const { data: requiredCaps } = await templatesDB.getRequiredCapabilities(source.id);
  const { data: mandatoryPackCodes } = await templatesDB.getMandatoryPackCodes(source.id);
  const purpose = typeof (source.draft_content as Record<string, unknown> | null)?.purpose === "string" ? (source.draft_content as Record<string, unknown>).purpose : undefined;
  const draftContent = {
    code: source.code,
    name: source.name,
    purpose,
    requiredCapabilityCodes: (requiredCaps ?? []).map((c) => c.code),
    mandatoryPackCodes: (mandatoryPackCodes ?? []).map((packCode) => ({ packCode })),
    deliverableCatalogue: source.deliverable_catalogue,
  };
  const { data: newDraft, error } = await templatesDB.createDraft({
    code: source.code,
    name: source.name,
    templateVersion: nextVersion,
    authoredBy: Number(actorId),
    draftContent,
    tenantId: source.tenant_id,
    parentTemplateId: source.parent_template_id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Template")).message] };
  return { ok: true, draftId: newDraft.id };
}

// Entity-direct authoring, one hop at a time (mirrors advancePackOneStep,
// Ch.5 §19.13 / Ch.6 §20.2) — added 2026-08-18 alongside the seed change that
// gave Template the same six-hop lifecycle Pack already has
// (transitionDefinitions.json / authorityVocabulary.json: Draft -> Validated
// -> Published -> Active -> Deprecated -> Retired -> Archived). Runs exactly
// the NEXT governed hop off the entity's current status, authorised on only
// that hop's own badge — real separation of duties, not a blanket "publish."
// Replaces the old publishTemplateDraft, which hardcoded a direct jump to
// "Active" — the only target state that existed before this seed change.
const AUTHORING_NEXT_STATE: Partial<Record<TemplateRow["status"], TemplateRow["status"]>> = {
  Draft: "Validated",
  Validated: "Published",
  Published: "Active",
  Active: "Deprecated",
  Deprecated: "Retired",
  Retired: "Archived",
};

export async function advanceTemplateOneStep(template: TemplateRow, actorRole: string, actorId: string | undefined): Promise<TransitionTemplateResult> {
  const targetState = AUTHORING_NEXT_STATE[template.status];
  if (!targetState) return { ok: false, reason: "no_further_step", detail: `Template is already ${template.status} — no further authoring step` };

  // CR-024, mirroring advancePackOneStep exactly: Published -> Active also
  // supersedes whatever else is currently Active for this code (Active ->
  // Deprecated on the previous holder), now that a code can have more than
  // one version.
  if (targetState === "Active") {
    const { data: previousActive } = await templatesDB.findActiveByCode(template.code, template.tenant_id);
    const activateResult = await transitionTemplate({ templateId: template.id, targetState: "Active", actorRole, actorId });
    if (!activateResult.ok) return activateResult;
    if (previousActive && previousActive.id !== activateResult.template.id) {
      await transitionTemplate({ templateId: previousActive.id, targetState: "Deprecated", actorRole, actorId });
    }
    return activateResult;
  }

  return transitionTemplate({ templateId: template.id, targetState, actorRole, actorId });
}

// Materialise a Draft's authored seed onto the entity's real columns/join
// tables. Was previously bundled inside a one-shot "jump straight to Active";
// now runs once, gating the FIRST governed hop out of Draft only —
// advanceTemplateOneStep above handles every hop after that, trusting the
// content is already real (same discipline Pack's own Draft-only validation
// gate uses — core/sdkAuthoring.ts's publishAuthoringDraft calls both).
export async function materialiseTemplateDraft(templateId: string, seed: TemplateSeedInput): Promise<void> {
  const capabilityIds: string[] = [];
  for (const code of seed.requiredCapabilityCodes ?? []) {
    const { data } = await capabilitiesDB.findByCodes([code]);
    if (data?.[0]) capabilityIds.push(data[0].id);
  }
  await templatesDB.setDeliverableCatalogue(templateId, seed.deliverableCatalogue ?? []);
  await templatesDB.setRequiredCapabilities(templateId, capabilityIds);
  await templatesDB.setMandatoryPacks(templateId, seed.mandatoryPackCodes ?? []);
}

export interface TemplateWithNextStates {
  template: TemplateRow;
  possibleNextStates: string[];
}

// Template Registry (owner, 2026-08-19: "Build the template and profile
// registry") — every Version of every Template, with its own governed next
// states, mirroring listPacksWithNextStates (core/packs.ts) exactly. This is
// also the UI trigger CR-024 flagged as missing for Template reactivation
// (Ch.6 §20.3's own "no UI trigger... a Template Registry page... is the
// natural follow-up") — the same generic transition form Pack's Registry
// already has covers it here too, no special-casing needed.
export async function listTemplatesWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<TemplateWithNextStates[]> {
  const { data: templates } = viewer && !viewer.isRoot ? await templatesDB.findAllVisibleTo(viewer.tenantId) : await templatesDB.findAll();
  return Promise.all(
    (templates ?? []).map(async (template) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Template", template.status);
      return { template, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
