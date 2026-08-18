// SDK authoring — ENTITY-DIRECT (bug fix correcting CR-014).
//
// There is no separate "SDK authoring" mechanism and no Deliverable
// indirection. Authoring a Pack / Template / Profile is just working on a
// **Draft row of that entity itself**, then driving it through the entity's own
// governed `noun × verb` transitions — run by the **real session actor**, with
// the actor + `noun_verb` badge captured on every event (Part 1). No bootstrap
// SEU, no authoring Deliverable/Evidence, no system actor, no double gate.
//
// Authority is the authored entity's own noun × verb (root bypasses):
//   `{kind}_define`  — create/edit/save a Draft (creation authority; a grant,
//                      not a transition — see the "creation authority is not a
//                      transition" note).
//   `{kind}_publish` — publish: the governed transition to Active
//     (Pack: Draft → Validated → Published → Active; Template/Profile: the
//      single governed Draft → Active `publish` transition — they are upsert,
//      not (code,version)-immutable like Pack; real versioning stays deferred
//      per Open Design Questions.md). The authorisation model is identical for
//      all three; only the number of lifecycle states differs, reflecting each
//      entity's existing schema — NOT a special authoring path.
import { packsDB } from "../../../dblayer/packsDB.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import {
  advancePackOneStep, validatePackSeed, packMetadataFromSeed,
  type PackSeedInput,
} from "./packs.js";
import { publishTemplateDraft, validateTemplateSeed, type TemplateSeedInput } from "./templates.js";
import { publishProfileDraft, validateProfileSeed, type ProfileSeedInput } from "./profiles.js";
import type { PackContributions, PackRow, ProfileRow, SchemaDefinitionEntityKind, TemplateRow } from "../../../dblayer/seuTypes.js";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Seed-facing constants (kept for the bootstrap seed + seedSeu; the bootstrap
// Templates they name are now vestigial — entity-direct authoring never
// commissions a bootstrap SEU — but harmless, and left to avoid a seed churn).
// ---------------------------------------------------------------------------
export const AUTHORING_CAPABILITY_CODE: Record<SchemaDefinitionEntityKind, string> = {
  Pack: "pack-authoring",
  Template: "template-authoring",
  Profile: "profile-authoring",
  TransitionDefinition: "transition-definition-authoring",
};

export const AUTHORING_CATEGORY: Record<SchemaDefinitionEntityKind, string> = {
  Pack: "Pack Definition",
  Template: "Template Definition",
  Profile: "Profile Definition",
  TransitionDefinition: "Transition Definition Definition",
};

export const BOOTSTRAP_TEMPLATE_CODE: Record<SchemaDefinitionEntityKind, string> = {
  Pack: "sdk-authoring-pack",
  Template: "sdk-authoring-template",
  Profile: "sdk-authoring-profile",
  TransitionDefinition: "sdk-authoring-transition-definition",
};

export function bootstrapProfileCode(kind: SchemaDefinitionEntityKind): string {
  return `${BOOTSTRAP_TEMPLATE_CODE[kind]}-profile`;
}

// ---------------------------------------------------------------------------
// Content reassembly (unchanged from the previous flattened-form handling).
// ---------------------------------------------------------------------------

// The generated form (and JSON import) can omit contributions/dependencies —
// normalize before handing off to validatePackSeed/publishPack. CR-016:
// contributions are authored as flattened top-level lists (contributionCapabilities[],
// …) — reassemble into the nested `contributions` object.
export function toPackSeedInput(content: Record<string, unknown>): PackSeedInput {
  const legacy = (typeof content.contributions === "object" && content.contributions ? content.contributions : {}) as Record<string, unknown[]>;
  const arr = (flatKey: string, legacyKey: string): unknown[] => {
    const flat = content[flatKey];
    if (Array.isArray(flat) && flat.length) return flat;
    return Array.isArray(legacy[legacyKey]) ? (legacy[legacyKey] as unknown[]) : [];
  };
  const compliance = (typeof content.contributionsCompliance === "object" && content.contributionsCompliance ? content.contributionsCompliance : {}) as Record<string, unknown[]>;
  const contributions = {
    capabilities: arr("contributionCapabilities", "capabilities"),
    services: arr("contributionServices", "services"),
    authorityRules: arr("contributionAuthorityRules", "authorityRules"),
    policies: arr("contributionPolicies", "policies"),
    qualityGates: arr("contributionQualityGates", "qualityGates"),
    checklists: arr("contributionChecklists", "checklists"),
    reviewGates: arr("contributionReviewGates", "reviewGates"),
    obligationDefinitions: arr("contributionObligationDefinitions", "obligationDefinitions"),
    complianceFrameworks: Array.isArray(compliance.complianceFrameworks) ? compliance.complianceFrameworks : (legacy.complianceFrameworks ?? []),
    complianceRequirements: Array.isArray(compliance.complianceRequirements) ? compliance.complianceRequirements : (legacy.complianceRequirements ?? []),
  } as unknown as PackSeedInput["contributions"];
  return {
    ...(content as unknown as PackSeedInput),
    // CR-015: `code` is a system UUID, not an authored field. Reuse one already
    // on the content (an imported doc, or the row's own code); else mint one.
    code: typeof content.code === "string" && content.code.trim() ? (content.code as string) : randomUUID(),
    packVersion: typeof content.packVersion === "string" && content.packVersion.trim() ? (content.packVersion as string) : "0.1.0",
    contributions,
    dependencies: (content.dependencies as PackSeedInput["dependencies"]) ?? [],
  };
}

// Real finding: mandatoryPackCodes/optionalPackCodes use x-widget:"referential-list"
// so the generated form submits [{ packCode }] — normalize to the string[] the
// seed types expect (JSON import already submits plain strings, unaffected).
function normalizePackCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && "packCode" in entry) return String((entry as { packCode: unknown }).packCode ?? "");
      return "";
    })
    .filter((code) => code !== "");
}

