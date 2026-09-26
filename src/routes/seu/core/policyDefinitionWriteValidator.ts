// design/design whiteboards.md/schema_implementation.md — write-time schema
// validation for Policy Definition. Lives outside policyDefinitions.ts (not
// inside it) specifically so policyDefinitionsDB.ts can import it without
// importing policyDefinitions.ts, which itself imports policyDefinitionsDB.ts
// — mirrors core/templateWriteValidator.ts exactly.
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { query } from "../../../utils/db.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { validateOntologyFieldsAgainstSchema } from "./ontology.js";
import type { PolicyCondition, PolicyScope } from "../../../dblayer/seuTypes.js";

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

// Runs at every Policy Definition write path (policyDefinitionsDB.createDraft/
// updateDraftContent), not just the sdkAuthoring.ts call site (which already
// calls validatePolicyDefinitionSeed first, unlike Pack/Template/Profile's own
// pre-fix advisory-only web layer — but that's a caller-side gate, not DB-layer
// enforcement; anything bypassing sdkAuthoring.ts writes ungoverned today).
// Pins to the row's own schemaDefinitionId when given (an update), else the
// latest Policy schema (a create). `code`/`name`/`description`/`category`/
// `constraintType`/`applicabilityEnvironments`/`scope`/`conditions` are real
// columns AND schema properties — draftContent alone doesn't carry them, so
// they're merged in here to validate what the row will actually be written
// with.
export async function validatePolicyDefinitionWriteAgainstSchema(input: PolicyDefinitionWriteInput): Promise<string[]> {
  const tenantId = input.tenantId ?? PLATFORM_TENANT_ID;

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

  const { rows: dupRows } = input.id
    ? await query<{ id: string }>(
        "SELECT id FROM policy_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3 AND id != $4",
        [input.code, input.version, tenantId, input.id]
      )
    : await query<{ id: string }>(
        "SELECT id FROM policy_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3",
        [input.code, input.version, tenantId]
      );
  if (dupRows.length > 0) {
    errors.push(`a Policy Definition with code "${input.code}" already exists at version ${input.version} for this tenant`);
  }

  return errors;
}
