// SDK UI Layer Plan — "Schema Registry" section. A new version is additive,
// never mutates an existing one: "an instance declares which one it was
// authored against, and gets checked against exactly that pair, permanently
// ... evolution is additive to what's possible going forward, not
// retroactive to what already exists." createSchemaVersion enforces exactly
// that — it can only ever INSERT a new (entity_kind, version) row, never
// touch an existing one (schemaDefinitionsDB has no update function at all).
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import type { SchemaDefinitionEntityKind, SchemaDefinitionRow } from "../../../dblayer/seuTypes.js";
import { diffSchemaVersions, type SchemaDifference } from "../../../domain/sdk/schemaCompiler.js";
import type { JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";

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

// Publish step — never trusts a compatibility verdict handed back from the
// client; recomputes it against current DB state and only then inserts.
export async function createSchemaVersion(input: { entityKind: string; schemaJson: string }): Promise<CreateSchemaVersionResult> {
  const validated = parseAndValidateSchema(input);
  if (!validated.ok) return validated;
  const { kind, parsed } = validated;

  const report = await buildCompatibilityReport(kind, parsed);
  const nextVersion = report.reduce((max, e) => Math.max(max, e.version), 0) + 1;
  const compatibleVersions = report.filter((e) => e.compatible).map((e) => e.version);
  const incompatibleVersions = report.filter((e) => !e.compatible).map((e) => e.version);

  const { data: schema, error } = await schemaDefinitionsDB.create({ entityKind: kind, version: nextVersion, schema: parsed as Record<string, unknown>, compatibleVersions, incompatibleVersions });
  if (error || !schema) return { ok: false, errors: [(error ?? new Error("failed to create schema version")).message] };
  return { ok: true, schema };
}
