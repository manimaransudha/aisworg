// Ontology Model — Plan (Phase 17, Ch.18). Two edge concerns over a canonical
// core: write-path validation (a category must be a known canonical concept) and
// read-time label resolution (a tenant's alias, else the platform default). The
// core stores canonical codes only; neither the state machine, governance,
// dependency wiring, attestation, nor traceability ever sees a tenant label.
//
// CR-022 (owner: "Include tenant_id as part of Ontology. So platform ones
// will be visible to all + their own vocabulary"): a concept now belongs to a
// tenant (Platform's is canonical/shared; a tenant's own is theirs alone) —
// same shape Pack ownership already has. `OntologyActor` names who's asking:
// isRoot bypasses every scope check (sees/writes any tenant, same as
// everywhere else); everyone else reads Platform + their own tenant, and can
// only ever write their own.
import { ontologyDB, type OntologyViewer } from "../../../dblayer/ontologyDB.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { compositionEngine } from "../../../domain/engine/compositionEngine.js";
import type { OntologyConceptRow } from "../../../dblayer/seuTypes.js";

// actorId, added by migration 190's governed lifecycle — every real
// transition (deprecate/retire/archive) and every Version-publishing action
// (addConcept/composeConcept) records who did it, same "every transition: a
// real actor + badge" discipline the rest of this codebase already holds
// itself to. Optional so every pre-existing OntologyViewer-shaped call site
// (resolveLabels, setAlias, the read-only helpers) keeps compiling unchanged.
export interface OntologyActor extends OntologyViewer {
  actorId?: string | null;
}

export const CATEGORY_CONCEPT_TYPE: Record<string, string> = {
  Deliverable: "category:deliverable",
  Evidence: "category:evidence",
  Decision: "category:decision",
  Knowledge: "category:knowledge",
  Obligation: "category:obligation",
  // Ch.30 §7 — the illustrative Event Categories taxonomy (State/Governance/
  // Runtime/Integration/Administrative), a property of event_registry.category.
  EventType: "category:event-types",
  // CR-058 follow-up 2 — a Quality Gate's category (and its code — "the
  // code isn't a UUID or a freeform Pack-specific string — it's the
  // category identifier itself") reuses category:evidence directly rather
  // than a separate quality-gate-only vocabulary.
  QualityGate: "category:evidence",
};

// Write-path enforcement (Ch.18 Decision 4): a category must be a canonical
// concept for its field. The canonical code is the string itself, so existing
// values pass; a genuinely novel value is rejected. A retired concept is
// treated the same as an unknown one — retirement means "no longer valid for
// new writes", matching the discipline everywhere else (retired nouns/verbs
// can't be assigned to new badges either). Throws on violation.
//
// `viewer` is optional and defaults to Platform-only visibility — every
// pre-CR-022 caller (Deliverable/Evidence/Decision/Knowledge/Obligation
// category checks) has no tenant/actor context available at its call site
// today (creating one of those doesn't thread a session or an owning tenant
// through), and none of those 5 concept types has ever had a tenant-owned row
// — so the default preserves their exact prior behaviour untouched. Pack's
// category/installationClassification checks (core/packs.ts) pass a real
// scope, since PackSeedInput already carries the Pack's own tenantId.
export async function assertCanonicalCategory(conceptType: string, value: string, viewer: OntologyViewer = { isRoot: false, tenantId: null }): Promise<void> {
  // Migration 190 — findConcept itself now only ever resolves the row whose
  // status = 'Active', so a Deprecated/Retired/Archived concept is already
  // invisible here; no separate is_active check needed any more.
  const { data: concept } = await ontologyDB.findConcept(conceptType, value, viewer);
  if (!concept) {
    const { data: allowed } = await ontologyDB.findConceptsByType(conceptType, viewer);
    const list = (allowed ?? []).map((c) => c.code).join(", ");
    throw new Error(`"${value}" is not a canonical ${conceptType} concept. Allowed: ${list || "(none registered)"}`);
  }
}

