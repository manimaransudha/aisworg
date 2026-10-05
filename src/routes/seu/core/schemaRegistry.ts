// SDK UI Layer Plan — "Schema Registry" section. A new version is additive,
// never mutates an existing one: "an instance declares which one it was
// authored against, and gets checked against exactly that pair, permanently
// ... evolution is additive to what's possible going forward, not
// retroactive to what already exists." createSchemaVersion enforces exactly
// that — it can only ever INSERT a new (entity_kind, version) row, never
// touch an existing one (schemaDefinitionsDB has no update function at all).
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import type { SchemaDefinitionEntityKind, SchemaDefinitionRow } from "../../../dblayer/seuTypes.js";
import { diffSchemaVersions, type SchemaDifference } from "../../../domain/sdk/schemaCompiler.js";
import type { JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";

// author_id (schema_definitions -> participants_master, migration 281) is
// never the raw actorId (a users.id) — same resolution knowledge.ts's own
// resolveParticipantId already does for Knowledge, minus the seuId lookup
// (Schema Definition has no seu_id at all: SDK grammar authoring is
// platform-level, not owned by any one SEU). A user with no participants_master
// row yet resolves to null, which is honest, not an error.
async function resolveAuthorParticipantId(actorId: string): Promise<string> {
  const { data: master } = await participantsMasterDB.findById(actorId);
  if (!master) throw new Error(`No superuser provisioned.`);
  return master.id;
}

// CR-019: TransitionDefinition is authored via the CR-007 /authority form (noun ×
// verb), not a grammar — so it is not a schema-registry authorable kind. Existing
// historical rows remain viewable; no new TransitionDefinition grammar versions.
// Every other SchemaDefinitionEntityKind is schema-registry authorable.
export const SCHEMA_ENTITY_KINDS: SchemaDefinitionEntityKind[] = ["Pack", "Template", "Profile", "Deliverable", "Service", "Policy", "Capability"];

export async function listSchemaDefinitions(): Promise<SchemaDefinitionRow[]> {
  const { data } = await schemaDefinitionsDB.findAll();
  return data ?? [];
}

export async function getSchemaDefinition(id: string): Promise<SchemaDefinitionRow | null> {
  const { data } = await schemaDefinitionsDB.findById(id);
  return data ?? null;
}

export type CreateSchemaVersionResult = { ok: true; schema: SchemaDefinitionRow } | { ok: false; errors: string[] };

// Deliberately not a full JSON Schema (meta-schema) validator — the plan's
// own Schema Registry section calls that out as "not worth chasing for this
// pass." Just enough of a sanity check that a malformed document fails
// loudly here, not silently at the first form-generation attempt against it.
function parseAndValidateSchema(input: { entityKind: string; schemaJson: string }): { ok: true; kind: SchemaDefinitionEntityKind; parsed: JsonSchemaDocument } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!SCHEMA_ENTITY_KINDS.includes(input.entityKind as SchemaDefinitionEntityKind)) {
    errors.push(`entity kind must be one of ${SCHEMA_ENTITY_KINDS.join(", ")}, got "${input.entityKind}"`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.schemaJson);
  } catch (err) {
    return { ok: false, errors: [`invalid JSON: ${(err as Error).message}`] };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    errors.push("schema must be a JSON object");
  } else {
    const properties = (parsed as Record<string, unknown>).properties;
    if (properties !== undefined && (typeof properties !== "object" || properties === null || Array.isArray(properties))) {
      errors.push('schema "properties" must be an object when present');
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, kind: input.entityKind as SchemaDefinitionEntityKind, parsed: parsed as JsonSchemaDocument };
}

export interface SchemaCompatibilityEntry {
  version: number;
  compatible: boolean;
  differences: SchemaDifference[];
}

// CR-114 Compatibility feature — the draft schema checked against every
// existing version of the same entity kind (not just the latest), per
// design/change-requests/CR-114-schema-metadata.md.
async function buildCompatibilityReport(kind: SchemaDefinitionEntityKind, draft: JsonSchemaDocument): Promise<SchemaCompatibilityEntry[]> {
  const { data: existingVersions } = await schemaDefinitionsDB.findAllVersions(kind);
  return (existingVersions ?? []).map((row) => {
    const { compatible, differences } = diffSchemaVersions(row.schema as JsonSchemaDocument, draft);
    return { version: row.version, compatible, differences };
  });
}

export type ReviewSchemaVersionResult =
  | { ok: true; entityKind: SchemaDefinitionEntityKind; schemaJson: string; report: SchemaCompatibilityEntry[] }
  | { ok: false; errors: string[] };

// Review step — computes the draft's compatibility report against every
// existing version of the kind, but writes nothing. The Publish step below
// re-parses and re-computes this from scratch; nothing from here is trusted
// back from the client except the (unchanged) entityKind/schemaJson pair.
export async function reviewSchemaVersion(input: { entityKind: string; schemaJson: string }): Promise<ReviewSchemaVersionResult> {
  const validated = parseAndValidateSchema(input);
  if (!validated.ok) return validated;
  const report = await buildCompatibilityReport(validated.kind, validated.parsed);
  return { ok: true, entityKind: validated.kind, schemaJson: input.schemaJson, report };
}