export function toTemplateSeedInput(content: Record<string, unknown>): TemplateSeedInput {
  return {
    ...(content as unknown as TemplateSeedInput),
    // Defensive against a non-array value reaching here (e.g. a JSON import —
    // a first-class entry point, not just the generated form) — an object or
    // other truthy non-array would otherwise survive `?? []` and blow up the
    // first `for...of` that iterates it.
    requiredCapabilityCodes: Array.isArray(content.requiredCapabilityCodes) ? (content.requiredCapabilityCodes as string[]) : [],
    mandatoryPackCodes: normalizePackCodes(content.mandatoryPackCodes),
    deliverableCatalogue: Array.isArray(content.deliverableCatalogue) ? (content.deliverableCatalogue as TemplateSeedInput["deliverableCatalogue"]) : [],
  };
}

export function toProfileSeedInput(content: Record<string, unknown>): ProfileSeedInput {
  return {
    ...(content as unknown as ProfileSeedInput),
    configParameters: (content.configParameters as Record<string, unknown>) ?? {},
    optionalPackCodes: normalizePackCodes(content.optionalPackCodes),
  };
}

// Structural + referential validation, per kind.
export async function validateAuthoredContent(kind: SchemaDefinitionEntityKind, content: Record<string, unknown>): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  if (kind === "Pack") return validatePackSeed(toPackSeedInput(content));
  if (kind === "Template") return validateTemplateSeed(toTemplateSeedInput(content));
  if (kind === "Profile") return validateProfileSeed(toProfileSeedInput(content));
  return { ok: false, errors: [`no validator wired for kind "${kind}"`] };
}

// ---------------------------------------------------------------------------
// The Draft row as an authoring document — reconstruct the form-shaped content.
// ---------------------------------------------------------------------------
function packRowToContent(pack: PackRow): Record<string, unknown> {
  const c = (pack.contributions ?? {}) as PackContributions & Record<string, unknown[]>;
  return {
    code: pack.code,
    name: pack.name,
    category: pack.category,
    packVersion: pack.pack_version,
    installationClassification: pack.installation_classification,
    contributionCapabilities: c.capabilities ?? [],
    contributionServices: c.services ?? [],
    contributionAuthorityRules: c.authorityRules ?? [],
    contributionPolicies: c.policies ?? [],
    contributionQualityGates: c.qualityGates ?? [],
    contributionChecklists: (c as Record<string, unknown[]>).checklists ?? [],
    contributionReviewGates: (c as Record<string, unknown[]>).reviewGates ?? [],
    contributionObligationDefinitions: (c as Record<string, unknown[]>).obligationDefinitions ?? [],
    contributionsCompliance: {
      complianceFrameworks: (c as Record<string, unknown[]>).complianceFrameworks ?? [],
      complianceRequirements: (c as Record<string, unknown[]>).complianceRequirements ?? [],
    },
    dependencies: pack.dependencies ?? [],
    ...(pack.metadata ?? {}),
  };
}

export interface AuthoringDraftSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface AuthoringDraft {
  id: string;
  code: string;
  name: string;
  status: string;
  content: Record<string, unknown>;
}

export type AuthoringResult = { ok: true; draftId: string } | { ok: false; errors: string[] };
export type AuthoringActionResult = { ok: true } | { ok: false; errors: string[] };