// --- Ontology Management CRUD (owner, 2026-08-18: "each of the concept_types
// should have a CRUD UI... any further additions will be data changes") ---
// No separate concept_types governance table (owner: "there will be no end to
// this") — CRUD lands directly on ontology_concepts; the only guard-rail is a
// naming convention (owner: "simple rules. small case no spaces"), enforced
// here rather than by a second table.
//
// CR-022 design note — engine-bound concept types (owner, 2026-08-19):
// "Think of it as platform provides a software engineering definition. Tenant
// can override it, but within the boundaries of what the EOOM wants to
// accomplish." A purely descriptive concept type (template-categories,
// deliverable-name) is safe for a tenant to extend freely — nothing in the
// engine pattern-matches its codes. A concept type that's the tenant-facing
// name for a REAL engine mechanism (e.g. a future "quality-gate-type") is
// different: the tenant's own code/label stays free (their own methodology,
// their own words), but it must resolve to one of a small, fixed set of real
// engine capabilities — carried as an explicit reference on the concept
// (e.g. `engine_capability`), never inferred by the engine pattern-matching
// the concept's own `code` string. That's the EOOM boundary: vocabulary is
// tenant-owned, the mechanics it must still satisfy are not. Not built —
// nothing today has an engine binding to attach it to (Quality Gates are the
// natural first candidate once Pack's contribution types become
// Ontology-driven rather than hardcoded structure) — recorded here so the
// principle is on file before it's needed.
const ONTOLOGY_CODE_RE = /^[a-z][a-z0-9-]*$/;

export function assertOntologyCodeFormat(label: string, value: string): void {
  if (!ONTOLOGY_CODE_RE.test(value)) {
    throw new Error(`${label} "${value}" must be lowercase, hyphenated, no spaces (e.g. "capability-name").`);
  }
}

// The admin page's list of concept_types is derived from the data itself, not
// a lookup table — whatever concept_type codes are visible to this viewer.
export async function listConceptTypes(viewer: OntologyViewer): Promise<string[]> {
  const { data } = await ontologyDB.listDistinctConceptTypes(viewer);
  return data ?? [];
}

// Owner: "I want the sublists grouped and the items within the group will be
// the vertical tabs on that particular page... ai-provider-preference,
// development-methodology etc as a SEU Configurations." Migration 191 — this
// reads straight off the `ui_grouping` column (owner: "add a column ui
// grouping. So the rendering uses this UI grouping to generate the sub
// lists") — a row with ui_grouping set (e.g. profile-configuration's own
// 'ai-provider-preference' row) marks its OWN concept_type as a group's
// "defining type", names its `code` as a member concept_type, and supplies
// the group's display label — all three off one column, no inference, no
// code-side label map. A future group is a row edit (set ui_grouping on
// whichever rows should belong to it), not a code change.
export interface ConceptTypeNav {
  // Every concept_type NOT itself a member of some group, PLUS one entry per
  // distinct group (anchored on whichever member concept_type sorts first —
  // there's no "defining type" any more, groups are symmetric sets of
  // sibling concept_types) — what the navbar/top-level tab strip renders.
  topLevel: Array<{ type: string; label: string; isGroup: boolean }>;
  groupMembers: Record<string, string[]>; // anchor concept_type -> every concept_type in that group (anchor included)
  memberToGroup: Record<string, string>; // any member concept_type -> its group's anchor concept_type
}

// Owner: "The navbar in Ontology should reflect ui grouping. When the ui
// grouping is selected, the vertical tabs should be concept_types." One
// rule: a concept_type belongs to a group whenever its own rows carry
// ui_grouping; every concept_type sharing the same value merges into one
// entry, each becoming a tab inside it (see ontologyDB.findConceptTypeUiGroupings's
// own header for why the earlier parent-names-child mechanism didn't
// generalise). profile-configuration's own children now carry ui_grouping
// on THEIR OWN rows too (migration 193) — no special case for it any more,
// it's just another concept_type in the "SEU Configurations" set.
export async function getConceptTypeNav(viewer: OntologyViewer, conceptTypes?: string[]): Promise<ConceptTypeNav> {
  const types = conceptTypes ?? (await listConceptTypes(viewer));
  const { data: pairs } = await ontologyDB.findConceptTypeUiGroupings(viewer);
  const typeToLabel: Record<string, string> = {};
  for (const p of pairs ?? []) typeToLabel[p.concept_type] = p.ui_grouping;

  const membersByLabel: Record<string, string[]> = {};
  for (const [type, label] of Object.entries(typeToLabel)) (membersByLabel[label] ??= []).push(type);

  const groupMembers: Record<string, string[]> = {};
  const memberToGroup: Record<string, string> = {};
  const topLevel: Array<{ type: string; label: string; isGroup: boolean }> = [];

  for (const ct of types) {
    if (!typeToLabel[ct]) topLevel.push({ type: ct, label: ct, isGroup: false });
  }
  for (const label of Object.keys(membersByLabel)) {
    const members = [...membersByLabel[label]].sort();
    const anchor = members[0];
    groupMembers[anchor] = members;
    for (const m of members) memberToGroup[m] = anchor;
    topLevel.push({ type: anchor, label, isGroup: true });
  }
  topLevel.sort((a, b) => a.label.localeCompare(b.label));

  return { topLevel, groupMembers, memberToGroup };
}

