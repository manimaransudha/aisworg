import { ontologyDB, type OntologyViewer } from "../../../dblayer/ontologyDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { eventsDB } from "../../../dblayer/eventsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { compositionEngine } from "../../../domain/engine/compositionEngine.js";
import type { JsonSchemaDocument, JsonSchemaProperty } from "../../../domain/sdk/formGenerator.js";
import type { OntologyConceptRow } from "../../../dblayer/seuTypes.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";

export interface OntologyActor extends OntologyViewer {
  actorId: string;
  actorBadge: string;
}

async function resolveAuthor(actor: OntologyActor): Promise<{ authorId: string; authorBadge: string }> {
  if (!actor.actorId) throw new Error("no acting user to record as this concept's author");
  const { data: master } = await participantsMasterDB.findById(actor.actorId);
  if (!master) throw new Error(`No participants_master row for id ${actor.actorId} — log in first.`);
  return { authorId: master.id, authorBadge: actor.isRoot ? "root" : "ontology_define" };
}

export const CATEGORY_CONCEPT_TYPE: Record<string, string> = {
  Deliverable: "category:deliverable",
  Evidence: "category:evidence",
  Decision: "category:decision",
  Knowledge: "category:knowledge",
  Obligation: "category:obligation",
  EventType: "category:event-types",
  QualityGate: "category:evidence",
};

export async function assertCanonicalCategory(conceptType: string, value: string, viewer: OntologyViewer = { isRoot: false, tenantId: null }): Promise<void> {
  const { data: concept } = await ontologyDB.findConcept(conceptType, value, viewer);
  if (!concept) {
    const { data: allowed } = await ontologyDB.findConceptsByType(conceptType, viewer);
    const list = (allowed ?? []).map((c) => c.code).join(", ");
    throw new Error(`"${value}" is not a canonical ${conceptType} concept. Allowed: ${list || "(none registered)"}`);
  }
}

function resolveConceptType(def: JsonSchemaProperty, source: Record<string, unknown>): string {
  const driverField = def["x-referential-source-by"];
  const fixedSource = (def["x-referential-source"] ?? def["x-referential"] ?? "").trim();
  if (!driverField) return fixedSource;
  const driverValue = String(source[driverField] ?? "").trim();
  return driverValue ? `${driverValue.toLowerCase()}${def["x-referential-source-suffix"] ?? ""}` : "";
}

function resolveByValueConceptType(def: JsonSchemaProperty, topLevelContent: Record<string, unknown>): string | null {
  const byValue = def["x-referential-source-by-value"];
  if (!byValue) return null;
  const resolved = byValue.values[String(topLevelContent[byValue.field] ?? "")] ?? byValue.default;
  if (!resolved.ontology || resolved.composable) return null;
  return resolved.source;
}

export async function validateOntologyFieldsAgainstSchema(
  schema: JsonSchemaDocument,
  content: Record<string, unknown>,
  viewer: OntologyViewer
): Promise<string[]> {
  const errors: string[] = [];

  async function checkValue(conceptType: string, value: unknown, label: string): Promise<void> {
    if (typeof value !== "string" || !value.trim()) return;
    try {
      await assertCanonicalCategory(conceptType, value, viewer);
    } catch (err) {
      errors.push(`${label}: ${(err as Error).message}`);
    }
  }

  async function checkMulti(conceptType: string, values: unknown, label: string): Promise<void> {
    if (!Array.isArray(values)) return;
    for (const [i, value] of values.entries()) await checkValue(conceptType, value, `${label} item ${i + 1}`);
  }

  async function walk(props: Record<string, JsonSchemaProperty>, row: Record<string, unknown>, topLevelContent: Record<string, unknown>, labelPrefix: string): Promise<void> {
    for (const [name, def] of Object.entries(props)) {
      const label = `${labelPrefix}"${name}"`;

      if (def.type === "array" && def.items?.properties) {
        const rows = row[name];
        if (Array.isArray(rows)) {
          for (const [i, itemRow] of rows.entries()) {
            if (itemRow && typeof itemRow === "object") {
              await walk(def.items.properties, itemRow as Record<string, unknown>, topLevelContent, `${label} row ${i + 1} `);
            }
          }
        }
        continue;
      }

      if (def.type === "object" && def.properties) {
        const obj = row[name];
        if (obj && typeof obj === "object") {
          await walk(def.properties, obj as Record<string, unknown>, topLevelContent, `${label} `);
        }
        continue;
      }

      const byValueConceptType = resolveByValueConceptType(def, topLevelContent);
      if (byValueConceptType) {
        if (def.type === "array") await checkMulti(byValueConceptType, row[name], label);
        else await checkValue(byValueConceptType, row[name], label);
        continue;
      }

      if (def["x-ontology"] !== true || def["x-ontology-composable"] === true) continue;
      const conceptType = resolveConceptType(def, row);
      if (!conceptType) continue;
      if (def.type === "array") await checkMulti(conceptType, row[name], label);
      else await checkValue(conceptType, row[name], label);
    }
  }

  await walk(schema.properties ?? {}, content, content, "");
  return errors;
}

