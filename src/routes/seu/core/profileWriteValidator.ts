// design/design whiteboards.md/schema_implementation.md — write-time schema
// validation for Profile. Lives outside profiles.ts (not inside it)
// specifically so profilesDB.ts can import it without importing profiles.ts,
// which itself imports profilesDB.ts — mirrors core/templateWriteValidator.ts
// exactly.
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { query } from "../../../utils/db.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { validateOntologyFieldsAgainstSchema } from "./ontology.js";

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

// Runs at every Profile write path that carries schema-governed content
// (profilesDB.create/createDraft/updateDraftContent/setDraftContent) — not
// just the two named create*/update*; setDraftContent is the actual seed/
// publish materialisation write, same lesson learned wiring Template's own
// equivalent. Pins to the row's own schemaDefinitionId when given (an
// update), else the latest Profile schema (a create). `code`/`name`/
// `environment`/`profileVersion` are real columns AND schema properties —
// draftContent alone doesn't carry them, so they're merged in here to
// validate what the row will actually be written with.
export async function validateProfileWriteAgainstSchema(input: ProfileWriteInput): Promise<string[]> {
  const tenantId = input.tenantId ?? PLATFORM_TENANT_ID;

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

  const { rows: dupRows } = input.id
    ? await query<{ id: string }>(
        "SELECT id FROM profiles WHERE code = $1 AND profile_version = $2 AND tenant_id = $3 AND id != $4",
        [input.code, input.profileVersion, tenantId, input.id]
      )
    : await query<{ id: string }>(
        "SELECT id FROM profiles WHERE code = $1 AND profile_version = $2 AND tenant_id = $3",
        [input.code, input.profileVersion, tenantId]
      );
  if (dupRows.length > 0) {
    errors.push(`a Profile with code "${input.code}" already exists at version ${input.profileVersion} for this tenant`);
  }

  return errors;
}
