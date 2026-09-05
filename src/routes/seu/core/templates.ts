import { templatesDB } from "../../../dblayer/templatesDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { materialiseDependencyGraph, DEFAULT_DELIVERABLE_REQUIRED_STATE } from "../../../domain/engine/materialiseDependencyGraph.js";
import { dependencyDefinitionsDB } from "../../../dblayer/dependencyDefinitionsDB.js";
import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { assertCanonicalCategory, resolveLabels } from "./ontology.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import type { CapabilityRow, TemplateDeliverableSeed, TemplateDependencyGraphEntry, TemplateRow } from "../../../dblayer/seuTypes.js";

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
  // CR-038 — requiredCapabilityCodes is no longer authored input at all
  // (owner: "The Required Capability codes need not be an UI field. It is
  // derived from the selections the user makes") — computed by
  // deriveCapabilityCodesFromPackCodes from whichever Packs are selected
  // below, always, not read from anywhere. mandatoryPackCodes is likewise
  // replaced by six category-scoped slots — the real category:pack
  // vocabulary in full (Compliance/Domain/Engineering/Integration/
  // Organisation/Technology) — mirroring Profile's own four-slot
  // technologyPackCodes/domainPackCodes/compliancePackCodes/
  // integrationPackCodes model (migration 067) exactly, extended to all six
  // since a Template's mandatory Packs (unlike Profile's optional
  // supplements) can span any category.
  compliancePackCodes?: string[];
  domainPackCodes?: string[];
  engineeringPackCodes?: string[];
  integrationPackCodes?: string[];
  organisationPackCodes?: string[];
  technologyPackCodes?: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
  // CR-041 — the dependency graph, authored explicitly (not embedded per
  // deliverableCatalogue entry). Optional: a catalogue with no dependencies
  // (e.g. a single-Deliverable Template) has nothing to declare here.
  dependencyGraph?: TemplateDependencyGraphEntry[];
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

// CR-038 — the real category:pack vocabulary in full. Each slot's Pack
// codes are cross-checked against that Pack's OWN category (mirrors
// Profile's PACK_SELECTION_SLOTS, core/profiles.ts, exactly) — a code
// resolving to *some* Pack isn't enough; it must actually be categorised the
// way the slot it was put in claims.
export const PACK_SELECTION_SLOTS: Array<{ field: keyof TemplateSeedInput; listKind: string; packCategory: string }> = [
  { field: "compliancePackCodes", listKind: "compliance", packCategory: "Compliance" },
  { field: "domainPackCodes", listKind: "domain", packCategory: "Domain" },
  { field: "engineeringPackCodes", listKind: "engineering", packCategory: "Engineering" },
  { field: "integrationPackCodes", listKind: "integration", packCategory: "Integration" },
  { field: "organisationPackCodes", listKind: "organisation", packCategory: "Organisation" },
  { field: "technologyPackCodes", listKind: "technology", packCategory: "Technology" },
];

// Every Pack code selected across all six category slots, deduplicated —
// the set whose contributed Capabilities become requiredCapabilityCodes,
// and whose union is what Template Inheritance's superset rule checks.
function collectAllPackCodes(seed: TemplateSeedInput): string[] {
  return [...new Set(PACK_SELECTION_SLOTS.flatMap((slot) => (seed[slot.field] as string[] | undefined) ?? []))];
}

// CR-038 — "The Required Capability codes need not be a UI field. It is
// derived from the selections the user makes." Resolves each selected Pack
// code to its currently-Active row, then every Capability that Pack
// contributed (originating_pack_id) — never read from anywhere, always
// computed fresh from the live selection, at both publish time and
// (separately, in the web route) render time for producingCapabilityCode's
// own options.
export async function deriveCapabilityCodesFromPackCodes(packCodes: string[]): Promise<string[]> {
  const packIds: string[] = [];
  for (const code of packCodes) {
    const { data: pack } = await packsDB.findActiveByCode(code);
    if (pack) packIds.push(pack.id);
  }
  if (packIds.length === 0) return [];
  const { data: capabilities } = await capabilitiesDB.findByOriginatingPackIds(packIds);
  return [...new Set((capabilities ?? []).map((c) => c.code))];
}

