// design/design whiteboards.md/schema_implementation.md — write-time schema
// validation for Deliverable Definition. Lives outside deliverableDefinitions.ts
// (not inside it) specifically so deliverableDefinitionsDB.ts can import it
// without importing deliverableDefinitions.ts, which itself imports
// deliverableDefinitionsDB.ts — mirrors core/serviceDefinitionWriteValidator.ts
// exactly.
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { query } from "../../../utils/db.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { validateOntologyFieldsAgainstSchema } from "./ontology.js";

export interface DeliverableDefinitionWriteInput {
  id?: string;
  code: string;
  description?: string | null;
  version: string;
  draftContent: Record<string, unknown>;
  tenantId?: string;
  schemaDefinitionId?: string | null;
}

// Runs at every Deliverable Definition write path (deliverableDefinitionsDB.
// createDraft/updateDraftContent), not just the sdkAuthoring.ts call site
// (which already calls validateDeliverableDefinitionSeed first) — that's a
// caller-side gate, not DB-layer enforcement; anything bypassing
// sdkAuthoring.ts (including copyDeliverableDefinitionAsNewDraft and
// reactivateAsNewVersion) writes ungoverned today. The schema itself has no
// x-ontology fields (081_deliverable_definitions.sql — code/description/
// definitionVersion are all plain), so validateOntologyFieldsAgainstSchema
// is a structural no-op here; kept for consistency with every other entity's
// own validator and so a future Ontology-governed field on this schema needs
// no new plumbing.
export async function validateDeliverableDefinitionWriteAgainstSchema(input: DeliverableDefinitionWriteInput): Promise<string[]> {
  const tenantId = input.tenantId ?? PLATFORM_TENANT_ID;

  const { data: schemaRow } = input.schemaDefinitionId
    ? await schemaDefinitionsDB.findById(input.schemaDefinitionId)
    : await schemaDefinitionsDB.findLatest("Deliverable");
  if (!schemaRow) return [`no schema_definitions grammar found for Deliverable`];
  const schema = schemaRow.schema as JsonSchemaDocument;

  const content: Record<string, unknown> = {
    ...input.draftContent,
    code: input.code,
    description: input.description ?? "",
    definitionVersion: input.version,
  };

  const errors: string[] = [];
  errors.push(...validateAgainstSchema(schema, content));
  errors.push(...(await validateOntologyFieldsAgainstSchema(schema, content, { isRoot: false, tenantId })));

  const { rows: dupRows } = input.id
    ? await query<{ id: string }>(
        "SELECT id FROM deliverable_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3 AND id != $4",
        [input.code, input.version, tenantId, input.id]
      )
    : await query<{ id: string }>(
        "SELECT id FROM deliverable_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3",
        [input.code, input.version, tenantId]
      );
  if (dupRows.length > 0) {
    errors.push(`a Deliverable Definition with code "${input.code}" already exists at version ${input.version} for this tenant`);
  }

  return errors;
}