// Ch.39 §15 auto-advance — Created -> Validated -> Tested -> Packaged. These
// three hops are 'governed'/verb-null (no button, no badge): the SDK's own
// schema validator/test framework/packaging service already ran inline,
// above, before this row ever existed — there is no separate user-triggered
// action for any of them today. Chained the same way commissioning.ts's
// finalizeCommissioning already chains SEU's own ungoverned Pending->
// Configured->Commissioned steps: one transitionEngine.evaluate + DB update
// + eventBus.publish per hop, causationId threaded through.
async function autoAdvanceToPackaged(schema: SchemaDefinitionRow, actorId: string): Promise<SchemaDefinitionRow> {
  const hops: Array<["Created", "Validated"] | ["Validated", "Tested"] | ["Tested", "Packaged"]> = [
    ["Created", "Validated"],
    ["Validated", "Tested"],
    ["Tested", "Packaged"],
  ];
  let current = schema;
  for (const [from, to] of hops) {
    const gate = await transitionEngine.evaluate({ entityType: "SchemaDefinition", fromState: from, toState: to, actorRole: "", actorId, entityId: current.id });
    if (!gate.allowed) throw new Error(`cannot advance ${current.entity_kind} schema v${current.version} from ${from} to ${to}`);
    const { data: updated, error } = await schemaDefinitionsDB.advanceLifecycle(current.id, to, gate.authorityBadge);
    if (error || !updated) throw error ?? new Error(`failed to advance schema ${current.id} to ${to}`);
    current = updated;
    await eventBus.publish({
      eventType: gate.eventType ?? `SchemaDefinition${to}`,
      originatingObjectType: "SchemaDefinition",
      originatingObjectId: current.id,
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      payload: { entityKind: current.entity_kind, version: current.version, fromState: from, toState: to },
      actorId,
      authorityBadge: gate.authorityBadge ?? "root",
      // CR-117 — SchemaDefinition is platform-wide, root-only, not tenant-scoped.
      versionEvent: gate.versionEvent,
      fromState: from,
      toState: to,
      tenantId: null,
    });
  }
  return current;
}

// Creation step — never trusts a compatibility verdict handed back from the
// client; recomputes it against current DB state and only then inserts.
// Lands the row at 'Packaged' (see autoAdvanceToPackaged above); the actual
// user-decision Publish/Reject hop is publishSchemaVersion/
// rejectSchemaVersion below.
//
// Badge-governed like every other write here: this whole router is root-only
// (route_authority, migration 261/280 -- POST /sdk/schema-registry/publish
// requires 'root'), already enforced upstream by routeAuthorityGate before
// this ever runs -- so the real, resolved badge for this Created step is
// 'root' itself, not an invented per-kind schemadefinition_define badge.
export async function createSchemaVersion(input: { entityKind: string; schemaJson: string; actorId: string }): Promise<CreateSchemaVersionResult> {
  const validated = parseAndValidateSchema(input);
  if (!validated.ok) return validated;
  const { kind, parsed } = validated;

  const report = await buildCompatibilityReport(kind, parsed);
  const nextVersion = report.reduce((max, e) => Math.max(max, e.version), 0) + 1;
  const compatibleVersions = report.filter((e) => e.compatible).map((e) => e.version);
  const incompatibleVersions = report.filter((e) => !e.compatible).map((e) => e.version);

  const authorId = await resolveAuthorParticipantId(input.actorId);
  const { data: created, error } = await schemaDefinitionsDB.create({ entityKind: kind, version: nextVersion, schema: parsed as Record<string, unknown>, compatibleVersions, incompatibleVersions, authorId, authorBadge: "root" });
  if (error || !created) return { ok: false, errors: [(error ?? new Error("failed to create schema version")).message] };

  const schema = await autoAdvanceToPackaged(created, input.actorId);
  return { ok: true, schema };
}

export type PublishRejectResult = { ok: true; schema: SchemaDefinitionRow } | { ok: false; error: string };

// The one real, badge-gated, manual decision in this lifecycle — moves a
// Packaged row to Published (verb `publish`, badge schemadefinition_publish)
// or PublicationRejected (verb `reject`, badge schemadefinition_reject).
async function transitionPackagedSchema(id: string, toState: "Published" | "PublicationRejected", actorId: string): Promise<PublishRejectResult> {
  const { data: schema } = await schemaDefinitionsDB.findById(id);
  if (!schema) return { ok: false, error: "Schema version not found." };
  if (schema.lifecycle_state !== "Packaged") return { ok: false, error: `Only a Packaged schema can be moved to ${toState} (this one is ${schema.lifecycle_state}).` };

  if (!actorId) return { ok: false, error: "actorId is required to publish/reject a Schema Definition" };
  const gate = await transitionEngine.evaluate({ entityType: "SchemaDefinition", fromState: "Packaged", toState, actorRole: "", actorId, entityId: id });
  if (!gate.allowed) {
    if (gate.reason === "authority_denied") return { ok: false, error: `requires badge ${gate.authorityRuleCode}` };
    return { ok: false, error: gate.reason };
  }
  if (!gate.authorityBadge) return { ok: false, error: `no authority badge resolved for SchemaDefinition Packaged -> ${toState}` };

  const authorId = await resolveAuthorParticipantId(actorId);
  const { data: updated, error } = await schemaDefinitionsDB.advanceLifecycle(id, toState, gate.authorityBadge, authorId);
  if (error || !updated) return { ok: false, error: (error ?? new Error("failed to update schema")).message };

  await eventBus.publish({
    eventType: gate.eventType ?? `SchemaDefinition${toState}`,
    originatingObjectType: "SchemaDefinition",
    originatingObjectId: id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { entityKind: updated.entity_kind, version: updated.version, fromState: "Packaged", toState },
    actorId,
    authorityBadge: gate.authorityBadge,
    // CR-117
    versionEvent: gate.versionEvent,
    fromState: "Packaged",
    toState,
    tenantId: null,
  });

  return { ok: true, schema: updated };
}

export async function publishSchemaVersion(id: string, actorId: string): Promise<PublishRejectResult> {
  return transitionPackagedSchema(id, "Published", actorId);
}

export async function rejectSchemaVersion(id: string, actorId: string): Promise<PublishRejectResult> {
  return transitionPackagedSchema(id, "PublicationRejected", actorId);
}
