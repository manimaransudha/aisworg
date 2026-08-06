// SDK UI Layer Plan — "Schema Registry" section. A new version is additive,
// never mutates an existing one: "an instance declares which one it was
// authored against, and gets checked against exactly that pair, permanently
// ... evolution is additive to what's possible going forward, not
// retroactive to what already exists." createSchemaVersion enforces exactly
// that — it can only ever INSERT a new (entity_kind, version) row, never
// touch an existing one (schemaDefinitionsDB has no update function at all).
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import type { SchemaDefinitionEntityKind, SchemaDefinitionRow } from "../../../dblayer/seuTypes.js";

export const SCHEMA_ENTITY_KINDS: SchemaDefinitionEntityKind[] = ["Pack", "Template", "Profile", "TransitionDefinition"];

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
export async function createSchemaVersion(input: { entityKind: string; schemaJson: string }): Promise<CreateSchemaVersionResult> {
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

  const kind = input.entityKind as SchemaDefinitionEntityKind;
  const { data: existing } = await schemaDefinitionsDB.findLatest(kind);
  const nextVersion = (existing?.version ?? 0) + 1;

  const { data: schema, error } = await schemaDefinitionsDB.create({ entityKind: kind, version: nextVersion, schema: parsed as Record<string, unknown> });
  if (error || !schema) return { ok: false, errors: [(error ?? new Error("failed to create schema version")).message] };
  return { ok: true, schema };
}
