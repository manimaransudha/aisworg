import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { validateOntologyFieldsAgainstSchema } from "./ontology.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";

export interface ProfileWriteInput {
  id?: string;
  code: string;
  name: string;
  environment: string;
  profileVersion: string;
  draftContent?: Record<string, unknown>;
  tenantId?: string;
  schemaDefinitionId?: string | null;
}

export async function validateProfileWriteAgainstSchema(input: ProfileWriteInput): Promise<string[]> {
  const tenantId = input.tenantId ?? (await getPlatformTenantId());

  const { data: schemaRow } = input.schemaDefinitionId
    ? await schemaDefinitionsDB.findById(input.schemaDefinitionId)
    : await schemaDefinitionsDB.findLatest("Profile");
  if (!schemaRow) return [`no schema_definitions grammar found for Profile`];
  const schema = schemaRow.schema as JsonSchemaDocument;

  const content: Record<string, unknown> = {
    ...input.draftContent,
    code: input.code,
    name: input.name,
    environment: input.environment,
    profileVersion: input.profileVersion,
  };

  const errors: string[] = [];
  errors.push(...validateAgainstSchema(schema, content));
  errors.push(...(await validateOntologyFieldsAgainstSchema(schema, content, { isRoot: false, tenantId })));


  return errors;
}