// Owner: "Producing Capability Code as a link to the pack" — the Deliverable
// Catalogue view's own read-mode needs to resolve a derived capability code
// back to the real Pack that contributes it, not just the flat code list
// deriveCapabilityCodesFromPackCodes returns. Same packId resolution as that
// function; kept separate rather than widening its own return shape, since
// every other caller only ever wants the flat code list.
export interface CapabilityProducingPack { id: string; code: string; name: string; category: string }
export async function deriveCapabilityProducingPacksFromPackCodes(packCodes: string[]): Promise<Record<string, CapabilityProducingPack>> {
  const packById = new Map<string, CapabilityProducingPack>();
  for (const code of packCodes) {
    const { data: pack } = await packsDB.findActiveByCode(code);
    if (pack) packById.set(pack.id, { id: pack.id, code: pack.code, name: pack.name, category: pack.category });
  }
  if (packById.size === 0) return {};
  const { data: capabilities } = await capabilitiesDB.findByOriginatingPackIds([...packById.keys()]);
  const result: Record<string, CapabilityProducingPack> = {};
  for (const capability of capabilities ?? []) {
    const pack = capability.originating_pack_id ? packById.get(capability.originating_pack_id) : undefined;
    if (pack) result[capability.code] = pack;
  }
  return result;
}

// Ch.15 §12 (CR-049 Phase 2) — is `childName` either identical to
// `parentName`, or a legitimate "rename" of it: a Deliverable Definition the
// child's own tenant derived (however many hops), whose lineage
// (parent_deliverable_definition_id) eventually reaches a Definition sharing
// `parentName`'s code? Confirmed by the owner's own worked example — the
// match is purely by walking the child's resolved Definition's own ancestor
// chain and comparing codes; no cross-referencing back into the PARENT
// Template's own tenant is needed.
const MAX_LINEAGE_HOPS = 20;
async function isRenameOf(childName: string, parentName: string, tenantId: string): Promise<boolean> {
  if (childName === parentName) return true;
  const { data: resolved } = await deliverableDefinitionsDB.findActiveByCode(childName, tenantId);
  let current = resolved ?? null;
  for (let hop = 0; current?.parent_deliverable_definition_id && hop < MAX_LINEAGE_HOPS; hop++) {
    const { data: ancestor } = await deliverableDefinitionsDB.findById(current.parent_deliverable_definition_id);
    if (!ancestor) return false;
    if (ancestor.code === parentName) return true;
    current = ancestor;
  }
  return false;
}

// Ch.9 §11 Constraint Detection — standard three-colour DFS cycle check over
// the Deliverable-to-Deliverable subgraph (fromType: "Deliverable" edges
// only; Capability-type edges have no toCode/fromCode pair to form a cycle
// with). Returns the cycle as an ordered list of codes (the repeated node
// first and last) for a readable error message, or null if the graph is
// acyclic. Runs on the raw authored entries, not validated/deduped first —
// safe either way, since an edge naming an unknown code just never matches
// anything in the adjacency walk.
function findDeliverableDependencyCycle(dependencyGraph: TemplateDependencyGraphEntry[]): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const entry of dependencyGraph) {
    if (entry.fromType !== "Deliverable" || !entry.fromCode) continue;
    const list = adjacency.get(entry.fromCode) ?? [];
    list.push(entry.toCode);
    adjacency.set(entry.fromCode, list);
  }

  const UNVISITED = 0, IN_PROGRESS = 1, DONE = 2;
  const state = new Map<string, number>();
  const path: string[] = [];

  function visit(node: string): string[] | null {
    state.set(node, IN_PROGRESS);
    path.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const nextState = state.get(next) ?? UNVISITED;
      if (nextState === IN_PROGRESS) {
        return path.slice(path.indexOf(next)).concat(next);
      }
      if (nextState === UNVISITED) {
        const found = visit(next);
        if (found) return found;
      }
    }
    path.pop();
    state.set(node, DONE);
    return null;
  }

  for (const node of adjacency.keys()) {
    if ((state.get(node) ?? UNVISITED) === UNVISITED) {
      const found = visit(node);
      if (found) return found;
    }
  }
  return null;
}

