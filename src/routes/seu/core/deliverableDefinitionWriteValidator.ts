import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { validateOntologyFieldsAgainstSchema } from "./ontology.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
 
export interface DeliverableDefinitionWriteInput {
  id?: string;
  code: string;
  description?: string | null;
  version: string;
  draftContent: Record<string, unknown>;
  tenantId?: string;
  schemaDefinitionId?: string | null;
}

export async function validateDeliverableDefinitionWriteAgainstSchema(input: DeliverableDefinitionWriteInput): Promise<string[]> {
  const tenantId = input.tenantId ?? (await getPlatformTenantId());

  const { data: schemaRow } = input.schemaDefinitionId
    ? await schemaDefinitionsDB.findById(input.schemaDefinitionId)
    : await schemaDefinitionsDB.findLatest("Deliverable");
  if (!schemaRow) return [`no schema_definitions grammar found for Deliverable`];
  const schema = schemaRow.schema as JsonSchemaDocument;

  const content: Record<string, unknown> = {
    ...input.draftContent,
    code: input.code,
    description: input.description ?? "",
    definitionVersion: input.version,
  };

  const errors: string[] = [];
  errors.push(...validateAgainstSchema(schema, content));
  errors.push(...(await validateOntologyFieldsAgainstSchema(schema, content, { isRoot: false, tenantId })));


  return errors;
}
