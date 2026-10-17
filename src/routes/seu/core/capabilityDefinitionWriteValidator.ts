import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { validateOntologyFieldsAgainstSchema } from "./ontology.js";
import type { CapabilityRole } from "../../../dblayer/seuTypes.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
 
export interface CapabilityDefinitionWriteInput {
  id?: string;
  code: string;
  defaultLabel: string;
  description?: string | null;
  category: string;
  roles?: CapabilityRole[];
  version: string;
  draftContent: Record<string, unknown>;
  tenantId?: string;
  schemaDefinitionId?: string | null;
}

export async function validateCapabilityDefinitionWriteAgainstSchema(input: CapabilityDefinitionWriteInput): Promise<string[]> {
  const tenantId = input.tenantId ?? (await getPlatformTenantId());

  const { data: schemaRow } = input.schemaDefinitionId
    ? await schemaDefinitionsDB.findById(input.schemaDefinitionId)
    : await schemaDefinitionsDB.findLatest("Capability");
  if (!schemaRow) return [`no schema_definitions grammar found for Capability`];
  const schema = schemaRow.schema as JsonSchemaDocument;

  const content: Record<string, unknown> = {
    ...input.draftContent,
    code: input.code,
    defaultLabel: input.defaultLabel,
    description: input.description ?? "",
    category: input.category,
    roles: input.roles ?? [],
  };

  const errors: string[] = [];
  errors.push(...validateAgainstSchema(schema, content));
  errors.push(...(await validateOntologyFieldsAgainstSchema(schema, content, { isRoot: false, tenantId })));


  return errors;
}
