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
//   `{kind}_publish` — publish: the governed transition to Active. All three
//     kinds now share the exact same seven-state lifecycle and the same
//     (code, version, tenant) immutable-version identity (Pack: migration
//     010/044/063; Template: CR-024/CR-026; Profile: 2026-08-19, mirroring
//     both). The authorisation model is identical for all three — NOT a
//     special authoring path.
import { packsDB } from "../../../dblayer/packsDB.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import {
  advancePackOneStep, validatePackSeed, packMetadataFromSeed,
  type PackSeedInput,
} from "./packs.js";
import { advanceTemplateOneStep, materialiseTemplateDraft, validateTemplateSeed, getPackSelectionsByCategory, getDependencyGraphContent, PACK_SELECTION_SLOTS, type TemplateSeedInput, type PackSelectionsByCategory } from "./templates.js";
import { advanceProfileOneStep, materialiseProfileDraft, validateProfileSeed, getProfilePackSelections, type ProfileSeedInput } from "./profiles.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import type { PackContributions, PackRow, ProfileRow, SchemaDefinitionEntityKind, TemplateRow } from "../../../dblayer/seuTypes.js";
import { randomUUID } from "node:crypto";

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
// Generalised (owner, 2026-08-19) for Profile's featureFlagCodes, whose item
// field is `featureCode`, not `packCode` — same shape, different key.
function normalizeReferentialCodes(raw: unknown, itemFieldName: string): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && itemFieldName in entry) return String((entry as Record<string, unknown>)[itemFieldName] ?? "");
      return "";
    })
    .filter((code) => code !== "");
}
function normalizePackCodes(raw: unknown): string[] {
  return normalizeReferentialCodes(raw, "packCode");
}
function normalizeFeatureFlagCodes(raw: unknown): string[] {
  return normalizeReferentialCodes(raw, "featureCode");
}

// Owner: "Why is code not auto generated? There is a Name field that can be
// entered by user more descriptively" — CR-015's own deferred question
// ("Template/Profile codes are out of scope here (decide separately)").
// *Stale as of CR-021, corrected here rather than silently*: `code` is no
// longer a system UUID — it's a required Ontology-backed dropdown
// (template-categories, Ch.18), same treatment Pack's own `code` got in
// CR-020 Part 2. The randomUUID() fallback below stays only as a defensive
// default for a JSON import/CLI path that omits it entirely — never what the
// interactive form submits.
export function toTemplateSeedInput(content: Record<string, unknown>): TemplateSeedInput {
  return {
    ...(content as unknown as TemplateSeedInput),
    code: typeof content.code === "string" && content.code.trim() ? (content.code as string) : randomUUID(),
    // CR-024 — same fallback shape as toPackSeedInput's packVersion.
    templateVersion: typeof content.templateVersion === "string" && content.templateVersion.trim() ? (content.templateVersion as string) : "0.1.0",
    // Defensive against a non-array value reaching here (e.g. a JSON import —
    // a first-class entry point, not just the generated form) — an object or
    // other truthy non-array would otherwise survive `?? []` and blow up the
    // first `for...of` that iterates it.
    // CR-038 — requiredCapabilityCodes/mandatoryPackCodes are gone; six
    // category-scoped Pack fields replace the flat one (same
    // normalizePackCodes row-unwrapping every other referential-list Pack
    // field already uses).
    compliancePackCodes: normalizePackCodes(content.compliancePackCodes),
    domainPackCodes: normalizePackCodes(content.domainPackCodes),
    engineeringPackCodes: normalizePackCodes(content.engineeringPackCodes),
    integrationPackCodes: normalizePackCodes(content.integrationPackCodes),
    organisationPackCodes: normalizePackCodes(content.organisationPackCodes),
    technologyPackCodes: normalizePackCodes(content.technologyPackCodes),
    deliverableCatalogue: Array.isArray(content.deliverableCatalogue) ? (content.deliverableCatalogue as TemplateSeedInput["deliverableCatalogue"]) : [],
    // CR-041 — the dependency graph, authored as its own field (not embedded
    // per deliverableCatalogue entry).
    dependencyGraph: Array.isArray(content.dependencyGraph) ? (content.dependencyGraph as TemplateSeedInput["dependencyGraph"]) : [],
  };
}

