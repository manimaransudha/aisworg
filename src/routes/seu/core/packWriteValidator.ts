import { query } from "../../../utils/db.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { validateOntologyFieldsAgainstSchema } from "./ontology.js";
import type { PackCategory, PackClassification, PackContributions } from "../../../dblayer/seuTypes.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";

  

export interface PackWriteInput {
  id?: string;
  code: string;
  name: string;
  category: PackCategory;
  packVersion: string;
  installationClassification?: PackClassification;
  contributions: PackContributions;
  compositionStrategy?: string;
  tenantId?: string;
  schemaDefinitionId?: string | null;
}

export async function validatePackWriteAgainstSchema(input: PackWriteInput): Promise<string[]> {
  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  const tenantId = input.tenantId ?? PLATFORM_TENANT_ID;

  const { data: schemaRow } = input.schemaDefinitionId
    ? await schemaDefinitionsDB.findById(input.schemaDefinitionId)
    : await schemaDefinitionsDB.findLatest("Pack");
  if (!schemaRow) return [`no schema_definitions grammar found for Pack`];
  const schema = schemaRow.schema as JsonSchemaDocument;

  const content: Record<string, unknown> = {
    code: input.code,
    name: input.name,
    category: input.category,
    packVersion: input.packVersion,
    installationClassification: input.installationClassification,
    compositionStrategy: input.compositionStrategy,
    contributionCapabilities: input.contributions?.capabilities ?? [],
    contributionCompetencies: input.contributions?.competencies ?? [],
  };

  const errors: string[] = [];
  errors.push(...validateAgainstSchema(schema, content));
  errors.push(...(await validateOntologyFieldsAgainstSchema(schema, content, { isRoot: false, tenantId })));

  const { rows: dupRows } = input.id
    ? await query<{ id: string }>(
        "SELECT id FROM packs WHERE code = $1 AND pack_version = $2 AND tenant_id = $3 AND id != $4",
        [input.code, input.packVersion, tenantId, input.id]
      )
    : await query<{ id: string }>(
        "SELECT id FROM packs WHERE code = $1 AND pack_version = $2 AND tenant_id = $3",
        [input.code, input.packVersion, tenantId]
      );
  if (dupRows.length > 0) {
    errors.push(`a Pack with code "${input.code}" already exists at version ${input.packVersion} for this tenant`);
  }

  return errors;
}
