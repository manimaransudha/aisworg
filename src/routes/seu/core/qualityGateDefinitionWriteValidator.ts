import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { validateOntologyFieldsAgainstSchema } from "./ontology.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";

export interface QualityGateDefinitionWriteInput {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  governedTransition: string;
  criteriaType: string;
  evidenceCategory?: string | null;
  reviewGateCode?: string | null;
  requiredPolicyCodes?: string[];
  checklistIds?: string[];
  recommendedChecklistIds?: string[];
  applicabilityDeliverableNames?: string[];
  version: string;
  draftContent: Record<string, unknown>;
  tenantId?: string;
  schemaDefinitionId?: string | null;
}

// The form field names of the Quality Gate schema laid over the columns, checked against the schema the row pins.
export async function validateQualityGateDefinitionWriteAgainstSchema(input: QualityGateDefinitionWriteInput): Promise<string[]> {
  const tenantId = input.tenantId ?? (await getPlatformTenantId());

  const { data: schemaRow } = input.schemaDefinitionId
    ? await schemaDefinitionsDB.findById(input.schemaDefinitionId)
    : await schemaDefinitionsDB.findLatest("QualityGate");
  if (!schemaRow) return [`no schema_definitions grammar found for QualityGate`];
  const schema = schemaRow.schema as JsonSchemaDocument;

  const content: Record<string, unknown> = {
    ...input.draftContent,
    code: input.code,
    name: input.name,
    description: input.description ?? "",
    category: input.category,
    governedTransition: input.governedTransition,
    criteriaType: input.criteriaType,
    evidenceCategory: input.evidenceCategory ?? "",
    deliverableName: input.reviewGateCode ?? "",
    requiredPolicyCodes: input.requiredPolicyCodes ?? [],
    checklistIds: input.checklistIds ?? [],
    recommendedChecklistIds: input.recommendedChecklistIds ?? [],
    applicabilityDeliverableNames: input.applicabilityDeliverableNames ?? [],
  };

  const errors: string[] = [];
  errors.push(...validateAgainstSchema(schema, content));
  errors.push(...(await validateOntologyFieldsAgainstSchema(schema, content, { isRoot: false, tenantId })));
  return errors;
}