// Owner, 2026-08-19: "19.2 and 19.3 has to be fixed similar to pack and
// template" + "all missing fields have to be fixed at schema level" — Profile
// gets the same code/version fallback shape toTemplateSeedInput already has,
// plus normalisation for every new referential-list field §7 added
// (featureFlagCodes keyed by featureCode; the four category-scoped Pack
// lists keyed by packCode, same as optionalPackCodes always was).
export function toProfileSeedInput(content: Record<string, unknown>): ProfileSeedInput {
  return {
    ...(content as unknown as ProfileSeedInput),
    code: typeof content.code === "string" && content.code.trim() ? (content.code as string) : randomUUID(),
    profileVersion: typeof content.profileVersion === "string" && content.profileVersion.trim() ? (content.profileVersion as string) : "0.1.0",
    category: typeof content.category === "string" ? content.category : "",
    configParameters: (content.configParameters as Record<string, unknown>) ?? {},
    compositionOptions: (content.compositionOptions as Record<string, unknown>) ?? {},
    optionalPackCodes: normalizePackCodes(content.optionalPackCodes),
    technologyPackCodes: normalizePackCodes(content.technologyPackCodes),
    domainPackCodes: normalizePackCodes(content.domainPackCodes),
    compliancePackCodes: normalizePackCodes(content.compliancePackCodes),
    integrationPackCodes: normalizePackCodes(content.integrationPackCodes),
    featureFlagCodes: normalizeFeatureFlagCodes(content.featureFlagCodes),
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
    // CR-022: without this, re-validating at publish time (below) would
    // default to Platform-only Ontology visibility regardless of the Pack's
    // real owning tenant, since toPackSeedInput has no other source for it.
    tenantId: pack.tenant_id,
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

// --- Authoring tabs ----------------------------------------------------------
// Redesign (owner, 2026-08-20): "The vertical tabs should show the ones on my
// verb queue. Eg. Packs that I defined irrespective of whatever status it is
// in, packs that are in validate etc. Tabs like All Validated packs are not
// required as they are available in the Pack registry." Retires the old
// per-verb "what did I already do" tabs (All/User {Verb}ed {kind}s, Active
// {kind}s, each a toState-scoped listAuthoringByVerb call) — the now-
// filterable Registry (CR-036) shows exactly that. Two kinds of tab remain:
//   - "I defined" (listMyAuthoredRows below) — every row this actor authored,
//     any status, not just Draft.
//   - a Queue per verb this actor holds the badge for (listAuthoringQueue) —
//     unchanged from before.

// "I defined" tab — every row THIS actor authored, at whatever status it's
// currently sitting at. Always scoped to the real actor, even for root — "I
// defined" is inherently personal, unlike the old live-catalog tab's own
// root-sees-everyone treatment. findDrafts is deliberately NOT reused here —
// it's hardcoded to WHERE status IN ('Draft', 'Validated') (this actor's
// current WIP), not "every status." findAll (root/admin's own "see
// everything" listing, already existed for each of these three) filtered
// client-side to this actor's own authored_by is the real "any status"
// query — small per-actor row counts in practice, same tradeoff the Registry
// pages' own in-memory pagination already makes.
export async function listMyAuthoredRows(kind: SchemaDefinitionEntityKind, actorId: number): Promise<AuthoringDraftSummary[]> {
  if (kind === "Pack") {
    const { data } = await packsDB.findAll();
    return (data ?? []).filter((p) => p.authored_by === actorId).map(toSummary);
  }
  if (kind === "Template") {
    const { data } = await templatesDB.findAll();
    return (data ?? []).filter((t) => t.authored_by === actorId).map(toSummary);
  }
  if (kind === "Profile") {
    const { data } = await profilesDB.findAll();
    return (data ?? []).filter((p) => p.authored_by === actorId).map(toSummary);
  }
  return [];
}

// --- Per-verb "Queue" tabs (owner: "add a tab to show what is the queue
// applicable to the badge you hold... a tab to show queue that needs
// validation") — every row currently sitting in fromState, full stop, not
// scoped to who (if anyone) already acted.
// No `define` queue: Draft is birth, not a hop consumed from some prior
// state, so there's nothing to queue there (see [[creation-authority-not-a-
// transition]]). viewer null = unscoped (root — every tenant's queue).
export async function listAuthoringQueue(kind: SchemaDefinitionEntityKind, fromState: string, viewer?: { isRoot: boolean; tenantId: string } | null): Promise<AuthoringDraftSummary[]> {
  if (kind === "Pack") {
    const { data } = await packsDB.findByStatus(fromState as PackRow["status"], viewer && !viewer.isRoot ? viewer.tenantId : null);
    return (data ?? []).map(toSummary);
  }
  // Bug fix (owner, 2026-08-18): Template/Profile used to have exactly one
  // non-define verb (publish, Draft -> Active), so findDrafts (Draft/Validated
  // only) covered every possible fromState. Now that both have Pack's full
  // six-hop lifecycle (transitionDefinitions.json seed change), a queue's
  // fromState can be Published/Active/Deprecated/Retired too — findDrafts
  // would silently return empty for those. Owner, 2026-08-19: Template and
  // now Profile both have Pack's tenant-ownership model too, so both are
  // scoped the same way Pack's own findByStatus call above is.
  if (kind === "Template") {
    const { data } = await templatesDB.findByStatus(fromState as TemplateRow["status"], viewer && !viewer.isRoot ? viewer.tenantId : null);
    return (data ?? []).map(toSummary);
  }
  if (kind === "Profile") {
    const { data } = await profilesDB.findByStatus(fromState as ProfileRow["status"], viewer && !viewer.isRoot ? viewer.tenantId : null);
    return (data ?? []).map(toSummary);
  }
  return [];
}

// CR-045 follow-up — getPackSelectionsByCategory/getProfilePackSelections
// return the SEED-level shape (a bare string[] of Pack codes, what
// TemplateSeedInput/ProfileSeedInput and validate*Seed actually consume) —
// but the FORM/schema-level shape a referential-list field's own item
// properties expect (generateFields/parseFormBody) is an array of {packCode}
// objects, matching the migration 077/078/066 schema exactly. Without this
// conversion, generateFields reads row["packCode"] off a bare string and
// gets undefined every time — every resolved code silently renders as
// blank/"None" even though the row genuinely exists.
function toPackCodeRows(codes: string[] | undefined): Array<{ packCode: string }> {
  return (codes ?? []).map((packCode) => ({ packCode }));
}
function packSelectionsToFormShape<T extends Record<string, string[] | undefined>>(selections: T): { [K in keyof T]: Array<{ packCode: string }> } {
  const out = {} as { [K in keyof T]: Array<{ packCode: string }> };
  for (const key of Object.keys(selections) as Array<keyof T>) out[key] = toPackCodeRows(selections[key]);
  return out;
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
    // CR-024: templateVersion pulled from the real column, same as code/name
    // — draft_content is trusted for everything else, but the entity's own
    // authoritative columns always win for these three (mirrors packRowToContent's
    // packVersion: pack.pack_version, not whatever the JSON blob happens to hold).
    // CR-026: tenantId/parentTemplateId ride along the same way
    // packRowToContent's tenantId does — publishAuthoringDraft's re-validation
    // needs both (Ontology visibility scoping, the inheritance superset check).
    //
    // CR-045 follow-up — the same "real column wins" treatment extends to
    // Pack Codes/Deliverable Catalogue/Dependency Graph once this Template
    // isn't a Draft any more. draft_content is the WIP truth WHILE authoring
    // (the real tables aren't materialised until publish), but past Draft the
    // relational tables (template_packs, the deliverable_catalogue column,
    // dependency_definitions) are what's real — and for a Template created
    // outside the authoring form entirely (every seed script), draft_content
    // was never written at all, so trusting it exclusively showed "None" for
    // data that genuinely exists and is genuinely in effect.
    const materialised = t.status === "Draft" ? {} : {
      ...packSelectionsToFormShape(await getPackSelectionsByCategory(t.id)),
      deliverableCatalogue: t.deliverable_catalogue,
      dependencyGraph: await getDependencyGraphContent(t.id),
    };
    return { id: t.id, code: t.code, name: t.name, status: t.status, content: { code: t.code, name: t.name, ...(t.draft_content ?? {}), ...materialised, templateVersion: t.template_version, tenantId: t.tenant_id, parentTemplateId: t.parent_template_id } };
  }
  if (kind === "Profile") {
    const { data: p } = await profilesDB.findById(id);
    if (!p) return null;
    // Mirrors Template's own getAuthoringDraft treatment exactly — the
    // entity's own authoritative columns always win for these; tenantId/
    // parentProfileId ride along for publishAuthoringDraft's re-validation.
    // CR-045 follow-up — same "real join tables win once past Draft"
    // treatment as Template's own Pack-selection fields: a Profile created
    // outside the authoring form (every seed script) never writes
    // draft_content, but its Pack selections are real profile_packs rows
    // regardless (description/featureFlagCodes/compositionOptions have no
    // real-table equivalent, so those stay draft_content-only either way).
    const materialised = p.status === "Draft" ? {} : packSelectionsToFormShape(await getProfilePackSelections(p.id));
    return { id: p.id, code: p.code, name: p.name, status: p.status, content: { code: p.code, name: p.name, ...(p.draft_content ?? {}), ...materialised, profileVersion: p.profile_version, category: p.category, tenantId: p.tenant_id, parentProfileId: p.parent_profile_id } };
  }
  return null;
}

// CR-020: `code` is now picked from the small, shared `capability-name`
// Ontology vocabulary rather than minted as a per-Pack-unique UUID (CR-015)
// — a (code, packVersion) collision with a DIFFERENT Pack is now a realistic
// authoring mistake (two authors both starting a "development" Pack at
// 0.1.0), not a one-in-a-billion UUID clash. packs_code_version_key
// (migration 010) would otherwise surface as a raw Postgres error; this
// turns it into an actionable message before it reaches the DB. excludeId
// lets Save re-check without tripping over the row's own existing identity.
// CR-026 Part 2: scoped to the authoring tenant (packs_code_version_tenant_key,
// migration 063) — a tenant starting their own Pack must only collide with
// their OWN existing rows, not Platform's or another tenant's same code+version.
async function assertPackCodeVersionFree(code: string, packVersion: string, tenantId: string, excludeId?: string): Promise<string | null> {
  const { data: existing } = await packsDB.findByCodeAndVersion(code, packVersion, tenantId);
  if (existing && existing.id !== excludeId) {
    return `A Pack with code "${code}" already exists at version ${packVersion}. Pick a different starting version, or continue authoring that existing Pack instead of starting a new one.`;
  }
  return null;
}

// CR-021 / CR-024: same treatment as Pack's assertPackCodeVersionFree. Template
// now has real (code, templateVersion) versioning (Ch.41 VM-002, mirroring
// Pack), so the collision is scoped to the exact version, not the whole code
// — a second Draft under an existing code is fine as long as it's a genuinely
// new version (the normal path is reactivateAsNewVersion, core/templates.ts,
// but nothing stops an author starting one by hand at a free version number
// too). excludeId lets Save re-check without tripping over the row's own
// existing identity.
// CR-026: scoped to the authoring tenant (templates_code_version_tenant_key,
// migration 062) — a tenant's own new/inherited Template must only collide
// with their OWN existing rows, not Platform's or another tenant's, which is
// exactly what lets a tenant inherit a Platform Template under the SAME code.
async function assertTemplateCodeVersionFree(code: string, templateVersion: string, tenantId: string, excludeId?: string): Promise<string | null> {
  const { data: existing } = await templatesDB.findByCodeAndVersion(code, templateVersion, tenantId);
  if (existing && existing.id !== excludeId) {
    return `A Template with code "${code}" already exists at version ${templateVersion} ("${existing.name}"). Pick a different starting version, or continue authoring that existing Template instead of starting a new one.`;
  }
  return null;
}

// CR-026 Template Inheritance (Ch.6 §9, owner: "show a dropdown of codes
// (Platform published + tenant published). Give a button to inherit"). The
// dropdown offers every Active Template this viewer can see; "inherit" then
// clones the parent's authored content into a fresh Draft's starting point
// (templateInheritedContent below) — the SAME code, editable everything else.
export async function listInheritableTemplates(viewerTenantId: string): Promise<Array<{ id: string; code: string; name: string; templateVersion: string }>> {
  const { data: templates } = await templatesDB.findActiveVisibleTo(viewerTenantId);
  return (templates ?? []).map((t) => ({ id: t.id, code: t.code, name: t.name, templateVersion: t.template_version })).sort((a, b) => a.name.localeCompare(b.name));
}

// Reconstructs a parent Template's REAL current content (not its possibly-stale
// draft_content blob) the same way reactivateAsNewVersion (core/templates.ts)
// clones a row for a new version — required capabilities/mandatory Packs/
// deliverable catalogue come off the parent's materialised columns/join
// tables, `purpose` off draft_content (its only home, CR-023). `code` carries
// through unchanged — Option A's identity model (owner: "Add a tenant_id
// column... this will suffice") locks a Derived Template to its parent's code,
// disambiguated by the NEW Draft's own tenant_id, not a new code.
export async function inheritedTemplateContent(parentTemplateId: string, viewerTenantId: string): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const { data: parent } = await templatesDB.findById(parentTemplateId);
  if (!parent) return { ok: false, error: "parent Template not found" };
  if (parent.status !== "Active") return { ok: false, error: "a Template can only be inherited from an Active Version" };
  if (parent.tenant_id !== PLATFORM_TENANT_ID && parent.tenant_id !== viewerTenantId) {
    return { ok: false, error: "parent Template is not visible to this tenant" };
  }
  // CR-038 — requiredCapabilityCodes isn't carried through; it's derived
  // fresh from whichever Packs the new Draft ends up with, same as any other
  // authoring path. Six category-scoped slots off the parent's real
  // join-table rows, mirroring inheritedProfileContent's own pattern exactly.
  const packSelections = await getPackSelectionsByCategory(parent.id);
  const purpose = typeof (parent.draft_content as Record<string, unknown> | null)?.purpose === "string" ? (parent.draft_content as Record<string, unknown>).purpose : undefined;
  return {
    ok: true,
    content: {
      code: parent.code,
      name: parent.name,
      purpose,
      ...Object.fromEntries(PACK_SELECTION_SLOTS.map((slot) => [slot.field, ((packSelections[slot.field as keyof PackSelectionsByCategory] as string[] | undefined) ?? []).map((packCode) => ({ packCode }))])),
      deliverableCatalogue: parent.deliverable_catalogue,
    },
  };
}

