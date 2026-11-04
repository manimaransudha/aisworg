import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
import { generateFields, groupFieldsForDisplay, toSchemaRows, type FieldGroups, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { getAuthoringDraft } from "./sdkAuthoring.js";
import { listConceptsForType } from "./ontology.js";
import { ontologySourcesIn } from "./packView.js";
import type { PolicyDefinitionRow } from "../../../dblayer/seuTypes.js";

export interface PolicyViewData {
  policy: PolicyDefinitionRow;
  // The same tab set as the authoring page: the schema's x-groups.
  groups: FieldGroups;
  content: Record<string, unknown>;
  labels: Record<string, Record<string, string>>;
}

// One Policy Definition for the Registry view page. Returns null when the row does not exist or is not visible to the viewer's tenant.
export async function getPolicyView(id: string, viewer: { isRoot: boolean; tenantId: string | null }): Promise<PolicyViewData | null> {
  const { data: policy, error } = await policyDefinitionsDB.findById(id);
  if (error) throw error;
  if (!policy) return null;
  const platformTenantId = await getPlatformTenantId();
  if (!viewer.isRoot && policy.tenant_id !== platformTenantId && policy.tenant_id !== viewer.tenantId) return null;
  const { data: pinned } = policy.schema_definition_id ? await schemaDefinitionsDB.findById(policy.schema_definition_id) : { data: null };
  const schemaRow = pinned ?? (await schemaDefinitionsDB.findLatest("Policy")).data;
  if (!schemaRow) throw new Error("no schema_definitions grammar for Policy");
  const schema = schemaRow.schema as JsonSchemaDocument;
  const draft = await getAuthoringDraft("Policy", id);
  if (!draft) return null;
  const content = toSchemaRows(schema, draft.content);
  const fields = generateFields(schema, content);
  const labels: Record<string, Record<string, string>> = {};
  for (const source of ontologySourcesIn(fields)) {
    const concepts = await listConceptsForType(source, viewer);
    labels[source] = Object.fromEntries(concepts.map((c) => [c.code, c.default_label]));
  }
  return { policy, groups: groupFieldsForDisplay(schema, fields), content, labels };
}
