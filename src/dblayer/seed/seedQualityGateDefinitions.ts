import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool, { bulkInsert } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { getPlatformTenantId } from "../constants.js";
import { schemaDefinitionsDB } from "../schemaDefinitionsDB.js";
import { userDB } from "../userDB.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");

interface QualityGateDefinitionSeedFile {
  code: string;
  name: string;
  description?: string;
  category: string;
  criteriaType: string;
  evidenceCategory?: string;
  version: string;
}

const QUALITY_GATE_DEFINITION_FILES = [
  "quality-gate-no-unresolved-obligations.json",
  "quality-gate-accepted-evidence-or-approved-decision.json",
  "quality-gate-fixture-quality-gate.json",
];

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

// The Platform's Quality Gate Definitions, Active and Platform-owned, written in one batch. The Ontology values they name are checked by the Pack and the
// definition authoring paths, and this seed reads no Ontology.
export async function seedQualityGateDefinitions(actor: SeedActor): Promise<void> {
  const platformTenantId = await getPlatformTenantId();
  const { data: qualityGateSchema, error: schemaError } = await schemaDefinitionsDB.findLatest("QualityGate");
  if (schemaError) throw schemaError;
  if (!qualityGateSchema) throw new Error("[seed:quality-gate-definitions] no schema_definitions grammar for QualityGate -- seed the schema definitions first");
  const seeds = QUALITY_GATE_DEFINITION_FILES.map((file) => JSON.parse(readFileSync(path.join(dataDir, file), "utf8")) as QualityGateDefinitionSeedFile);
  const rows = seeds.map((s) => [
    s.code, s.name, s.description ?? null, s.category, s.criteriaType, s.evidenceCategory ?? null,
    s.version, "Active", JSON.stringify(s), platformTenantId, actor.authoredBy, actor.authorBadge, qualityGateSchema.id,
  ]);
  await bulkInsert(
    "quality_gate_definitions",
    [
      "code", "name", "description", "category", "criteria_type", "evidence_category",
      "version", "status", "draft_content", "tenant_id", "authored_by", "author_badge", "schema_definition_id",
    ],
    rows,
    {
      onConflict: `ON CONFLICT (code, version, tenant_id) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
        criteria_type = EXCLUDED.criteria_type, evidence_category = EXCLUDED.evidence_category, draft_content = EXCLUDED.draft_content,
        schema_definition_id = EXCLUDED.schema_definition_id`,
    }
  );
  logger.info(`[seed:quality-gate-definitions] ${rows.length} Quality Gate Definitions seeded (Active, Platform-owned).`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error(`Provision a superuser before this operation.`);
  seedQualityGateDefinitions({ authoredBy: actorId, authorBadge: actorBadge })
    .catch((err) => {
      logger.error("[seed:quality-gate-definitions] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