export async function validateTemplateSeed(seed: TemplateSeedInput): Promise<TemplateValidationResult> {
  const errors: string[] = [];
  if (!seed.name?.trim()) errors.push("name is required");
  if (!SEMVER_RE.test(seed.templateVersion ?? "")) errors.push(`templateVersion must be semver (x.y.z), got: "${seed.templateVersion}"`);
  // CR-046 bug fix (owner: "why are test scripts adding code that is not in
  // the ontology??? I thought we fixed this") — code (migration 054,
  // template-categories, x-ontology: true) was never actually checked
  // server-side, only constrained by the browser's own dropdown — mirrors
  // validatePackSeed's identical fix for Pack.code, same real gap.
  try {
    await assertCanonicalCategory("template-categories", seed.code ?? "", { isRoot: false, tenantId: seed.tenantId ?? PLATFORM_TENANT_ID });
  } catch (err) {
    errors.push((err as Error).message);
  }

  for (const slot of PACK_SELECTION_SLOTS) {
    const codes = (seed[slot.field] as string[] | undefined) ?? [];
    for (const code of codes) {
      const { data: pack } = await packsDB.findByCode(code);
      if (!pack) errors.push(`${String(slot.field)} references unknown Pack code "${code}"`);
      else if (pack.category !== slot.packCategory) errors.push(`${String(slot.field)} references Pack "${code}" whose category is "${pack.category}", not "${slot.packCategory}"`);
    }
  }

  const derivedCapabilityCodes = await deriveCapabilityCodesFromPackCodes(collectAllPackCodes(seed));

  // CR-087 — entry.code must be a real, active deliverable-name Ontology
  // concept (assertCanonicalCategory, the same server-side discipline every
  // other Ontology-backed authoring field already has — this field never had
  // it before, despite migration 079's own widget wiring implying it did).
  const seenDeliverableCodes = new Set<string>();
  const tenantViewer = { isRoot: false, tenantId: seed.tenantId ?? PLATFORM_TENANT_ID };
  for (const entry of seed.deliverableCatalogue ?? []) {
    if (!entry.code?.trim()) { errors.push("deliverableCatalogue entry is missing a code"); continue; }
    if (seenDeliverableCodes.has(entry.code)) errors.push(`deliverableCatalogue entry "${entry.code}" is a duplicate — codes must be unique within one Template's catalogue`);
    try {
      await assertCanonicalCategory("deliverable-name", entry.code, tenantViewer);
    } catch (err) {
      errors.push(`deliverableCatalogue entry "${entry.code}": ${(err as Error).message}`);
    }
    seenDeliverableCodes.add(entry.code);
  }

  // CR-041 — referential checks the schema itself can't express: toCode/
  // fromCode must resolve to a real catalogue entry (by code — CR-087
  // renamed these off default_label text, see TemplateDependencyGraphEntry's
  // own comment, seuTypes.ts); fromCapabilityCode must resolve to a real,
  // derived Capability.
  for (const entry of seed.dependencyGraph ?? []) {
    if (!seenDeliverableCodes.has(entry.toCode)) {
      errors.push(`dependencyGraph entry toCode "${entry.toCode}" does not match a deliverableCatalogue entry`);
    }
    if (entry.fromType === "Deliverable") {
      if (!entry.fromCode || !seenDeliverableCodes.has(entry.fromCode)) {
        errors.push(`dependencyGraph entry (toCode "${entry.toCode}") fromCode "${entry.fromCode}" does not match a deliverableCatalogue entry`);
      }
    } else if (entry.fromType === "Capability") {
      if (!entry.fromCapabilityCode || !derivedCapabilityCodes.includes(entry.fromCapabilityCode)) {
        errors.push(`dependencyGraph entry (toCode "${entry.toCode}") fromCapabilityCode "${entry.fromCapabilityCode}" is not among the Capabilities the selected Packs contribute`);
      }
    } else {
      errors.push(`dependencyGraph entry (toCode "${entry.toCode}") has an unrecognised fromType "${entry.fromType}"`);
    }
  }

  // Ch.9 §11 Constraint Detection — a Deliverable-type edge chain that loops
  // back on itself could never be satisfied (nothing could ever reach the
  // gated state, since every candidate "first" step is itself waiting on
  // something downstream). Capability-type edges never participate — they
  // don't name another deliverableCatalogue entry, so they can't be part of
  // a Deliverable-to-Deliverable cycle.
  const cycle = findDeliverableDependencyCycle(seed.dependencyGraph ?? []);
  if (cycle) {
    errors.push(`dependencyGraph has a circular dependency: ${cycle.join(" → ")}`);
  }

  // CR-026 Template Inheritance (Ch.6 §9, owner: "All mandatory packs in the
  // parent template have to remain mandatory in the inherited one also"): a
  // Derived Template's identity is locked to its parent's code (enforced at
  // Draft creation, not re-litigated here) and its mandatory Packs (union
  // across all six category slots now, CR-038) must stay a superset of the
  // parent's CURRENT mandatory set — checked live, not frozen at inheritance
  // time, so a parent that later adds a mandatory Pack still binds its
  // existing children.
  if (seed.parentTemplateId) {
    const { data: parent } = await templatesDB.findById(seed.parentTemplateId);
    if (!parent) {
      errors.push(`parentTemplateId "${seed.parentTemplateId}" not found`);
    } else {
      if (seed.code !== parent.code) {
        errors.push(`an inherited Template must keep its parent's code ("${parent.code}") — Derived Templates shall not modify parent Templates (Ch.6 §9)`);
      }
      const { data: parentMandatory } = await templatesDB.getMandatoryPackCodes(parent.id);
      const allSeedPackCodes = collectAllPackCodes(seed);
      const missing = (parentMandatory ?? []).filter((code) => !allSeedPackCodes.includes(code));
      if (missing.length > 0) {
        errors.push(`an inherited Template must keep all of its parent's mandatory Packs — missing: ${missing.join(", ")}`);
      }

      // Ch.15 §12 (CR-049 Phase 2, owner: "For a derivation dependency graph
      // change is allowed. For the other two it is not") — Implementation/
      // Decomposition edges must survive inheritance unaltered; Derivation
      // is exempt entirely, freely editable, no check at all. "Unaltered"
      // allows a rename of either end (isRenameOf, above) but not a change
      // to which state gates it or a drop/addition relative to the parent's
      // CURRENT set — checked live, same discipline as the mandatory-Pack
      // check just above, not frozen at the moment of inheriting.
      const LOCKED_RELATIONSHIP_KINDS = new Set(["implementation", "decomposition"]);
      const parentGraph = await getDependencyGraphContent(parent.id, parent.tenant_id);
      const lockedParentEdges = parentGraph.filter((e) => LOCKED_RELATIONSHIP_KINDS.has(e.relationshipKind ?? "dependency"));
      if (lockedParentEdges.length > 0) {
        const tenantId = seed.tenantId ?? PLATFORM_TENANT_ID;
        const candidateChildEdges = (seed.dependencyGraph ?? []).filter((e) => LOCKED_RELATIONSHIP_KINDS.has(e.relationshipKind ?? "dependency"));
        const consumed = new Set<number>();
        for (const parentEdge of lockedParentEdges) {
          let matched = false;
          for (let i = 0; i < candidateChildEdges.length; i++) {
            if (consumed.has(i)) continue;
            const childEdge = candidateChildEdges[i];
            if (childEdge.relationshipKind !== parentEdge.relationshipKind) continue;
            if ((childEdge.requiredState ?? DEFAULT_DELIVERABLE_REQUIRED_STATE) !== parentEdge.requiredState) continue;
            if (!childEdge.fromCode || !(await isRenameOf(childEdge.fromCode, parentEdge.fromCode ?? "", tenantId))) continue;
            if (!(await isRenameOf(childEdge.toCode, parentEdge.toCode, tenantId))) continue;
            consumed.add(i);
            matched = true;
            break;
          }
          if (!matched) {
            errors.push(`an inherited Template must keep its parent's "${parentEdge.relationshipKind}" edge ("${parentEdge.fromCode}" → "${parentEdge.toCode}") unaltered — either end may be renamed to your own specialised Deliverable Definition, but the edge itself cannot be dropped or restructured`);
          }
        }
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export type PackSelectionsByCategory = Pick<TemplateSeedInput, "compliancePackCodes" | "domainPackCodes" | "engineeringPackCodes" | "integrationPackCodes" | "organisationPackCodes" | "technologyPackCodes">;

// CR-038 — for reactivateAsNewVersion/copyTemplateAsNewDraft/
// inheritedTemplateContent (sdkAuthoring.ts) carrying a Template's current
// Pack selections forward into a new Draft, bucketed by category for
// display. Deliberately reads via getMandatoryPackCodes (every row for this
// Template, regardless of list_kind) and resolves each code's own REAL
// category (packsDB.findByCode) rather than trusting which list_kind slot
// it happens to be stored under — every seed script (and the pre-CR-038
// data they've already written) stores mandatory Packs under the flat
// 'mandatory' list_kind, not the six new category-specific ones, so reading
// only the new slots would see nothing at all for any seed-created Template
// (breaking inheritance/copy of every one of them). Resolving by the Pack's
// own real category makes this correct regardless of which list_kind wrote
// the row — old flat writes and new category-scoped writes both land in the
// right bucket.
export async function getPackSelectionsByCategory(templateId: string): Promise<PackSelectionsByCategory> {
  const { data: allCodes } = await templatesDB.getMandatoryPackCodes(templateId);
  const result: PackSelectionsByCategory = {};
  for (const slot of PACK_SELECTION_SLOTS) result[slot.field as keyof PackSelectionsByCategory] = [];
  for (const code of allCodes ?? []) {
    const { data: pack } = await packsDB.findByCode(code);
    const slot = PACK_SELECTION_SLOTS.find((s) => s.packCategory === pack?.category);
    if (slot) (result[slot.field as keyof PackSelectionsByCategory] as string[]).push(code);
  }
  return result;
}

// CR-045 follow-up — the view page's own read source for a Template that
// isn't a Draft (owner: "Why is the seed data not populating a dependency
// graph for the templates?" — it was: dependency_definitions rows are real
// and correctly materialised by every seed path, but getAuthoringDraft only
// ever read draft_content, which stays empty for any Template created
// outside the authoring form itself, e.g. seedSdlcStandardTemplates.ts).
// Reconstructs the real, currently-materialised graph — not the originally
// AUTHORED seed shape: a Capability-type row's own fromCapabilityCode isn't
// stored anywhere once materialised (dependency_definitions is Service-code
// keyed, one row per Service that Capability provides — CR-042's own note on
// the same expansion), so this surfaces the real Service code(s) in fromCode
// instead, which is accurate information, just not round-trippable back into
// a single authored fromCapabilityCode row.
//
// CR-087 — dependency_definitions itself stays label-keyed (to_name/from_name
// hold the deliverable-name concept's default_label, not its code — see
// materialiseDependencyGraph.ts), but this function's own return shape is the
// authoring one (toCode/fromCode), so a Deliverable-type row's to_name/
// from_name get reverse-resolved back to their code here — the one place
// that reversal needs to happen, for the edit-form round-trip and the
// isRenameOf locked-edge check above. A Capability-type row's from_name is a
// Service code, never a deliverable-name label — passed through unresolved.
export async function getDependencyGraphContent(templateId: string, tenantId: string): Promise<TemplateDependencyGraphEntry[]> {
  const { data: rows } = await dependencyDefinitionsDB.findByOwner("Template", templateId);
  const labelByCode = await resolveLabels(tenantId, "deliverable-name");
  const codeByLabel = new Map(Object.entries(labelByCode).map(([code, label]) => [label, code]));
  const toCode = (label: string) => codeByLabel.get(label) ?? label;
  return (rows ?? []).map((r) => ({
    toCode: toCode(r.to_name),
    fromType: r.from_entity_type as "Deliverable" | "Capability",
    fromCode: r.from_entity_type === "Deliverable" ? toCode(r.from_name ?? "") : (r.from_name ?? ""),
    requiredState: r.from_state,
    relationshipKind: r.relationship_kind,
  }));
}

// CR-079 bug fix — deriveCapabilityCodesFromPackCodes above already resolves
// this precisely (selected pack codes -> their real pack ids ->
// findByOriginatingPackIds, genuinely Pack-scoped), but
// materialisePackSelectionsAndCapabilities used to throw that precision away
// down to bare code strings and re-resolve via capabilitiesDB.findByCodes,
// which has NO Pack scoping at all — so once contributionCapabilities[].code
// became a real, shared Ontology vocabulary (capability-name), any OTHER
// Active Pack anywhere sharing that code (never selected on this Template)
// got silently pulled in as an additional required Capability. Owner:
// "template should pull all and de-dupe. So if i have a project that needs
// technology-nodejs and technology-go, both are going to pull anything
// associated with development" — i.e. scoped to the Template's own SELECTED
// packs only, collapsed to one row when more than one of them shares a
// code (the same competency, not a duplicate requirement). This keeps the
// real rows from the same Pack-scoped resolution instead of round-tripping
// through codes at all.
async function deriveDedupedCapabilitiesFromPackCodes(packCodes: string[]): Promise<CapabilityRow[]> {
  const packIds: string[] = [];
  for (const code of packCodes) {
    const { data: pack } = await packsDB.findActiveByCode(code);
    if (pack) packIds.push(pack.id);
  }
  if (packIds.length === 0) return [];
  const { data: capabilities } = await capabilitiesDB.findByOriginatingPackIds(packIds);
  const byCode = new Map<string, CapabilityRow>();
  for (const capability of capabilities ?? []) {
    if (!byCode.has(capability.code)) byCode.set(capability.code, capability);
  }
  return [...byCode.values()];
}

// CR-038 — shared by publishTemplate and materialiseTemplateDraft: write the
// six category-scoped Pack selections, then derive and store
// requiredCapabilityCodes fresh from that same selection (never read from
// the seed itself — there's nothing to read, it's not an input any more).
async function materialisePackSelectionsAndCapabilities(templateId: string, seed: TemplateSeedInput): Promise<void> {
  for (const slot of PACK_SELECTION_SLOTS) {
    await templatesDB.setPackSelection(templateId, slot.listKind, (seed[slot.field] as string[] | undefined) ?? []);
  }
  const capabilities = await deriveDedupedCapabilitiesFromPackCodes(collectAllPackCodes(seed));
  await templatesDB.setRequiredCapabilities(templateId, capabilities.map((c) => c.id));
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

  await materialisePackSelectionsAndCapabilities(template.id, seed);
  await materialiseDependencyGraph({
    owningEntityType: "Template",
    owningEntityId: template.id,
    deliverableCatalogue: seed.deliverableCatalogue ?? [],
    dependencyGraph: seed.dependencyGraph ?? [],
    tenantId: seed.tenantId ?? PLATFORM_TENANT_ID,
  });

  // CR-025 — real named events (Ch.6 §16), mirroring PackRegistered
  // (core/packs.ts's createPackDraft) exactly, including the same asymmetry:
  // this fires from the "proper" publish entry point, not from interactive
  // authoring's createAuthoringDraft (core/sdkAuthoring.ts) — Pack's own
  // PackRegistered doesn't fire from there either.
  await eventBus.publish({
    eventType: "TemplateCreated",
    originatingObjectType: "Template",
    originatingObjectId: template.id,
    seuId: null, // platform catalog entity, not SEU-scoped
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
    seuId: null, // platform catalog entity, not SEU-scoped
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
  const packSelections = await getPackSelectionsByCategory(template.id);
  const seed: TemplateSeedInput = {
    code: template.code,
    name: template.name,
    templateVersion: nextVersion,
    ...packSelections,
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
  const packSelections = await getPackSelectionsByCategory(source.id);
  const purpose = typeof (source.draft_content as Record<string, unknown> | null)?.purpose === "string" ? (source.draft_content as Record<string, unknown>).purpose : undefined;
  const draftContent = {
    code: source.code,
    name: source.name,
    purpose,
    // CR-038 — form-posted row shape ({packCode} objects), matching how
    // parseFormBody reconstructs a referential-list field from a real POST —
    // this draftContent is what re-opening the copied Draft in the form
    // renders from, same convention this function already used for Packs
    // before requiredCapabilityCodes/mandatoryPackCodes existed as a flat
    // pair. requiredCapabilityCodes is omitted entirely — it's derived, not
    // stored content, so there's nothing to copy forward.
    ...Object.fromEntries(PACK_SELECTION_SLOTS.map((slot) => [slot.field, ((packSelections[slot.field as keyof PackSelectionsByCategory] as string[] | undefined) ?? []).map((packCode) => ({ packCode }))])),
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
  await templatesDB.setDeliverableCatalogue(templateId, seed.deliverableCatalogue ?? []);
  await materialisePackSelectionsAndCapabilities(templateId, seed);
  await materialiseDependencyGraph({
    owningEntityType: "Template",
    owningEntityId: templateId,
    deliverableCatalogue: seed.deliverableCatalogue ?? [],
    dependencyGraph: seed.dependencyGraph ?? [],
    tenantId: seed.tenantId ?? PLATFORM_TENANT_ID,
  });
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
