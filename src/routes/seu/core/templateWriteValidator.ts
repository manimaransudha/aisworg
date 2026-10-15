import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { validateOntologyFieldsAgainstSchema } from "./ontology.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "../../../dblayer/constants.js";
 
export interface TemplateWriteInput {
  id?: string;
  code: string;
  name: string;
  templateVersion: string;
  draftContent: Record<string, unknown>;
  tenantId?: string;
  schemaDefinitionId?: string | null;
}

export async function validateTemplateWriteAgainstSchema(input: TemplateWriteInput): Promise<string[]> {
  const tenantId = input.tenantId ?? (await getPlatformTenantId());

  const { data: schemaRow } = input.schemaDefinitionId
    ? await schemaDefinitionsDB.findById(input.schemaDefinitionId)
    : await schemaDefinitionsDB.findLatest("Template");
  if (!schemaRow) return [`no schema_definitions grammar found for Template`];
  const schema = schemaRow.schema as JsonSchemaDocument;

  const content: Record<string, unknown> = {
    ...input.draftContent,
    code: input.code,
    name: input.name,
    templateVersion: input.templateVersion,
  };

  const errors: string[] = [];
  errors.push(...validateAgainstSchema(schema, content));
  errors.push(...(await validateOntologyFieldsAgainstSchema(schema, content, { isRoot: false, tenantId })));


  return errors;
}
