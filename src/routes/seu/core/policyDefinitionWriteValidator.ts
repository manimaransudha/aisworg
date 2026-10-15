import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { validateOntologyFieldsAgainstSchema } from "./ontology.js";
import type { PolicyCondition, PolicyScope } from "../../../dblayer/seuTypes.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
 
export interface PolicyDefinitionWriteInput {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  constraintType: "Policy" | "Standard";
  applicabilityEnvironments?: string[];
  conditions?: PolicyCondition[];
  scope?: PolicyScope;
  version: string;
  draftContent: Record<string, unknown>;
  tenantId?: string;
  schemaDefinitionId?: string | null;
}

export async function validatePolicyDefinitionWriteAgainstSchema(input: PolicyDefinitionWriteInput): Promise<string[]> {
  const tenantId = input.tenantId ?? (await getPlatformTenantId());

  const { data: schemaRow } = input.schemaDefinitionId
    ? await schemaDefinitionsDB.findById(input.schemaDefinitionId)
    : await schemaDefinitionsDB.findLatest("Policy");
  if (!schemaRow) return [`no schema_definitions grammar found for Policy`];
  const schema = schemaRow.schema as JsonSchemaDocument;

  const content: Record<string, unknown> = {
    ...input.draftContent,
    code: input.code,
    name: input.name,
    description: input.description ?? "",
    category: input.category,
    constraintType: input.constraintType,
    applicabilityEnvironments: input.applicabilityEnvironments ?? [],
    scope: input.scope,
    conditions: input.conditions ?? [],
  };

  const errors: string[] = [];
  errors.push(...validateAgainstSchema(schema, content));
  errors.push(...(await validateOntologyFieldsAgainstSchema(schema, content, { isRoot: false, tenantId })));


  return errors;
}