function toSummary(r: { id: string; code: string; name: string; status: string; created_at: string }): AuthoringDraftSummary {
  return { id: r.id, code: r.code, name: r.name, status: r.status, createdAt: r.created_at };
}

// --- Per-verb authoring lists (the tabs) ------------------------------------
// One tab per verb the entity's noun actually has (however many that is —
// Pack has 7, Template/Profile have 2), each showing what's CURRENTLY sitting
// in the state that verb lands on:
//   - `define` (birth, not a governed transition — see
//     [[creation-authority-not-a-transition]]): Draft rows this actor authored
//     (authored_by).
//   - every other verb: rows currently in that state whose governed transition
//     into it was run by this actor (the real actor + badge Part 1 now
//     captures on every event) — "packs I validated", not just "packs that got
//     validated by someone".
// actorId null = unscoped (the admin/root view — every actor).
// viewer — Pack ownership visibility (owner: "Active packs tab have to be
// shown for all pack_* badges... platform packs + tenant packs corresponding
// to the tenant the user belongs to"): ONLY consulted for Pack's live-catalog
// tab (toState "Active") — every other tab is "rows I acted on", already
// naturally scoped by actorId and unaffected by Pack ownership. null/root =
// unscoped (every tenant's Active Packs, same as before this fix).
export async function listAuthoringByVerb(kind: SchemaDefinitionEntityKind, verb: string, toState: string, actorId: number | null, viewer?: { isRoot: boolean; tenantId: string } | null): Promise<AuthoringDraftSummary[]> {
  const authorityBadge = `${kind.toLowerCase()}_${verb}`;
  if (verb === "define") {
    if (kind === "Pack") {
      const { data } = await packsDB.findDrafts(actorId);
      return (data ?? []).filter((p) => p.status === toState).map(toSummary);
    }
    if (kind === "Template") {
      const { data } = await templatesDB.findDrafts(actorId);
      return (data ?? []).filter((t) => t.status === toState).map(toSummary);
    }
    if (kind === "Profile") {
      const { data } = await profilesDB.findDrafts(actorId);
      return (data ?? []).filter((p) => p.status === toState).map(toSummary);
    }
    return [];
  }
  if (kind === "Pack") {
    const { data } = await packsDB.findByStatusActedBy(toState as PackRow["status"], authorityBadge, actorId);
    const rows = data ?? [];
    if (toState === "Active" && viewer && !viewer.isRoot) {
      return rows.filter((p) => p.tenant_id === PLATFORM_TENANT_ID || p.tenant_id === viewer.tenantId).map(toSummary);
    }
    return rows.map(toSummary);
  }
  if (kind === "Template") {
    const { data } = await templatesDB.findByStatusActedBy(toState as TemplateRow["status"], authorityBadge, actorId);
    return (data ?? []).map(toSummary);
  }
  if (kind === "Profile") {
    const { data } = await profilesDB.findByStatusActedBy(toState as ProfileRow["status"], authorityBadge, actorId);
    return (data ?? []).map(toSummary);
  }
  return [];
}

// --- Per-verb "Queue" tabs (owner: "add a tab to show what is the queue
// applicable to the badge you hold... a tab to show queue that needs
// validation") — every row currently sitting in fromState, full stop, not
// scoped to who (if anyone) already acted — the complement to
// listAuthoringByVerb above, which only ever answers "what did I already do."
// No `define` queue: Draft is birth, not a hop consumed from some prior
// state, so there's nothing to queue there (see [[creation-authority-not-a-
// transition]]). viewer null = unscoped (root — every tenant's queue).
export async function listAuthoringQueue(kind: SchemaDefinitionEntityKind, fromState: string, viewer?: { isRoot: boolean; tenantId: string } | null): Promise<AuthoringDraftSummary[]> {
  if (kind === "Pack") {
    const { data } = await packsDB.findByStatus(fromState as PackRow["status"], viewer && !viewer.isRoot ? viewer.tenantId : null);
    return (data ?? []).map(toSummary);
  }
  // Template/Profile have exactly one non-define verb (publish, Draft ->
  // Active) and no Pack-style tenant ownership — their only possible
  // fromState is "Draft", already unscoped-available via findDrafts(null).
  if (kind === "Template") {
    const { data } = await templatesDB.findDrafts(null);
    return (data ?? []).filter((t) => t.status === fromState).map(toSummary);
  }
  if (kind === "Profile") {
    const { data } = await profilesDB.findDrafts(null);
    return (data ?? []).filter((p) => p.status === fromState).map(toSummary);
  }
  return [];
}

