import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import type { DeliverableDefinitionRow } from "../../../dblayer/seuTypes.js";

// CR-049 Phase 1 — Deliverable Definition authoring, mirroring core/templates.ts
// in shape. The one thing this touches that Template's own materialisation
// doesn't: syncing the `deliverable-name` Ontology concept CR-038's Template
// `deliverableCatalogue` picker already reads (ontologyDB.upsertConcept/
// retireConcept — the SAME functions the Ontology Management CRUD page
// already calls, not new mechanism). That sync happens ONLY at the moment a
// row genuinely reaches or leaves Active — there's nothing to "materialise
// onto real columns" the way Template needs (code/description already ARE
// real columns on deliverable_definitions from the moment of Draft creation).

export interface DeliverableDefinitionSeedInput {
  code: string;
  description?: string;
  definitionVersion: string;
  tenantId?: string;
  parentDeliverableDefinitionId?: string | null;
}

export type DeliverableDefinitionValidationResult = { ok: true } | { ok: false; errors: string[] };

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

async function assertDeliverableDefinitionCodeVersionFree(code: string, version: string, tenantId: string, excludeId?: string): Promise<string | null> {
  const { data: existing } = await deliverableDefinitionsDB.findByCodeAndVersion(code, version, tenantId);
  if (existing && existing.id !== excludeId) {
    return `A Deliverable Definition with code "${code}" already exists at version ${version}. Pick a different starting version, or continue authoring that existing Definition instead of starting a new one.`;
  }
  return null;
}