// Owner, 2026-08-19: "19.2 and 19.3 has to be fixed similar to pack and
// template" — same treatment as assertTemplateCodeVersionFree, scoped to the
// authoring tenant (profiles_code_version_tenant_key, migration 064).
async function assertProfileCodeVersionFree(code: string, profileVersion: string, tenantId: string, excludeId?: string): Promise<string | null> {
  const { data: existing } = await profilesDB.findByCodeAndVersion(code, profileVersion, tenantId);
  if (existing && existing.id !== excludeId) {
    return `A Profile with code "${code}" already exists at version ${profileVersion} ("${existing.name}"). Pick a different starting version, or continue authoring that existing Profile instead of starting a new one.`;
  }
  return null;
}

// Ch.7 §9 Profile Inheritance (owner, 2026-08-19), mirroring
// listInheritableTemplates exactly. The dropdown offers every Active Profile
// this viewer can see.
export async function listInheritableProfiles(viewerTenantId: string): Promise<Array<{ id: string; code: string; name: string; profileVersion: string }>> {
  const { data: profiles } = await profilesDB.findActiveVisibleTo(viewerTenantId);
  return (profiles ?? []).map((p) => ({ id: p.id, code: p.code, name: p.name, profileVersion: p.profile_version })).sort((a, b) => a.name.localeCompare(b.name));
}