export async function emitConceptCreated(input: {
  originatingObjectType: string;
  originatingObjectId: string;
  originatingEntityCode?: string | null;
  code: string;
  conceptType: string;
  fieldName?: string;
  sourceRow?: Record<string, unknown>;
  actorId: string;
  badge: string;
  tenantId?: string;
}): Promise<void> {
  const code = input.code.trim();
  const conceptType = input.conceptType.trim();
  if (!code || !conceptType) return;
  const tenantId = input.tenantId ?? (await getPlatformTenantId());
  const { data: concept } = await ontologyDB.findConcept(conceptType, code, { isRoot: false, tenantId });
  if (concept) return;
  const { data: priorEvents } = await eventsDB.findByOriginatingObject(input.originatingObjectType, input.originatingObjectId);
  const alreadyProposed = (priorEvents ?? []).some(
    (e) => e.event_type === "ConceptCreated" && e.payload?.code === code && e.payload?.conceptType === conceptType
  );
  if (alreadyProposed) return;
  await eventBus.publish({
    eventType: "ConceptCreated",
    originatingObjectType: input.originatingObjectType,
    originatingObjectId: input.originatingObjectId,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: {
      code,
      conceptType,
      fieldName: input.fieldName ?? null,
      tenantId,
      originatingEntityCode: input.originatingEntityCode ?? null,
      sourceRow: input.sourceRow ?? null,
    },
    actorId: input.actorId,
    authorityBadge: input.badge,
  });
}

async function collectComposableValues(
  props: Record<string, JsonSchemaProperty>,
  row: Record<string, unknown>,
  topLevelContent: Record<string, unknown>,
  onValue: (conceptType: string, value: string, fieldName: string, label: string, row: Record<string, unknown>) => void | Promise<void>,
  labelPrefix: string
): Promise<void> {
  for (const [name, def] of Object.entries(props)) {
    const label = `${labelPrefix}"${name}"`;

    if (def.type === "array" && def.items?.properties) {
      const rows = row[name];
      if (Array.isArray(rows)) {
        for (const [i, itemRow] of rows.entries()) {
          if (itemRow && typeof itemRow === "object") {
            await collectComposableValues(def.items.properties, itemRow as Record<string, unknown>, topLevelContent, onValue, `${label} row ${i + 1} `);
          }
        }
      }
      continue;
    }
    if (def.type === "object" && def.properties) {
      const obj = row[name];
      if (obj && typeof obj === "object") {
        await collectComposableValues(def.properties, obj as Record<string, unknown>, topLevelContent, onValue, `${label} `);
      }
      continue;
    }

    const byValue = def["x-referential-source-by-value"];
    let conceptType: string;
    if (byValue) {
      const resolved = byValue.values[String(topLevelContent[byValue.field] ?? "")] ?? byValue.default;
      if (!resolved.ontology || !resolved.composable) continue;
      conceptType = resolved.source;
    } else {
      if (def["x-ontology"] !== true || def["x-ontology-composable"] !== true) continue;
      conceptType = resolveConceptType(def, row);
    }
    if (!conceptType) continue;

    const raw = row[name];
    const multi = def.type === "array" || def["x-widget"] === "referential-multi-select";
    const values = multi
      ? (Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [])
      : (typeof raw === "string" && raw.trim() !== "" ? [raw] : []);
    for (const value of values) await onValue(conceptType, value, name, label, row);
  }
}

export async function proposeComposableOntologyValues(
  schema: JsonSchemaDocument,
  content: Record<string, unknown>,
  ctx: { originatingObjectType: string; originatingObjectId: string; originatingEntityCode?: string | null; actorId: string; badge: string; tenantId?: string }
): Promise<void> {
  await collectComposableValues(schema.properties ?? {}, content, content, async (conceptType, value, fieldName, _label, row) => {
    await emitConceptCreated({ ...ctx, code: value, conceptType, fieldName, sourceRow: row });
  }, "");
}

export async function validateComposableFieldsAgainstSchema(
  schema: JsonSchemaDocument,
  content: Record<string, unknown>,
  viewer: OntologyViewer
): Promise<string[]> {
  const errors: string[] = [];
  await collectComposableValues(schema.properties ?? {}, content, content, async (conceptType, value, _fieldName, label) => {
    try {
      await assertCanonicalCategory(conceptType, value, viewer);
    } catch (err) {
      errors.push(`${label}: ${(err as Error).message}`);
    }
  }, "");
  return errors;
}