// The vertical-tabs list for whichever concept_type the page is currently
// showing: inside a group (on its anchor, or on any one sibling member),
// the tabs are every concept_type in that group (anchor included);
// otherwise, every top-level concept_type, same flat strip this page always
// had. Tab labels stay raw concept_type slugs throughout — only the
// navbar/top-level entry point uses the friendlier ui_grouping label.
export function tabsForActiveType(nav: ConceptTypeNav, activeType: string): string[] {
  if (nav.groupMembers[activeType]) return nav.groupMembers[activeType];
  const anchor = nav.memberToGroup[activeType];
  if (anchor) return nav.groupMembers[anchor];
  return nav.topLevel.map((t) => t.type);
}

export async function listConceptsForType(conceptType: string, viewer: OntologyViewer, includeInactive = true) {
  const { data } = await ontologyDB.findConceptsByType(conceptType, viewer, { includeInactive });
  return data ?? [];
}

// `actor.isRoot` may add to ANY tenant's vocabulary (Platform's by default —
// the natural "curate the canonical set" action for a root admin); everyone
// else always adds to their OWN tenant's vocabulary, full stop — `targetTenantId`
// is ignored for a non-root actor rather than trusted from the request.
//
// Migration 190 — this is now BOTH "create a new concept" (first Version,
// publishes ConceptCreated) AND "publish a new Version of an existing one"
// (publishes ConceptUpdated, auto-superseding whatever was Active before to
// Deprecated) depending on whether a row already exists for this
// (conceptType, code, tenantId) triple. Creation itself is still not a
// governed transition (no badge beyond the route's own ontology_define gate)
// — only the outbound Deprecated/Retired/Archived hops are (deprecateConcept/
// retireConcept/archiveConcept below), same "creation authority is not a
// transition" discipline every other entity in this codebase holds to.
export async function addConcept(
  input: {
    conceptType: string; code: string; defaultLabel: string; description?: string; targetTenantId?: string;
    // Migration 191 — author's own per-concept choice, not inferred; uiGrouping
    // undefined means "leave whatever this code already had" on a re-add/
    // version-bump, so editing a grouped concept's label doesn't silently
    // un-group it.
    textType?: "text" | "markdown"; uiGrouping?: string | null;
  },
  actor: OntologyActor
) {
  const conceptType = input.conceptType.trim();
  const code = input.code.trim();
  const defaultLabel = input.defaultLabel.trim();
  const description = (input.description ?? "").trim();
  assertOntologyCodeFormat("concept type", conceptType);
  assertOntologyCodeFormat("code", code);
  if (!defaultLabel) throw new Error("label is required");
  // CR-049 — `deliverable-name` graduated out of plain CRUD into a real
  // authored entity (Deliverable Definition, its own deliverable_definitions
  // table + Draft->...->Active lifecycle) so a tenant's specialisation is a
  // tracked derivation of Platform's own concept, not an orphan row that
  // happens to share a string. A hand-added row here would bypass that
  // lineage entirely, undermining the whole point of the CR.
  if (conceptType === "deliverable-name") {
    throw new Error('Deliverable names are authored at /aisworg/seu/sdk/deliverable-authoring now, not added directly here — use "Inherit" there to derive from an existing Platform Deliverable Definition, or start a new one.');
  }
  const tenantId = actor.isRoot ? (input.targetTenantId ?? PLATFORM_TENANT_ID) : actor.tenantId;
  if (!tenantId) throw new Error("no tenant to add this concept to");
  return createConceptVersion({ conceptType, code, tenantId, defaultLabel, description: description || null, textType: input.textType, uiGrouping: input.uiGrouping }, actor);
}

