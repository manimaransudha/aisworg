// CR-111 — write-time schema validation for Capability Definition. Lives
// outside capabilityDefinitions.ts (not inside it) specifically so
// capabilityDefinitionsDB.ts can import it without importing
// capabilityDefinitions.ts, which itself imports capabilityDefinitionsDB.ts
// — mirrors core/serviceDefinitionWriteValidator.ts exactly.
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { query } from "../../../utils/db.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { validateOntologyFieldsAgainstSchema } from "./ontology.js";
import type { CapabilityRole } from "../../../dblayer/seuTypes.js";

export interface CapabilityDefinitionWriteInput {
  id?: string;
  code: string;
  defaultLabel: string;
  description?: string | null;
  roles?: CapabilityRole[];
  version: string;
  draftContent: Record<string, unknown>;
  tenantId?: string;
  schemaDefinitionId?: string | null;
}

// Runs at every Capability Definition write path (capabilityDefinitionsDB.createDraft/
// updateDraftContent), same discipline as Service/Policy's own write
// validators. Pins to the row's own schemaDefinitionId when given (an
// update), else the latest Capability schema (a create). `code`/
// `defaultLabel`/`description`/`roles` are real columns AND schema
// properties — draftContent alone doesn't carry them, so they're merged in
// here to validate what the row will actually be written with.
export async function validateCapabilityDefinitionWriteAgainstSchema(input: CapabilityDefinitionWriteInput): Promise<string[]> {
  const tenantId = input.tenantId ?? PLATFORM_TENANT_ID;

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
    roles: input.roles ?? [],
  };

  const errors: string[] = [];
  errors.push(...validateAgainstSchema(schema, content));
  errors.push(...(await validateOntologyFieldsAgainstSchema(schema, content, { isRoot: false, tenantId })));

  const { rows: dupRows } = input.id
    ? await query<{ id: string }>(
        "SELECT id FROM capability_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3 AND id != $4",
        [input.code, input.version, tenantId, input.id]
      )
    : await query<{ id: string }>(
        "SELECT id FROM capability_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3",
        [input.code, input.version, tenantId]
      );
  if (dupRows.length > 0) {
    errors.push(`a Capability Definition with code "${input.code}" already exists at version ${input.version} for this tenant`);
  }

  return errors;
}