// Reconstructs a parent Profile's REAL current content, mirroring
// inheritedTemplateContent exactly — the four category-scoped Pack lists and
// optionalPackCodes come off the parent's real join-table rows (not
// draft_content), description/featureFlagCodes/compositionOptions off
// draft_content (their only home). `code` carries through unchanged — same
// Option A identity model as Template's: a Derived Profile keeps its
// parent's code, disambiguated by the NEW Draft's own tenant_id.
export async function inheritedProfileContent(parentProfileId: string, viewerTenantId: string): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const { data: parent } = await profilesDB.findById(parentProfileId);
  if (!parent) return { ok: false, error: "parent Profile not found" };
  if (parent.status !== "Active") return { ok: false, error: "a Profile can only be inherited from an Active Version" };
  if (parent.tenant_id !== PLATFORM_TENANT_ID && parent.tenant_id !== viewerTenantId) {
    return { ok: false, error: "parent Profile is not visible to this tenant" };
  }
  const { data: template } = await templatesDB.findById(parent.base_template_id);
  const [optionalPackCodes, technologyPackCodes, domainPackCodes, compliancePackCodes, integrationPackCodes] = await Promise.all([
    profilesDB.getPackSelection(parent.id, "optional"),
    profilesDB.getPackSelection(parent.id, "technology"),
    profilesDB.getPackSelection(parent.id, "domain"),
    profilesDB.getPackSelection(parent.id, "compliance"),
    profilesDB.getPackSelection(parent.id, "integration"),
  ]);
  const priorContent = (parent.draft_content ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    content: {
      code: parent.code,
      name: parent.name,
      baseTemplateCode: template?.code ?? "",
      environment: parent.environment,
      category: parent.category ?? "",
      configParameters: parent.config_parameters,
      description: typeof priorContent.description === "string" ? priorContent.description : "",
      compositionOptions: typeof priorContent.compositionOptions === "object" && priorContent.compositionOptions ? priorContent.compositionOptions : {},
      featureFlagCodes: Array.isArray(priorContent.featureFlagCodes) ? priorContent.featureFlagCodes : [],
      optionalPackCodes: (optionalPackCodes.data ?? []).map((packCode) => ({ packCode })),
      technologyPackCodes: (technologyPackCodes.data ?? []).map((packCode) => ({ packCode })),
      domainPackCodes: (domainPackCodes.data ?? []).map((packCode) => ({ packCode })),
      compliancePackCodes: (compliancePackCodes.data ?? []).map((packCode) => ({ packCode })),
      integrationPackCodes: (integrationPackCodes.data ?? []).map((packCode) => ({ packCode })),
    },
  };
}

