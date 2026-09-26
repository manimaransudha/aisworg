// design/design whiteboards.md/schema_implementation.md — write-time schema
// validation for Service Definition. Lives outside serviceDefinitions.ts (not
// inside it) specifically so serviceDefinitionsDB.ts can import it without
// importing serviceDefinitions.ts, which itself imports serviceDefinitionsDB.ts
// — mirrors core/policyDefinitionWriteValidator.ts exactly.
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { query } from "../../../utils/db.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { validateOntologyFieldsAgainstSchema } from "./ontology.js";
import type { ServiceLevelExpectation } from "../../../dblayer/seuTypes.js";

export interface ServiceDefinitionWriteInput {
  id?: string;
  code: string;
  name: string;
  capabilityCode: string;
  purpose?: string | null;
  inputs?: string[];
  outputs?: string[];
  serviceLevel?: ServiceLevelExpectation[];
  governance?: string | null;
  success?: string | null;
  consumers?: string[];
  version: string;
  draftContent: Record<string, unknown>;
  tenantId?: string;
  schemaDefinitionId?: string | null;
}

// Runs at every Service Definition write path (serviceDefinitionsDB.createDraft/
// updateDraftContent), not just the sdkAuthoring.ts call site (which already
// calls validateServiceDefinitionSeed first, unlike Pack/Template/Profile's own
// pre-fix advisory-only web layer — but that's a caller-side gate, not
// DB-layer enforcement; anything bypassing sdkAuthoring.ts writes ungoverned
// today, including copyServiceDefinitionAsNewDraft). Pins to the row's own
// schemaDefinitionId when given (an update), else the latest Service schema
// (a create). `code`/`name`/`capabilityCode`/`purpose`/`inputs`/`outputs`/
// `serviceLevel`/`governance`/`success`/`consumers` are real columns AND
// schema properties — draftContent alone doesn't carry them, so they're
// merged in here to validate what the row will actually be written with.
export async function validateServiceDefinitionWriteAgainstSchema(input: ServiceDefinitionWriteInput): Promise<string[]> {
  const tenantId = input.tenantId ?? PLATFORM_TENANT_ID;

  const { data: schemaRow } = input.schemaDefinitionId
    ? await schemaDefinitionsDB.findById(input.schemaDefinitionId)
    : await schemaDefinitionsDB.findLatest("Service");
  if (!schemaRow) return [`no schema_definitions grammar found for Service`];
  const schema = schemaRow.schema as JsonSchemaDocument;

  const content: Record<string, unknown> = {
    ...input.draftContent,
    code: input.code,
    name: input.name,
    capabilityCode: input.capabilityCode,
    purpose: input.purpose ?? "",
    inputs: input.inputs ?? [],
    outputs: input.outputs ?? [],
    serviceLevel: input.serviceLevel ?? [],
    governance: input.governance ?? "",
    success: input.success ?? "",
    consumers: input.consumers ?? [],
  };

  const errors: string[] = [];
  errors.push(...validateAgainstSchema(schema, content));
  errors.push(...(await validateOntologyFieldsAgainstSchema(schema, content, { isRoot: false, tenantId })));

  const { rows: dupRows } = input.id
    ? await query<{ id: string }>(
        "SELECT id FROM service_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3 AND id != $4",
        [input.code, input.version, tenantId, input.id]
      )
    : await query<{ id: string }>(
        "SELECT id FROM service_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3",
        [input.code, input.version, tenantId]
      );
  if (dupRows.length > 0) {
    errors.push(`a Service Definition with code "${input.code}" already exists at version ${input.version} for this tenant`);
  }

  return errors;
}
