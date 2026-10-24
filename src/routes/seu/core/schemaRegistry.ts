import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import type { SchemaDefinitionEntityKind, SchemaDefinitionRow } from "../../../dblayer/seuTypes.js";
import { diffSchemaVersions, type SchemaDifference } from "../../../domain/sdk/schemaCompiler.js";
import type { JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionEntity, publishTransition } from "../../../domain/engine/entityTransition.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { BIRTH_STATE } from "../../../dblayer/constants.js";

async function resolveAuthorParticipantId(actorId: string): Promise<string> {
  const { data: master } = await participantsMasterDB.findById(actorId);
  if (!master) throw new Error(`No superuser provisioned.`);
  return master.id;
}

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

export async function reviewSchemaVersion(input: { entityKind: string; schemaJson: string }): Promise<ReviewSchemaVersionResult> {
  const validated = parseAndValidateSchema(input);
  if (!validated.ok) return validated;
  const report = await buildCompatibilityReport(validated.kind, validated.parsed);
  return { ok: true, entityKind: validated.kind, schemaJson: input.schemaJson, report };
}

// Follows the governed next transition of the row's state until none remains. The hop order is the data.
async function autoAdvanceGoverned(schema: SchemaDefinitionRow, actorId: string): Promise<SchemaDefinitionRow> {
  let current = schema;
  for (;;) {
    const { data: next, error } = await transitionDefinitionsDB.findPossibleNextTransitions("SchemaDefinition", current.lifecycle_state);
    if (error) throw error;
    const governed = (next ?? []).filter((t) => t.trigger === "governed");
    if (governed.length === 0) return current;
    if (governed.length > 1) throw new Error(`SchemaDefinition state ${current.lifecycle_state} has ${governed.length} governed next transitions: ${governed.map((t) => t.toState).join(", ")}`);
    const result = await transitionEntity({ entityType: "SchemaDefinition", entityId: current.id, targetState: governed[0].toState, actorId });
    if (!result.ok) throw new Error(`cannot advance ${current.entity_kind} schema v${current.version} from ${current.lifecycle_state} to ${governed[0].toState}: ${"detail" in result ? result.detail : result.reason}`);
    await publishTransition(result);
    current = result.row as SchemaDefinitionRow;
  }
}

export async function createSchemaVersion(input: { entityKind: string; schemaJson: string; actorId: string }): Promise<CreateSchemaVersionResult> {
  const validated = parseAndValidateSchema(input);
  if (!validated.ok) return validated;
  const { kind, parsed } = validated;

  const report = await buildCompatibilityReport(kind, parsed);
  const nextVersion = report.reduce((max, e) => Math.max(max, e.version), 0) + 1;
  const compatibleVersions = report.filter((e) => e.compatible).map((e) => e.version);
  const incompatibleVersions = report.filter((e) => !e.compatible).map((e) => e.version);

  const authorId = await resolveAuthorParticipantId(input.actorId);
  const birth = await transitionEngine.beginBirth({ entityType: "SchemaDefinition", actorId: input.actorId });
  const { data: created, error } = await schemaDefinitionsDB.create({
    entityKind: kind,
    version: nextVersion,
    schema: parsed as Record<string, unknown>,
    compatibleVersions,
    incompatibleVersions,
    lifecycleState: birth.initialState as SchemaDefinitionRow["lifecycle_state"],
    authorId,
    authorBadge: birth.authorityBadge,
  });
  if (error || !created) return { ok: false, errors: [(error ?? new Error("failed to create schema version")).message] };

  await eventBus.publish({
    eventType: birth.eventType,
    originatingObjectType: "SchemaDefinition",
    originatingObjectId: created.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { entityKind: created.entity_kind, version: created.version },
    actorId: input.actorId,
    authorityBadge: birth.authorityBadge,
    versionEvent: birth.versionEvent,
    fromState: BIRTH_STATE,
    toState: birth.initialState,
    tenantId: null,
  });

  const schema = await autoAdvanceGoverned(created, input.actorId);
  return { ok: true, schema };
}
