import { schemaDefinitionsDB } from "../dblayer/schemaDefinitionsDB.js";
import { getEntityAdapter } from "../domain/engine/entityAdapters.js";
import type { JsonSchemaDocument } from "../domain/sdk/formGenerator.js";
import type { TransitionEntityType } from "../dblayer/seuTypes.js";
import type { PolicyImplementationInput } from "./index.js";

// Every composable value of an entity exists in the Ontology, checked against the schema version the row pinned (CR-128). Only the entity adapter knows which fields are composable.
export async function ontologyValuesPresent(input: PolicyImplementationInput): Promise<boolean> {
  if (!input.entityId) throw new Error("policy-ontology-values-present needs the id of the entity");
  const adapter = getEntityAdapter(input.entityType as TransitionEntityType);
  if (!adapter.schemaDefinitionId || !adapter.composableFields) throw new Error(`the ${input.entityType} adapter does not expose its schema and composable fields`);
  const row = await adapter.findById(input.entityId);
  if (!row) throw new Error(`${input.entityType} ${input.entityId} not found`);
  const schemaId = adapter.schemaDefinitionId(row);
  if (!schemaId) return false;
  const { data: schema } = await schemaDefinitionsDB.findById(schemaId);
  if (!schema) return false;
  // Loaded when called: routes/seu/core/ontology.ts imports the transition engine, which imports this registry.
  const { validateComposableFieldsAgainstSchema } = await import("../routes/seu/core/ontology.js");
  const errors = await validateComposableFieldsAgainstSchema(schema.schema as JsonSchemaDocument, adapter.composableFields(row), { isRoot: false, tenantId: adapter.tenantId(row) as string });
  return errors.length === 0;
}