const ONTOLOGY_CODE_RE = /^[a-z][a-z0-9-]*$/;

export function assertOntologyCodeFormat(label: string, value: string): void {
  if (!ONTOLOGY_CODE_RE.test(value)) {
    throw new Error(`${label} "${value}" must be lowercase, hyphenated, no spaces (e.g. "capability-name").`);
  }
}

export async function listConceptTypes(viewer: OntologyViewer): Promise<string[]> {
  const { data } = await ontologyDB.listDistinctConceptTypes(viewer);
  return data ?? [];
}

export interface ConceptTypeNav {
  topLevel: Array<{ type: string; label: string; isGroup: boolean }>;
  groupMembers: Record<string, string[]>;
  memberToGroup: Record<string, string>;
}

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

export async function addConcept(
  input: {
    conceptType: string; code: string; defaultLabel: string; description?: string; targetTenantId?: string;
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
  if (conceptType === "deliverable-name") {
    throw new Error('Deliverable names are authored at /aisworg/seu/sdk/deliverable-authoring now, not added directly here — use "Inherit" there to derive from an existing Platform Deliverable Definition, or start a new one.');
  }
  const tenantId = actor.isRoot ? (input.targetTenantId ?? (await getPlatformTenantId())) : actor.tenantId;
  if (!tenantId) throw new Error("no tenant to add this concept to");

  const { data: latest } = await ontologyDB.findLatestVersion(conceptType, code, tenantId);
  if (!latest) {
    const version = "1.0.0";
    const { authorId, authorBadge } = await resolveAuthor(actor);
    const { data: created, error } = await ontologyDB.insertConceptVersion({
      conceptType, code, tenantId, version, defaultLabel, description: description || null,
      textType: input.textType, uiGrouping: input.uiGrouping, status: "Draft",
      authorId, authorBadge,
    });
    if (error || !created) throw error ?? new Error("failed to add concept");
    await eventBus.publish({
      eventType: "ConceptCreated",
      originatingObjectType: "Ontology",
      originatingObjectId: created.id,
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      payload: {
        conceptType, code, version, tenantId,
        defaultLabel, description: description || null,
        textType: created.text_type, uiGrouping: created.ui_grouping,
      },
      actorId: authorId,
      authorityBadge: authorBadge,
    });
    return created;
  }

  return createConceptVersion({ conceptType, code, tenantId, defaultLabel, description: description || null, textType: input.textType, uiGrouping: input.uiGrouping }, actor);
}

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

  const { authorId, authorBadge } = await resolveAuthor(actor);
  const { data: created, error } = await ontologyDB.insertConceptVersion({
    conceptType: input.conceptType, code: input.code, tenantId: input.tenantId, version: nextVersion,
    defaultLabel: input.defaultLabel, description: input.description, contributedByPack: input.contributedByPack ?? null,
    compositionStrategy: input.compositionStrategy ?? null, compositionSources: input.compositionSources ?? [],
    textType: input.textType ?? base?.text_type ?? "markdown",
    uiGrouping: input.uiGrouping !== undefined ? input.uiGrouping : (base?.ui_grouping ?? null),
    authorId, authorBadge,
  });
  if (error || !created) throw error ?? new Error("failed to create concept version");

  await eventBus.publish({
    eventType: latest ? "ConceptUpdated" : "ConceptCreated",
    originatingObjectType: "Ontology",
    originatingObjectId: created.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { conceptType: input.conceptType, code: input.code, version: nextVersion },
    actorId: authorId,
    authorityBadge: authorBadge,
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
      actorId: authorId,
      authorityBadge: authorBadge,
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

async function transitionConcept(
  conceptType: string, code: string, targetTenantId: string,
  toState: "Deprecated" | "Retired" | "Archived" | "Active" | "Draft",
  actor: OntologyActor,
  opts?: { comment?: string }
): Promise<OntologyConceptRow> {
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

  const trimmedComment = opts?.comment?.trim() ?? "";
  if (fromState === "Draft" && toState === "Draft") {
    if (!trimmedComment) {
      throw new Error("Rejecting requires feedback — provide a comment explaining what needs to change.");
    }
    const { data: existingComments } = await ontologyDB.getConceptComments(concept.id);
    const mostRecent = existingComments?.[existingComments.length - 1];
    if (mostRecent && mostRecent.comment_text.trim() === trimmedComment) {
      throw new Error("Provide new feedback — this matches the most recent comment already on record.");
    }
  }

  const { data: updated, error } = await ontologyDB.updateConceptStatus(concept.id, toState);
  if (error || !updated) throw error ?? new Error("failed to update concept status");

  if (fromState === "Draft" && toState === "Draft") {
    await ontologyDB.addConceptComment(concept.id, actor.actorId, trimmedComment);
  }

  const { authorId } = await resolveAuthor(actor);
  await eventBus.publish({
    eventType: gate.eventType ?? `OntologyConcept${toState}`,
    originatingObjectType: "Ontology",
    originatingObjectId: concept.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { conceptType, code, fromState, toState, version: concept.version },
    actorId: authorId,
    authorityBadge: gate.authorityBadge ?? "root",
    versionEvent: gate.versionEvent,
    fromState,
    toState,
    tenantId: targetTenantId,
  });

  return updated;
}

export async function deprecateConcept(conceptType: string, code: string, targetTenantId: string, actor: OntologyActor) {
  return transitionConcept(conceptType, code, targetTenantId, "Deprecated", actor);
}

export async function retireConcept(conceptType: string, code: string, targetTenantId: string, actor: OntologyActor) {
  return transitionConcept(conceptType, code, targetTenantId, "Retired", actor);
}

export async function archiveConcept(conceptType: string, code: string, targetTenantId: string, actor: OntologyActor) {
  return transitionConcept(conceptType, code, targetTenantId, "Archived", actor);
}

export async function approveConcept(conceptType: string, code: string, targetTenantId: string, actor: OntologyActor) {
  return transitionConcept(conceptType, code, targetTenantId, "Active", actor);
}

export async function rejectConcept(conceptType: string, code: string, targetTenantId: string, comment: string, actor: OntologyActor) {
  return transitionConcept(conceptType, code, targetTenantId, "Draft", actor, { comment });
}

export async function listDraftConceptsForApproval(actor: OntologyActor): Promise<OntologyConceptRow[]> {
  const { data } = await ontologyDB.findDraftConcepts({ isRoot: actor.isRoot, tenantId: actor.tenantId });
  return data ?? [];
}

export async function quickRetireConcept(conceptType: string, code: string, targetTenantId: string, actor: OntologyActor): Promise<OntologyConceptRow> {
  await deprecateConcept(conceptType, code, targetTenantId, actor);
  return retireConcept(conceptType, code, targetTenantId, actor);
}

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

  const { authorId, authorBadge } = await resolveAuthor(actor);
  await eventBus.publish({
    eventType: "ConceptUpdated",
    originatingObjectType: "Ontology",
    originatingObjectId: updated.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { conceptType, code, version: updated.version, textType: updated.text_type, uiGrouping: updated.ui_grouping },
    actorId: authorId,
    authorityBadge: authorBadge,
  });

  return updated;
}

export async function listAllConceptsForPicker(viewer: OntologyViewer) {
  const { data } = await ontologyDB.findAllActiveConcepts(viewer);
  return data ?? [];
}

export async function listDistinctUiGroupings(viewer: OntologyViewer): Promise<string[]> {
  const { data } = await ontologyDB.findDistinctUiGroupings(viewer);
  return data ?? [];
}

export async function syncConceptFromEntity(conceptType: string, code: string, defaultLabel: string, description: string | null, tenantId: string, actorId: string): Promise<OntologyConceptRow> {
  return createConceptVersion({ conceptType, code, tenantId, defaultLabel, description }, { isRoot: true, tenantId, actorId, actorBadge: "root" });
}

export async function retireConceptForEntity(conceptType: string, code: string, tenantId: string, actorId: string, actorBadge: string): Promise<void> {
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
    actorId: actorId,
    authorityBadge: actorBadge,
  });
}

export async function composeConcept(
  input: { conceptType: string; code: string; strategy: "specialization" | "override"; sourceConceptId?: string; defaultLabel?: string; description?: string; targetTenantId?: string },
  actor: OntologyActor
): Promise<OntologyConceptRow> {
  const conceptType = input.conceptType.trim();
  const code = input.code.trim();
  assertOntologyCodeFormat("concept type", conceptType);
  assertOntologyCodeFormat("code", code);
  const tenantId = actor.isRoot ? (input.targetTenantId ?? (await getPlatformTenantId())) : actor.tenantId;
  if (!tenantId) throw new Error("no tenant to compose this concept into");

  let result: OntologyConceptRow;
  let composedFrom: string[];

  if (input.strategy === "override") {
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
    actorId: actor.actorId,
    authorityBadge: actor.actorBadge,
  });

  return result;
}

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

export async function resolveLabel(tenantId: string | null, conceptType: string, code: string): Promise<string> {
  const labels = await resolveLabels(tenantId, conceptType);
  return labels[code] ?? code;
}

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
