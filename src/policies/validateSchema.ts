import { schemaDefinitionsDB } from "../dblayer/schemaDefinitionsDB.js";
import { getEntityAdapter } from "../domain/engine/entityAdapters.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../domain/sdk/formGenerator.js";
import type { TransitionEntityType } from "../dblayer/seuTypes.js";
import type { PolicyImplementationInput } from "./index.js";

// The content of any schema-governed entity validates against the schema version its row pinned (CR-128). Only the entity adapter knows the kind.
export async function validateSchema(input: PolicyImplementationInput): Promise<boolean> {
  if (!input.entityId) throw new Error("policy-validate-schema needs the id of the entity");
  const adapter = getEntityAdapter(input.entityType as TransitionEntityType);
  if (!adapter.schemaDefinitionId || !adapter.content) throw new Error(`the ${input.entityType} adapter does not expose its schema and content`);
  const row = await adapter.findById(input.entityId);
  if (!row) throw new Error(`${input.entityType} ${input.entityId} not found`);
  const schemaId = adapter.schemaDefinitionId(row);
  if (!schemaId) return false;
  const { data: schemaRow } = await schemaDefinitionsDB.findById(schemaId);
  if (!schemaRow) return false;
  const schema = schemaRow.schema as JsonSchemaDocument;
  const content = adapter.content(row);
  const tenantId = await adapter.tenantId(row);
  if (validateAgainstSchema(schema, content).length > 0) return false;
  // Loaded when called: routes/seu/core/ontology.ts imports the transition engine, which imports this registry.
  const { validateOntologyFieldsAgainstSchema } = await import("../routes/seu/core/ontology.js");
  if ((await validateOntologyFieldsAgainstSchema(schema, content, { isRoot: false, tenantId: tenantId as string })).length > 0) return false;
  const { validateReferentialFields } = await import("../routes/seu/core/referentialOptions.js");
  return (await validateReferentialFields(schema, content, { isRoot: false, tenantId })).length === 0;
}