// CR-023 (owner: "Seed for the templates should populate this field"): a new
// Template Draft's `purpose` is pre-filled from its category's Ontology
// guidance (migration 057) when the author hasn't written their own yet —
// never overwrites real content, only fills a genuinely empty field. Scoped
// by the author's own tenant (Platform's + their own, same as every other
// Ontology lookup in the authoring path) so a tenant's own added category
// description is honoured too.
async function withDefaultTemplatePurpose(content: Record<string, unknown>, code: string, tenantId?: string): Promise<Record<string, unknown>> {
  if (typeof content.purpose === "string" && content.purpose.trim()) return content;
  const { data: concept } = await ontologyDB.findConcept("template-categories", code, { isRoot: false, tenantId: tenantId ?? PLATFORM_TENANT_ID });
  if (!concept?.description) return content;
  return { ...content, purpose: concept.description };
}

// --- Create a Draft from authored content (real author) ---------------------
// tenantId (Pack/Template ownership, owner: "Packs will have ownership" /
// CR-026 "Add a tenant_id column") — the real author's own tenant_id
// (Platform tenant for a Platform-type author), read off their session by the
// web route and passed straight through; Profile has no tenant_id column, so
// it's ignored for that kind. parentTemplateId (CR-026 Template Inheritance,
// Template only) — set only when the author chose a parent via the "Inherit"
// control; ignored for every other kind.
export async function createAuthoringDraft(input: { kind: SchemaDefinitionEntityKind; actorId: string; tenantId?: string; parentTemplateId?: string; parentProfileId?: string; content: Record<string, unknown> }): Promise<AuthoringResult> {
  const authoredBy = Number(input.actorId);
  if (input.kind === "Pack") {
    // A Pack Draft is created directly (status Draft) from the authored content;
    // full structural/referential validation is the publish-time gate, not the
    // draft gate (WIP is allowed to be incomplete). Code is a system UUID.
    const seed = toPackSeedInput(input.content);
    const collision = await assertPackCodeVersionFree(seed.code, seed.packVersion, input.tenantId ?? PLATFORM_TENANT_ID);
    if (collision) return { ok: false, errors: [collision] };
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
    // CR-026 Template Inheritance: a chosen parent locks this Draft's code to
    // the parent's own (owner: Option A — "Add a tenant_id column... this
    // will suffice" — identity is (code, template_version, tenant_id), not a
    // new code) — overrides whatever the form/import submitted, the same way
    // Save can never touch parent_template_id once set.
    let parentTenantCheckError: string | null = null;
    let code = typeof input.content.code === "string" && input.content.code.trim() ? input.content.code.trim() : randomUUID();
    if (input.parentTemplateId) {
      const inherited = await inheritedTemplateContent(input.parentTemplateId, input.tenantId ?? PLATFORM_TENANT_ID);
      if (!inherited.ok) parentTenantCheckError = inherited.error;
      else code = inherited.content.code as string;
    }
    if (parentTenantCheckError) return { ok: false, errors: [parentTenantCheckError] };
    // CR-021: code is now a template-categories Ontology concept (owner:
    // "The code is not UUID, but one of these values"); reuses a code already
    // on the content if present, else mints a UUID (defensive default for a
    // JSON import that omits it — never what the interactive form submits).
    // CR-024: same versioning discipline as Pack — a fresh interactive Draft
    // always starts at 1.0.0 (contentForForm, web/sdkAuthoring.ts); a JSON
    // import/CLI path that omits it gets the same default.
    const templateVersion = typeof input.content.templateVersion === "string" && input.content.templateVersion.trim() ? input.content.templateVersion.trim() : "1.0.0";
    const tenantId = input.tenantId ?? PLATFORM_TENANT_ID;
    const collision = await assertTemplateCodeVersionFree(code, templateVersion, tenantId);
    if (collision) return { ok: false, errors: [collision] };
    const draftContent = await withDefaultTemplatePurpose({ ...input.content, code }, code, tenantId);
    const { data: t, error } = await templatesDB.createDraft({ code, name: (draftContent.name as string) || "(untitled Template)", templateVersion, authoredBy, draftContent, tenantId, parentTemplateId: input.parentTemplateId ?? null });
    if (error || !t) return { ok: false, errors: [(error ?? new Error("failed to create Template draft")).message] };
    return { ok: true, draftId: t.id };
  }
  if (input.kind === "Profile") {
    // Ch.7 §9 Profile Inheritance (owner, 2026-08-19), mirroring Template's
    // own CR-026 code-lock treatment exactly: a chosen parent locks this
    // Draft's code to the parent's own, overriding whatever the form/import
    // submitted.
    let parentProfileTenantCheckError: string | null = null;
    let code = typeof input.content.code === "string" && input.content.code.trim() ? input.content.code.trim() : randomUUID();
    const tenantId = input.tenantId ?? PLATFORM_TENANT_ID;
    if (input.parentProfileId) {
      const inherited = await inheritedProfileContent(input.parentProfileId, tenantId);
      if (!inherited.ok) parentProfileTenantCheckError = inherited.error;
      else code = inherited.content.code as string;
    }
    if (parentProfileTenantCheckError) return { ok: false, errors: [parentProfileTenantCheckError] };

    const baseTemplateCode = (input.content.baseTemplateCode as string)?.trim();
    if (!baseTemplateCode) return { ok: false, errors: ["a base Template code is required to start a Profile draft"] };
    const { data: template } = await templatesDB.findByCode(baseTemplateCode);
    if (!template) return { ok: false, errors: [`baseTemplateCode "${baseTemplateCode}" not found`] };

    // Same versioning discipline as Pack/Template — a fresh interactive Draft
    // always starts at 1.0.0 (contentForForm, web/sdkAuthoring.ts).
    const profileVersion = typeof input.content.profileVersion === "string" && input.content.profileVersion.trim() ? input.content.profileVersion.trim() : "1.0.0";
    const collision = await assertProfileCodeVersionFree(code, profileVersion, tenantId);
    if (collision) return { ok: false, errors: [collision] };

    const category = typeof input.content.category === "string" ? input.content.category : null;
    const { data: p, error } = await profilesDB.createDraft({
      code,
      name: (input.content.name as string) || "(untitled Profile)",
      baseTemplateId: template.id,
      environment: (input.content.environment as string) || "development",
      authoredBy,
      draftContent: { ...input.content, code },
      profileVersion,
      tenantId,
      parentProfileId: input.parentProfileId ?? null,
      category,
    });
    if (error || !p) return { ok: false, errors: [(error ?? new Error("failed to create Profile draft")).message] };
    return { ok: true, draftId: p.id };
  }
  return { ok: false, errors: [`kind "${input.kind}" is not authorable`] };
}

