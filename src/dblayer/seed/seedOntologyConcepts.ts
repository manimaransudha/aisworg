import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { query } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { ontologyDB } from "../ontologyDB.js";
import { userDB } from "../userDB.js";
import { getPlatformTenantId } from "../constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

interface OntologyConceptSeed {
  concept_type: string;
  code: string;
  default_label: string;
  description: string | null;
  is_mandatory: boolean | null;
  text_type: "text" | "markdown";
  ui_grouping: string | null;
}
 
function loadSeeds(): OntologyConceptSeed[] {
  const raw = readFileSync(path.join(__dirname, "data", "ontologyConcepts.json"), "utf8");
  return JSON.parse(raw) as OntologyConceptSeed[];
}

export async function seedOntologyConcepts(actor: SeedActor): Promise<void> {
  const seeds = loadSeeds();

  const { rows: existing } = await query<{ concept_type: string; code: string; tenant_id: string }>(
    "SELECT concept_type, code, tenant_id FROM ontology_concepts"
  );
  const existingKeys = new Set(existing.map((r) => `${r.concept_type}|${r.code}`));

  const missing = seeds.filter((s) => !existingKeys.has(`${s.concept_type}|${s.code}`));
  if (missing.length === 0) {
    logger.info("[seedOntologyConcepts] every baseline row already present, nothing to do");
    return;
  }

  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  const { error } = await ontologyDB.bulkInsertConceptVersions(
    missing.map((s) => ({
      conceptType: s.concept_type, code: s.code, defaultLabel: s.default_label, description: s.description,
      tenantId: PLATFORM_TENANT_ID, isMandatory: s.is_mandatory, textType: s.text_type, uiGrouping: s.ui_grouping,
      authorId: actor.authoredBy, authorBadge: actor.authorBadge,
    }))
  );
  if (error) throw new Error(`[seedOntologyConcepts] bulk insert failed: ${error.message}`);
  logger.info(`[seedOntologyConcepts] inserted ${missing.length} baseline rows`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { actorId, actorBadge } = await userDB.getSuperuserId();  
  if (!actorId) throw new Error("No participants_master row for user_id 1 -- log in as root first.");
  seedOntologyConcepts({ authoredBy: actorId, authorBadge: actorBadge })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("[seedOntologyConcepts] failed", err as Error);
      process.exit(1);
    });
}