export async function validateDeliverableDefinitionSeed(seed: DeliverableDefinitionSeedInput, excludeId?: string): Promise<DeliverableDefinitionValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!SEMVER_RE.test(seed.definitionVersion ?? "")) errors.push(`definitionVersion must be semver (x.y.z), got: "${seed.definitionVersion}"`);

  const tenantId = seed.tenantId ?? PLATFORM_TENANT_ID;
  if (seed.code?.trim() && SEMVER_RE.test(seed.definitionVersion ?? "")) {
    const collision = await assertDeliverableDefinitionCodeVersionFree(seed.code, seed.definitionVersion, tenantId, excludeId);
    if (collision) errors.push(collision);
  }

  // Ch.15 §12 — inheritance: the parent must be a real, Active, visible
  // Definition. Unlike Template Inheritance, the child's code is NOT locked
  // to the parent's own (CR-049's own example: "Claims Adjudication Rules
  // Document" derives from "Business Rules" — a genuinely different code).
  if (seed.parentDeliverableDefinitionId) {
    const { data: parent } = await deliverableDefinitionsDB.findById(seed.parentDeliverableDefinitionId);
    if (!parent) {
      errors.push(`parentDeliverableDefinitionId "${seed.parentDeliverableDefinitionId}" not found`);
    } else if (parent.status !== "Active") {
      errors.push(`a Deliverable Definition can only be inherited from an Active Version`);
    } else if (parent.tenant_id !== PLATFORM_TENANT_ID && parent.tenant_id !== tenantId) {
      errors.push(`parent Deliverable Definition is not visible to this tenant`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

// Ch.15 §12 (owner: "a tenant's own 'Claims Adjudication Rules Document'
// inherits from the platform-standard 'Business Rules'...") — mirrors
// listInheritableTemplates, scoped to Platform-owned only (the canonical root
// a tenant specialises from, not another tenant's own derivation).
export async function listInheritableDeliverableDefinitions(): Promise<Array<{ id: string; code: string; description: string | null; definitionVersion: string }>> {
  const { data: rows } = await deliverableDefinitionsDB.findActivePlatformOwned();
  return (rows ?? []).map((r) => ({ id: r.id, code: r.code, description: r.description, definitionVersion: r.version })).sort((a, b) => a.code.localeCompare(b.code));
}

// Mirrors inheritedTemplateContent — the parent's code/description as an
// EDITABLE starting point (not locked, see validateDeliverableDefinitionSeed's
// own comment above).
export async function inheritedDeliverableDefinitionContent(parentDeliverableDefinitionId: string): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const { data: parent } = await deliverableDefinitionsDB.findById(parentDeliverableDefinitionId);
  if (!parent) return { ok: false, error: "parent Deliverable Definition not found" };
  if (parent.status !== "Active") return { ok: false, error: "a Deliverable Definition can only be inherited from an Active Version" };
  return { ok: true, content: { code: parent.code, description: parent.description ?? "" } };
}

export type TransitionDeliverableDefinitionResult = { ok: true; deliverableDefinition: DeliverableDefinitionRow } | { ok: false; reason: string; detail?: string };

const TERMINAL_REACTIVATABLE_STATES = new Set(["Deprecated", "Retired", "Archived"]);

// Mirrors core/templates.ts's own EVENT_BY_TARGET_STATE exactly, one level
// down: "DeliverableDefinition..." not "Deliverable..." — the existing
// Instance-side code (deliverables.ts/workItems.ts/traceability.ts/
// qualityGateEngine.ts) already assumes originatingObjectType "Deliverable"
// resolves to a `deliverables` row; reusing that string for a
// deliverable_definitions id would be a real collision, not a stylistic choice.
const EVENT_BY_TARGET_STATE: Record<string, string> = {
  Validated: "DeliverableDefinitionValidated",
  Published: "DeliverableDefinitionPublished",
  Active: "DeliverableDefinitionActivated",
  Deprecated: "DeliverableDefinitionDeprecated",
  Retired: "DeliverableDefinitionRetired",
  Archived: "DeliverableDefinitionArchived",
};

// Syncs the `deliverable-name` Ontology concept CR-038's picker reads — the
// only place this CR touches Ontology, and only at the moment of genuinely
// becoming (or ceasing to be) Active, never earlier (a Draft/Validated/
// Published Definition must stay invisible to that picker).
async function syncOntologyOnActivate(row: DeliverableDefinitionRow): Promise<void> {
  await ontologyDB.upsertConcept({ conceptType: "deliverable-name", code: row.code, defaultLabel: row.code, description: row.description, tenantId: row.tenant_id });
}

// Only retires the Ontology-side row if no OTHER Version of this same
// (code, tenant) is still Active — a supersession (a newer Version reaching
// Active) already re-upserted this same Ontology row (same code+tenant key)
// with the new Version's own content; retiring here would wrongly undo that.
async function demoteOntologyIfNoOtherActive(row: DeliverableDefinitionRow): Promise<void> {
  const { data: stillActive } = await deliverableDefinitionsDB.findActiveByCode(row.code, row.tenant_id);
  if (!stillActive) await ontologyDB.retireConcept("deliverable-name", row.code, row.tenant_id);
}

export async function transitionDeliverableDefinition(input: { deliverableDefinitionId: string; targetState: DeliverableDefinitionRow["status"]; actorRole: string; actorId?: string }): Promise<TransitionDeliverableDefinitionResult> {
  const { data: concept } = await deliverableDefinitionsDB.findById(input.deliverableDefinitionId);
  if (!concept) return { ok: false, reason: "not_found" };
  const fromState = concept.status;
  const gate = await transitionEngine.evaluate({ entityType: "Deliverable", fromState, toState: input.targetState, actorRole: input.actorRole, actorId: input.actorId, context: { deliverableDefinition: concept } });
  if (!gate.allowed) {
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Deliverable ${fromState} -> ${input.targetState}` };
    if (gate.reason === "policy_blocked") return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
    return { ok: false, reason: gate.reason };
  }

  if (input.targetState === "Active" && TERMINAL_REACTIVATABLE_STATES.has(fromState)) {
    return reactivateAsNewVersion(concept, input.actorRole, input.actorId);
  }

  const { data: updated, error } = await deliverableDefinitionsDB.updateStatus(concept.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update Deliverable Definition status");

  if (input.targetState === "Active") await syncOntologyOnActivate(updated);
  else if (fromState === "Active") await demoteOntologyIfNoOtherActive(updated);

  await eventBus.publish({
    eventType: EVENT_BY_TARGET_STATE[input.targetState] ?? "DeliverableDefinitionTransitioned",
    originatingObjectType: "DeliverableDefinition",
    originatingObjectId: updated.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: updated.code },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });
  return { ok: true, deliverableDefinition: updated };
}

async function nextAvailablePatchVersion(code: string, fromVersion: string, tenantId: string): Promise<string> {
  const [major, minor, startingPatch] = fromVersion.split(".").map(Number);
  let patch = startingPatch ?? 0;
  for (let attempts = 0; attempts < 1000; attempts++) {
    patch += 1;
    const candidate = `${major}.${minor}.${patch}`;
    const { data: existing } = await deliverableDefinitionsDB.findByCodeAndVersion(code, candidate, tenantId);
    if (!existing) return candidate;
  }
  throw new Error(`could not find an unused version for Deliverable Definition ${code} after bumping from ${fromVersion}`);
}

// Mirrors reactivateAsNewVersion in core/templates.ts exactly — a terminal
// row transitioning to Active never resurrects itself in place; it publishes
// a brand new Version at the next available patch, driven straight through
// Validated -> Published -> Active, then supersedes whatever else was
// Active for this code+tenant.
async function reactivateAsNewVersion(concept: DeliverableDefinitionRow, actorRole: string, actorId: string | undefined): Promise<TransitionDeliverableDefinitionResult> {
  const nextVersion = await nextAvailablePatchVersion(concept.code, concept.version, concept.tenant_id);
  const { data: newDraft, error } = await deliverableDefinitionsDB.createDraft({
    code: concept.code,
    description: concept.description,
    version: nextVersion,
    authoredBy: concept.authored_by,
    draftContent: { code: concept.code, description: concept.description, definitionVersion: nextVersion },
    tenantId: concept.tenant_id,
    parentDeliverableDefinitionId: concept.parent_deliverable_definition_id,
  });
  if (error || !newDraft) return { ok: false, reason: "policy_blocked", detail: (error ?? new Error("failed to create new Deliverable Definition version")).message };

  let current = newDraft;
  for (const targetState of ["Validated", "Published", "Active"] as const) {
    const result = await transitionDeliverableDefinition({ deliverableDefinitionId: current.id, targetState, actorRole, actorId });
    if (!result.ok) return result;
    current = result.deliverableDefinition;
  }

  const { data: previousActive } = await deliverableDefinitionsDB.findActiveByCode(concept.code, concept.tenant_id);
  if (previousActive && previousActive.id !== current.id) {
    await transitionDeliverableDefinition({ deliverableDefinitionId: previousActive.id, targetState: "Deprecated", actorRole, actorId });
  }

  return { ok: true, deliverableDefinition: current };
}

// Mirrors advanceTemplateOneStep exactly — runs exactly the NEXT governed
// hop off the entity's current status, authorised on only that hop's own
// badge.
const AUTHORING_NEXT_STATE: Partial<Record<DeliverableDefinitionRow["status"], DeliverableDefinitionRow["status"]>> = {
  Draft: "Validated",
  Validated: "Published",
  Published: "Active",
  Active: "Deprecated",
  Deprecated: "Retired",
  Retired: "Archived",
};

export async function advanceDeliverableDefinitionOneStep(concept: DeliverableDefinitionRow, actorRole: string, actorId: string | undefined): Promise<TransitionDeliverableDefinitionResult> {
  const targetState = AUTHORING_NEXT_STATE[concept.status];
  if (!targetState) return { ok: false, reason: "no_further_step", detail: `Deliverable Definition is already ${concept.status} — no further authoring step` };

  if (targetState === "Active") {
    const { data: previousActive } = await deliverableDefinitionsDB.findActiveByCode(concept.code, concept.tenant_id);
    const activateResult = await transitionDeliverableDefinition({ deliverableDefinitionId: concept.id, targetState: "Active", actorRole, actorId });
    if (!activateResult.ok) return activateResult;
    if (previousActive && previousActive.id !== activateResult.deliverableDefinition.id) {
      await transitionDeliverableDefinition({ deliverableDefinitionId: previousActive.id, targetState: "Deprecated", actorRole, actorId });
    }
    return activateResult;
  }

  return transitionDeliverableDefinition({ deliverableDefinitionId: concept.id, targetState, actorRole, actorId });
}

// Registry "Copy" action, mirrors copyTemplateAsNewDraft — stops at Draft
// instead of driving straight through to Active.
export async function copyDeliverableDefinitionAsNewDraft(deliverableDefinitionId: string, actorId: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await deliverableDefinitionsDB.findById(deliverableDefinitionId);
  if (!source) return { ok: false, errors: ["Deliverable Definition not found"] };
  const nextVersion = await nextAvailablePatchVersion(source.code, source.version, source.tenant_id);
  const { data: newDraft, error } = await deliverableDefinitionsDB.createDraft({
    code: source.code,
    description: source.description,
    version: nextVersion,
    authoredBy: Number(actorId),
    draftContent: { code: source.code, description: source.description, definitionVersion: nextVersion },
    tenantId: source.tenant_id,
    parentDeliverableDefinitionId: source.parent_deliverable_definition_id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Deliverable Definition")).message] };
  return { ok: true, draftId: newDraft.id };
}

export interface DeliverableDefinitionWithNextStates {
  deliverableDefinition: DeliverableDefinitionRow;
  possibleNextStates: string[];
}

// Deliverable Definition Registry — every Version of every Definition, with
// its own governed next states, mirroring listTemplatesWithNextStates
// (core/templates.ts) exactly.
export async function listDeliverableDefinitionsWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<DeliverableDefinitionWithNextStates[]> {
  const { data: rows } = viewer && !viewer.isRoot ? await deliverableDefinitionsDB.findAllVisibleTo(viewer.tenantId) : await deliverableDefinitionsDB.findAll();
  return Promise.all(
    (rows ?? []).map(async (deliverableDefinition) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Deliverable", deliverableDefinition.status);
      return { deliverableDefinition, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