// The one place that computes the next version number and supersedes the
// previous Active row (Ch.18 §12) — addConcept's own create/edit action and
// composeConcept's Specialization/Override strategies both end up here.
async function createConceptVersion(
  input: {
    conceptType: string; code: string; tenantId: string; defaultLabel: string; description: string | null;
    contributedByPack?: string | null; compositionStrategy?: "specialization" | "override" | null; compositionSources?: Array<{ conceptId: string; code: string }>;
    textType?: "text" | "markdown"; uiGrouping?: string | null;
  },
  actor: OntologyActor
): Promise<OntologyConceptRow> {
  const { data: previousActive } = await ontologyDB.findActiveConcept(input.conceptType, input.code, input.tenantId);
  const { data: latest } = await ontologyDB.findLatestVersion(input.conceptType, input.code, input.tenantId);
  const base = previousActive ?? latest;
  const nextVersion = base ? await nextAvailableVersion(input.conceptType, input.code, input.tenantId, base.version) : "1.0.0";

  // Publishing a new Version without explicitly naming textType/uiGrouping
  // inherits both from the prior Version (base) — a plain label/description
  // edit shouldn't silently reset the render mode or drop group membership.
  const { data: created, error } = await ontologyDB.insertConceptVersion({
    conceptType: input.conceptType, code: input.code, tenantId: input.tenantId, version: nextVersion,
    defaultLabel: input.defaultLabel, description: input.description, contributedByPack: input.contributedByPack ?? null,
    compositionStrategy: input.compositionStrategy ?? null, compositionSources: input.compositionSources ?? [],
    textType: input.textType ?? base?.text_type ?? "markdown",
    uiGrouping: input.uiGrouping !== undefined ? input.uiGrouping : (base?.ui_grouping ?? null),
  });
  if (error || !created) throw error ?? new Error("failed to create concept version");

  // Ch.18 §14 — ConceptCreated (first Version) / ConceptUpdated (every
  // subsequent one). Not a governed transition (see addConcept's own header),
  // so authorityBadge is null — the route's own ontology_define gate is the
  // only authority check on this action.
  await eventBus.publish({
    eventType: latest ? "ConceptUpdated" : "ConceptCreated",
    originatingObjectType: "Ontology",
    originatingObjectId: created.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { conceptType: input.conceptType, code: input.code, version: nextVersion },
    actorId: actor.actorId ?? null,
    authorityBadge: null,
  });

  if (previousActive && previousActive.id !== created.id) {
    await ontologyDB.updateConceptStatus(previousActive.id, "Deprecated");
    await eventBus.publish({
      eventType: "ConceptDeprecated",
      originatingObjectType: "Ontology",
      originatingObjectId: previousActive.id,
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      payload: { conceptType: input.conceptType, code: input.code, version: previousActive.version, reason: "superseded by new version" },
      actorId: actor.actorId ?? null,
      authorityBadge: null,
    });
  }

  return created;
}

async function nextAvailableVersion(conceptType: string, code: string, tenantId: string, fromVersion: string): Promise<string> {
  const [major, minor, startingPatch] = fromVersion.split(".").map(Number);
  let patch = startingPatch || 0;
  for (let attempts = 0; attempts < 1000; attempts++) {
    patch += 1;
    const candidate = `${major || 1}.${minor || 0}.${patch}`;
    const { data: existing } = await ontologyDB.findConceptByCodeAndVersion(conceptType, code, tenantId, candidate);
    if (!existing) return candidate;
  }
  throw new Error(`could not find an unused version for ${conceptType}/${code} after bumping from ${fromVersion}`);
}

// Ch.18 §11 real governed hops (migration 190) — badge is `ontology_<verb>`
// (transitionEngine's own noun_verb derivation), with alternateBadges
// ['ontology_define'] so every existing ontology_define/root holder keeps
// full access without a new badge grant; a future tenant that wants to split
// these into their own separately-grantable badges still can, without any
// code change here. Same ownership rule as addConcept: root may act on any
// tenant's row; anyone else only their own.
async function transitionConcept(conceptType: string, code: string, targetTenantId: string, toState: "Deprecated" | "Retired" | "Archived", actor: OntologyActor): Promise<OntologyConceptRow> {
  if (!actor.isRoot && targetTenantId !== actor.tenantId) {
    throw new Error("you can only change concepts in your own tenant's vocabulary");
  }
  const { data: concept } = await ontologyDB.findLatestVersion(conceptType, code, targetTenantId);
  if (!concept) throw new Error(`no such concept ${conceptType}/${code} for that tenant`);
  const fromState = concept.status;

  const gate = await transitionEngine.evaluate({
    entityType: "Ontology", fromState, toState, actorRole: "", actorId: actor.actorId ?? undefined,
    entityId: concept.id, alternateBadges: ["ontology_define"],
  });
  if (!gate.allowed) {
    if (gate.reason === "authority_denied") throw new Error(`requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})`);
    if (gate.reason === "no_transition_definition") throw new Error(`cannot move ${conceptType}/${code} from ${fromState} to ${toState}`);
    throw new Error(gate.reason);
  }

  const { data: updated, error } = await ontologyDB.updateConceptStatus(concept.id, toState);
  if (error || !updated) throw error ?? new Error("failed to update concept status");

  await eventBus.publish({
    eventType: gate.eventType ?? `OntologyConcept${toState}`,
    originatingObjectType: "Ontology",
    originatingObjectId: concept.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { conceptType, code, fromState, toState, version: concept.version },
    actorId: actor.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });

  return updated;
}