// --- Get one draft (form-shaped content) ------------------------------------
export async function getAuthoringDraft(kind: SchemaDefinitionEntityKind, id: string): Promise<AuthoringDraft | null> {
  if (kind === "Pack") {
    const { data: pack } = await packsDB.findById(id);
    if (!pack) return null;
    return { id: pack.id, code: pack.code, name: pack.name, status: pack.status, content: packRowToContent(pack) };
  }
  if (kind === "Template") {
    const { data: t } = await templatesDB.findById(id);
    if (!t) return null;
    return { id: t.id, code: t.code, name: t.name, status: t.status, content: { code: t.code, name: t.name, ...(t.draft_content ?? {}) } };
  }
  if (kind === "Profile") {
    const { data: p } = await profilesDB.findById(id);
    if (!p) return null;
    return { id: p.id, code: p.code, name: p.name, status: p.status, content: { code: p.code, name: p.name, ...(p.draft_content ?? {}) } };
  }
  return null;
}

// --- Create a Draft from authored content (real author) ---------------------
// tenantId (Pack ownership, owner: "Packs will have ownership") — the real
// author's own tenant_id (Platform tenant for a Platform-type author), read
// off their session by the web route and passed straight through; Template/
// Profile don't have Pack's tenant_id column, so it's ignored for those kinds.
export async function createAuthoringDraft(input: { kind: SchemaDefinitionEntityKind; actorId: string; tenantId?: string; content: Record<string, unknown> }): Promise<AuthoringResult> {
  const authoredBy = Number(input.actorId);
  if (input.kind === "Pack") {
    // A Pack Draft is created directly (status Draft) from the authored content;
    // full structural/referential validation is the publish-time gate, not the
    // draft gate (WIP is allowed to be incomplete). Code is a system UUID.
    const seed = toPackSeedInput(input.content);
    const { data: pack, error } = await packsDB.create({
      code: seed.code,
      name: (seed.name as string) || "(untitled Pack)",
      category: seed.category,
      packVersion: seed.packVersion,
      installationClassification: seed.installationClassification,
      contributions: seed.contributions,
      dependencies: seed.dependencies,
      metadata: packMetadataFromSeed(seed),
      authoredBy,
      tenantId: input.tenantId,
    });
    if (error || !pack) return { ok: false, errors: [(error ?? new Error("failed to create Pack draft")).message] };
    return { ok: true, draftId: pack.id };
  }
  if (input.kind === "Template") {
    const code = (input.content.code as string)?.trim();
    if (!code) return { ok: false, errors: ["a Template code is required to start a draft"] };
    const { data: t, error } = await templatesDB.createDraft({ code, name: (input.content.name as string) || "(untitled Template)", authoredBy, draftContent: input.content });
    if (error || !t) return { ok: false, errors: [(error ?? new Error("failed to create Template draft")).message] };
    return { ok: true, draftId: t.id };
  }
  if (input.kind === "Profile") {
    const code = (input.content.code as string)?.trim();
    if (!code) return { ok: false, errors: ["a Profile code is required to start a draft"] };
    const baseTemplateCode = (input.content.baseTemplateCode as string)?.trim();
    if (!baseTemplateCode) return { ok: false, errors: ["a base Template code is required to start a Profile draft"] };
    const { data: template } = await templatesDB.findByCode(baseTemplateCode);
    if (!template) return { ok: false, errors: [`baseTemplateCode "${baseTemplateCode}" not found`] };
    const { data: p, error } = await profilesDB.createDraft({
      code,
      name: (input.content.name as string) || "(untitled Profile)",
      baseTemplateId: template.id,
      environment: (input.content.environment as string) || "development",
      authoredBy,
      draftContent: input.content,
    });
    if (error || !p) return { ok: false, errors: [(error ?? new Error("failed to create Profile draft")).message] };
    return { ok: true, draftId: p.id };
  }
  return { ok: false, errors: [`kind "${input.kind}" is not authorable`] };
}

