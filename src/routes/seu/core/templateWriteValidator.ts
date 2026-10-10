import { query } from "../../../utils/db.js";
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

  const { rows: dupRows } = input.id
    ? await query<{ id: string }>(
        "SELECT id FROM templates WHERE code = $1 AND template_version = $2 AND tenant_id = $3 AND id != $4",
        [input.code, input.templateVersion, tenantId, input.id]
      )
    : await query<{ id: string }>(
        "SELECT id FROM templates WHERE code = $1 AND template_version = $2 AND tenant_id = $3",
        [input.code, input.templateVersion, tenantId]
      );
  if (dupRows.length > 0) {
    errors.push(`a Template with code "${input.code}" already exists at version ${input.templateVersion} for this tenant`);
  }

  return errors;
}