export async function deprecateConcept(conceptType: string, code: string, targetTenantId: string, actor: OntologyActor) {
  return transitionConcept(conceptType, code, targetTenantId, "Deprecated", actor);
}

// Same exported shape web/ontology.ts already called (conceptType, code,
// targetTenantId, actor) — now a real governed Deprecated -> Retired
// transition instead of a direct is_active flip off Active. A concept must
// be Deprecated first (no skip-ahead edge), the same discipline Pack/
// Template/Service Definition already hold themselves to.
export async function retireConcept(conceptType: string, code: string, targetTenantId: string, actor: OntologyActor) {
  return transitionConcept(conceptType, code, targetTenantId, "Retired", actor);
}

export async function archiveConcept(conceptType: string, code: string, targetTenantId: string, actor: OntologyActor) {
  return transitionConcept(conceptType, code, targetTenantId, "Archived", actor);
}

// Owner: "Add a retire button also. - this should make the isActive false."
// Migration 190 replaced the old flat is_active boolean with a real
// Active -> Deprecated -> Retired -> Archived lifecycle (no skip-ahead edge —
// deprecateConcept/retireConcept's own header), so there is no longer a
// single flip that means "isActive = false" directly. This is that one-click
// action's modern equivalent: walks a row through BOTH required hops
// (Active -> Deprecated -> Retired) so the Ontology Metadata page can offer
// one "Retire" button with the same one-click feel the old boolean had,
// while every real transition still runs (its own badge check, its own
// event) rather than a raw status write. Only valid from Active — the
// caller is expected to only offer this button on Active rows (the
// Metadata page's own listAllConceptsForPicker already only returns those).
export async function quickRetireConcept(conceptType: string, code: string, targetTenantId: string, actor: OntologyActor): Promise<OntologyConceptRow> {
  await deprecateConcept(conceptType, code, targetTenantId, actor);
  return retireConcept(conceptType, code, targetTenantId, actor);
}

// Owner: "a CRUD to manually set the ui_grouping / text_type." Edits the
// CURRENT Active row's own administrative metadata directly — no new
// Version, no status change, no transitionEngine gate (this isn't a
// lifecycle move, same "not a governed transition" territory as addConcept's
// own create/edit action, gated only by the route's own ontology_define
// badge). Same ownership rule as every other write here: root may edit any
// tenant's row; everyone else only their own. `uiGrouping: null` here means
// exactly what it says — clear it — since this is a direct edit of a known
// current value, not createConceptVersion's own "unspecified = inherit".
//
// Owner: "Edit should emit ConceptUpdated. No versioning required" — this
// function already had the "no versioning" half right (a plain in-place
// write, unlike createConceptVersion's own edit path, which DOES bump a new
// Version and already publishes its own ConceptUpdated for that case); it
// was just missing the event entirely. Published with no versionEvent —
// there's no transition_definitions row backing this (it isn't a governed
// transition), so no version-history significance to tag it with, matching
// a plain Revision everywhere else in this codebase (e.g. Objective's own
// New/Edit actions, Version Feature Plan.md §3).
export async function updateConceptMeta(
  conceptType: string,
  code: string,
  targetTenantId: string,
  updates: { textType?: "text" | "markdown"; uiGrouping?: string | null },
  actor: OntologyActor
): Promise<OntologyConceptRow> {
  if (!actor.isRoot && targetTenantId !== actor.tenantId) {
    throw new Error("you can only edit concepts in your own tenant's vocabulary");
  }
  const { data: concept } = await ontologyDB.findActiveConcept(conceptType, code, targetTenantId);
  if (!concept) throw new Error(`no such concept ${conceptType}/${code} for that tenant`);
  const { data: updated, error } = await ontologyDB.updateConceptMeta(concept.id, updates);
  if (error || !updated) throw error ?? new Error("failed to update concept");

  await eventBus.publish({
    eventType: "ConceptUpdated",
    originatingObjectType: "Ontology",
    originatingObjectId: updated.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { conceptType, code, version: updated.version, textType: updated.text_type, uiGrouping: updated.ui_grouping },
    actorId: actor.actorId ?? null,
    authorityBadge: null,
  });

  return updated;
}