// --- Save (update a Draft's content) ----------------------------------------
export async function saveAuthoringDraft(input: { kind: SchemaDefinitionEntityKind; id: string; content: Record<string, unknown> }): Promise<AuthoringActionResult> {
  if (input.kind === "Pack") {
    const seed = toPackSeedInput({ ...input.content });
    const { data, error } = await packsDB.updateDraftContent(input.id, {
      name: (seed.name as string) || "(untitled Pack)",
      category: seed.category,
      packVersion: seed.packVersion,
      installationClassification: seed.installationClassification,
      contributions: seed.contributions,
      dependencies: seed.dependencies,
      metadata: packMetadataFromSeed(seed),
    });
    if (error) return { ok: false, errors: [error.message] };
    if (!data) return { ok: false, errors: ["draft not found or no longer editable (only Draft rows can be saved)"] };
    return { ok: true };
  }
  if (input.kind === "Template") {
    const { data, error } = await templatesDB.updateDraftContent(input.id, { name: (input.content.name as string) || "(untitled Template)", draftContent: input.content });
    if (error) return { ok: false, errors: [error.message] };
    if (!data) return { ok: false, errors: ["draft not found or no longer editable"] };
    return { ok: true };
  }
  if (input.kind === "Profile") {
    const baseTemplateCode = (input.content.baseTemplateCode as string)?.trim();
    if (!baseTemplateCode) return { ok: false, errors: ["a base Template code is required"] };
    const { data: template } = await templatesDB.findByCode(baseTemplateCode);
    if (!template) return { ok: false, errors: [`baseTemplateCode "${baseTemplateCode}" not found`] };
    const { data, error } = await profilesDB.updateDraftContent(input.id, {
      name: (input.content.name as string) || "(untitled Profile)",
      baseTemplateId: template.id,
      environment: (input.content.environment as string) || "development",
      configParameters: (input.content.configParameters as Record<string, unknown>) ?? {},
      draftContent: input.content,
    });
    if (error) return { ok: false, errors: [error.message] };
    if (!data) return { ok: false, errors: ["draft not found or no longer editable"] };
    return { ok: true };
  }
  return { ok: false, errors: [`kind "${input.kind}" is not authorable`] };
}

export type AdvanceAuthoringDraftResult = { ok: true; status: string } | { ok: false; errors: string[] };

// --- Advance one governed hop (real actor + badge for THAT hop only) --------
// Owner: separation of duties — the seeded pack-validate@/pack-publish@/
// pack-activate@ Athens accounts each hold exactly ONE Pack lifecycle verb, so
// "publish" can't chain the whole remaining pipeline (that would require one
// actor to hold every remaining verb, and a single-verb holder could never
// perform their own step). This runs exactly the NEXT hop off the draft's
// current status — for Pack that's Draft->Validated->Published->Active one at
// a time (see advancePackOneStep); Template/Profile only ever have the one hop
// (Draft -> Active, verb `publish`), so they're unchanged. Returns the status
// reached so the caller knows whether to stay on the draft (more hops left) or
// treat it as done (reached the live state).
export async function publishAuthoringDraft(input: { kind: SchemaDefinitionEntityKind; id: string; actorId: string; actorRole: string }): Promise<AdvanceAuthoringDraftResult> {
  if (input.kind === "Pack") {
    const { data: pack } = await packsDB.findById(input.id);
    if (!pack) return { ok: false, errors: ["Pack draft not found"] };
    // Full structural/referential validation gates the FIRST hop out of Draft
    // — an incomplete document must never leave Draft. Later hops trust that
    // gate already ran (the authored content doesn't change between hops).
    if (pack.status === "Draft") {
      const seed = toPackSeedInput(packRowToContent(pack));
      const validation = await validatePackSeed(seed);
      if (!validation.ok) return { ok: false, errors: validation.errors };
    }
    const advanced = await advancePackOneStep(pack, input.actorRole, input.actorId);
    if (!advanced.ok || !advanced.pack) return { ok: false, errors: advanced.errors ?? ["advance failed"] };
    return { ok: true, status: advanced.pack.status };
  }
  if (input.kind === "Template") {
    const { data: t } = await templatesDB.findById(input.id);
    if (!t) return { ok: false, errors: ["Template draft not found"] };
    const seed = toTemplateSeedInput({ code: t.code, name: t.name, ...(t.draft_content ?? {}) });
    const result = await publishTemplateDraft({ templateId: t.id, seed, actorRole: input.actorRole, actorId: input.actorId });
    return result.ok ? { ok: true, status: "Active" } : { ok: false, errors: result.errors };
  }
  if (input.kind === "Profile") {
    const { data: p } = await profilesDB.findById(input.id);
    if (!p) return { ok: false, errors: ["Profile draft not found"] };
    const seed = toProfileSeedInput({ code: p.code, name: p.name, ...(p.draft_content ?? {}) });
    const result = await publishProfileDraft({ profileId: p.id, seed, actorRole: input.actorRole, actorId: input.actorId });
    return result.ok ? { ok: true, status: "Active" } : { ok: false, errors: result.errors };
  }
  return { ok: false, errors: [`kind "${input.kind}" is not authorable`] };
}