// --- Save (update a Draft's content) ----------------------------------------
export async function saveAuthoringDraft(input: { kind: SchemaDefinitionEntityKind; id: string; content: Record<string, unknown> }): Promise<AuthoringActionResult> {
  if (input.kind === "Pack") {
    const { data: existingPack } = await packsDB.findById(input.id);
    if (!existingPack) return { ok: false, errors: ["draft not found or no longer editable (only Draft rows can be saved)"] };
    const seed = toPackSeedInput({ ...input.content });
    const collision = await assertPackCodeVersionFree(seed.code, seed.packVersion, existingPack.tenant_id, input.id);
    if (collision) return { ok: false, errors: [collision] };
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
    // CR-024: code+templateVersion normalised the same way Pack's own save
    // branch does (toPackSeedInput) — the readonly templateVersion field
    // always round-trips its current value on a real form POST, same as
    // Pack's packVersion; the "1.0.0"-if-missing fallback only matters for a
    // non-form caller (toTemplateSeedInput's own default), same accepted
    // shape Pack already has.
    const { data: existingTemplate } = await templatesDB.findById(input.id);
    if (!existingTemplate) return { ok: false, errors: ["draft not found or no longer editable"] };
    const seed = toTemplateSeedInput({ ...input.content });
    // CR-026 Template Inheritance: once a parent is chosen, code is locked to
    // the parent's own for the life of this Draft — Save can't drift it away
    // by picking a different category, the same way createAuthoringDraft
    // forces it at the moment Inherit is chosen.
    if (existingTemplate.parent_template_id) seed.code = existingTemplate.code;
    const collision = await assertTemplateCodeVersionFree(seed.code, seed.templateVersion, existingTemplate.tenant_id, input.id);
    if (collision) return { ok: false, errors: [collision] };
    const draftContent = await withDefaultTemplatePurpose({ ...input.content, code: seed.code, templateVersion: seed.templateVersion }, seed.code, existingTemplate.tenant_id);
    const { data, error } = await templatesDB.updateDraftContent(input.id, { code: seed.code, name: (draftContent.name as string) || "(untitled Template)", templateVersion: seed.templateVersion, draftContent });
    if (error) return { ok: false, errors: [error.message] };
    if (!data) return { ok: false, errors: ["draft not found or no longer editable"] };
    return { ok: true };
  }
  if (input.kind === "Profile") {
    const { data: existingProfile } = await profilesDB.findById(input.id);
    if (!existingProfile) return { ok: false, errors: ["draft not found or no longer editable"] };

    const baseTemplateCode = (input.content.baseTemplateCode as string)?.trim();
    if (!baseTemplateCode) return { ok: false, errors: ["a base Template code is required"] };
    const { data: template } = await templatesDB.findByCode(baseTemplateCode);
    if (!template) return { ok: false, errors: [`baseTemplateCode "${baseTemplateCode}" not found`] };

    const seed = toProfileSeedInput({ ...input.content });
    // Ch.7 §9 Profile Inheritance: once a parent is chosen, code is locked to
    // the parent's own for the life of this Draft, mirroring Template's own
    // CR-026 treatment exactly.
    if (existingProfile.parent_profile_id) seed.code = existingProfile.code;
    const collision = await assertProfileCodeVersionFree(seed.code, seed.profileVersion, existingProfile.tenant_id, input.id);
    if (collision) return { ok: false, errors: [collision] };

    const category = typeof input.content.category === "string" ? input.content.category : null;
    const { data, error } = await profilesDB.updateDraftContent(input.id, {
      name: (input.content.name as string) || "(untitled Profile)",
      baseTemplateId: template.id,
      environment: (input.content.environment as string) || "development",
      configParameters: (input.content.configParameters as Record<string, unknown>) ?? {},
      draftContent: { ...input.content, code: seed.code },
      profileVersion: seed.profileVersion,
      category,
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
  // Bug fix (owner, 2026-08-18): Template/Profile now have the same six-hop
  // lifecycle Pack does (transitionDefinitions.json / authorityVocabulary.json
  // seed change), so this needs the same "advance exactly the next hop, full
  // validation + materialisation gates only the first" shape as the Pack
  // branch above — was a single hardcoded jump straight to "Active" (the only
  // target state that existed before that seed change).
  if (input.kind === "Template") {
    const { data: t } = await templatesDB.findById(input.id);
    if (!t) return { ok: false, errors: ["Template draft not found"] };
    if (t.status === "Draft") {
      // CR-024: templateVersion pulled from the real column, same reasoning
      // as getAuthoringDraft's Template branch above. CR-026: tenantId/
      // parentTemplateId likewise — the inheritance superset check
      // (validateTemplateSeed) needs the real parent, not whatever (if
      // anything) draft_content happens to carry.
      const seed = toTemplateSeedInput({ code: t.code, name: t.name, ...(t.draft_content ?? {}), templateVersion: t.template_version, tenantId: t.tenant_id, parentTemplateId: t.parent_template_id });
      const validation = await validateTemplateSeed(seed);
      if (!validation.ok) return { ok: false, errors: validation.errors };
      await materialiseTemplateDraft(t.id, seed);
    }
    const advanced = await advanceTemplateOneStep(t, input.actorRole, input.actorId);
    if (!advanced.ok) return { ok: false, errors: [`${advanced.reason}${advanced.detail ? `: ${advanced.detail}` : ""}`] };
    return { ok: true, status: advanced.template.status };
  }
  if (input.kind === "Profile") {
    const { data: p } = await profilesDB.findById(input.id);
    if (!p) return { ok: false, errors: ["Profile draft not found"] };
    if (p.status === "Draft") {
      // profileVersion/tenantId/parentProfileId/category pulled from the real
      // columns, same reasoning as getAuthoringDraft's Profile branch above
      // and Template's own publishAuthoringDraft treatment.
      const seed = toProfileSeedInput({ code: p.code, name: p.name, ...(p.draft_content ?? {}), profileVersion: p.profile_version, category: p.category, tenantId: p.tenant_id, parentProfileId: p.parent_profile_id });
      const validation = await validateProfileSeed(seed);
      if (!validation.ok) return { ok: false, errors: validation.errors };
      await materialiseProfileDraft(p.id, seed);
    }
    const advanced = await advanceProfileOneStep(p, input.actorRole, input.actorId);
    if (!advanced.ok) return { ok: false, errors: [`${advanced.reason}${advanced.detail ? `: ${advanced.detail}` : ""}`] };
    return { ok: true, status: advanced.profile.status };
  }
  return { ok: false, errors: [`kind "${input.kind}" is not authorable`] };
}