// Owner: "I want the metadata to be a separate option under ontology... the
// list should show all. otherwise how do I edit?" The dedicated Ontology
// Metadata page's own single data source — every Active concept, every
// category, in one list (not scoped to whichever tab an admin happens to be
// on), grouped or not — both the page's own review table AND its
// (concept_type, code) picker read off this same query.
export async function listAllConceptsForPicker(viewer: OntologyViewer) {
  const { data } = await ontologyDB.findAllActiveConcepts(viewer);
  return data ?? [];
}

// Owner: "Ui grouping in the tab forms should be having a similar change" —
// every existing ui_grouping value, for the same free-text-input-plus-
// datalist treatment (visible/pickable, never a locked-in dropdown) on both
// the Metadata page's own form AND the per-category Add-concept form.
export async function listDistinctUiGroupings(viewer: OntologyViewer): Promise<string[]> {
  const { data } = await ontologyDB.findDistinctUiGroupings(viewer);
  return data ?? [];
}

// --- System-sync entry points (pre-dating migration 190) ---------------
// deliverableDefinitions.ts / serviceDefinitions.ts mirror their OWN already-
// governed lifecycle onto a `deliverable-name`/`service-name` Ontology
// concept (used to call ontologyDB.upsertConcept/retireConcept directly).
// Not user-authored input — the code/label/description already came from a
// row that went through its own real governed transition — so these skip
// addConcept's user-input guards (the deliverable-name block, code-format
// assertion) and retireConcept's transitionEngine gate (there is no second
// human decision here to badge-check; it's a mechanical mirror of a decision
// already made and authorised on the calling entity's own transition).
export async function syncConceptFromEntity(conceptType: string, code: string, defaultLabel: string, description: string | null, tenantId: string): Promise<OntologyConceptRow> {
  return createConceptVersion({ conceptType, code, tenantId, defaultLabel, description }, { isRoot: true, tenantId, actorId: null });
}

// Mirrors the OLD ontologyDB.retireConcept's own direct-flip behaviour
// exactly (no Deprecated waypoint) — these two callers already gate
// eligibility themselves (only called once no other Version of the same
// code is still Active), so this is a plain status set, not a re-run of the
// Deprecated -> Retired governed gate real user-driven retireConcept uses.
export async function retireConceptForEntity(conceptType: string, code: string, tenantId: string): Promise<void> {
  const { data: concept } = await ontologyDB.findActiveConcept(conceptType, code, tenantId);
  if (!concept) return;
  await ontologyDB.updateConceptStatus(concept.id, "Retired");
  await eventBus.publish({
    eventType: "OntologyConceptRetired",
    originatingObjectType: "Ontology",
    originatingObjectId: concept.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { conceptType, code, version: concept.version, reason: "no other Version of this code remains Active" },
    actorId: null,
    authorityBadge: null,
  });
}

// Owner: "Allow tenants to compose using the composition strategy that packs
// already have implemented." Reuses the SAME compositionEngine module Pack's
// own composeAuthoringDraft calls (domain/engine/compositionEngine.ts) —
// scoped to Specialization + Override only (migration 190's own header: the
// other 4 compositionEngine strategies don't have clear meaning over a
// 2-field label/description entity with a single composition source in the
// common case). Publishes OntologyComposed — one of Ch.18 §14's own 7 named
// events, wired to nothing at all before this (§18.9's own audit finding).
export async function composeConcept(
  input: { conceptType: string; code: string; strategy: "specialization" | "override"; sourceConceptId?: string; defaultLabel?: string; description?: string; targetTenantId?: string },
  actor: OntologyActor
): Promise<OntologyConceptRow> {
  const conceptType = input.conceptType.trim();
  const code = input.code.trim();
  assertOntologyCodeFormat("concept type", conceptType);
  assertOntologyCodeFormat("code", code);
  const tenantId = actor.isRoot ? (input.targetTenantId ?? PLATFORM_TENANT_ID) : actor.tenantId;
  if (!tenantId) throw new Error("no tenant to compose this concept into");

  let result: OntologyConceptRow;
  let composedFrom: string[];

  if (input.strategy === "override") {
    // "Override reuses this entity's own normal version-bump flow" — same
    // framing Pack's own composeAuthoringDraft uses for its override branch;
    // there is no separate mechanism to invoke, just a label for traceability.
    const { data: existing } = await ontologyDB.findActiveConcept(conceptType, code, tenantId);
    if (!existing) throw new Error(`Override requires an existing concept ${conceptType}/${code} in your own tenant's vocabulary — use Specialization to create a new one.`);
    result = await createConceptVersion(
      {
        conceptType, code, tenantId,
        defaultLabel: input.defaultLabel?.trim() || existing.default_label,
        description: input.description?.trim() || existing.description,
        compositionStrategy: "override", compositionSources: [],
      },
      actor
    );
    composedFrom = [];
  } else {
    if (!input.sourceConceptId) throw new Error("Specialization requires a source concept to specialize from.");
    const { data: source } = await ontologyDB.findConceptById(input.sourceConceptId);
    if (!source || source.status !== "Active") throw new Error("composition source concept has no Active version.");
    const overrides: Record<string, unknown> = {};
    if (input.defaultLabel?.trim()) overrides.defaultLabel = input.defaultLabel.trim();
    if (input.description !== undefined) overrides.description = input.description.trim() || null;
    const specialized = compositionEngine.specialize({ id: source.id, code: source.code, fields: { defaultLabel: source.default_label, description: source.description } }, overrides);
    const fields = specialized.fields as { defaultLabel: string; description: string | null };
    result = await createConceptVersion(
      {
        conceptType, code, tenantId, defaultLabel: fields.defaultLabel, description: fields.description,
        compositionStrategy: "specialization", compositionSources: [{ conceptId: source.id, code: source.code }],
        textType: source.text_type,
      },
      actor
    );
    composedFrom = [source.code];
  }

  await eventBus.publish({
    eventType: "OntologyComposed",
    originatingObjectType: "Ontology",
    originatingObjectId: result.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { conceptType, code, version: result.version, strategy: input.strategy, composedFrom },
    actorId: actor.actorId ?? null,
    authorityBadge: null,
  });

  return result;
}

// Read-time resolution: the tenant's alias for a canonical code, else the
// platform default label (Platform's own concepts + this tenant's own).
// Runs at the edge (views / tenant-facing serialisers).
export async function resolveLabels(tenantId: string | null, conceptType: string): Promise<Record<string, string>> {
  const { data: concepts } = await ontologyDB.findConceptsByType(conceptType, { isRoot: false, tenantId });
  const labels: Record<string, string> = {};
  for (const c of concepts ?? []) labels[c.code] = c.default_label;
  if (tenantId) {
    const { data: aliases } = await ontologyDB.findAliasesByTenant(tenantId);
    for (const a of aliases ?? []) if (a.concept_type === conceptType) labels[a.canonical_code] = a.display_label;
  }
  return labels;
}

// Resolve a single code to its tenant-facing label.
export async function resolveLabel(tenantId: string | null, conceptType: string, code: string): Promise<string> {
  const labels = await resolveLabels(tenantId, conceptType);
  return labels[code] ?? code;
}

// Tenant alias management.
export async function setAlias(input: { tenantId: string; conceptType: string; canonicalCode: string; displayLabel: string }) {
  const { data: concept } = await ontologyDB.findConcept(input.conceptType, input.canonicalCode, { isRoot: false, tenantId: input.tenantId });
  if (!concept) throw new Error(`cannot alias unknown concept ${input.conceptType}/${input.canonicalCode}`);
  const { data, error } = await ontologyDB.upsertAlias(input);
  if (error || !data) throw error ?? new Error("failed to set alias");
  return data;
}

export async function clearAlias(tenantId: string, conceptType: string, canonicalCode: string) {
  await ontologyDB.deleteAlias(tenantId, conceptType, canonicalCode);
}

export async function listAliases(tenantId: string) {
  const { data } = await ontologyDB.findAliasesByTenant(tenantId);
  return data ?? [];
}
