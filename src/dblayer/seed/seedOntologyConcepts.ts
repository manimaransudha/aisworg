import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { logger } from "../../utils/logger.js";
import { ontologyDB } from "../ontologyDB.js";
import { tenantsDB } from "../tenantsDB.js";
import type { OntologyConceptRow } from "../seuTypes.js";
import { userDB } from "../userDB.js";
import { getPlatformTenantId, INITIAL_VERSION } from "../constants.js";

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
  tenant?: string;
  contributed_by_pack?: string | null;
  version?: string;
  status?: OntologyConceptRow["status"];
  composition_strategy?: OntologyConceptRow["composition_strategy"];
  composition_sources?: OntologyConceptRow["composition_sources"];
}
 
function loadSeeds(): OntologyConceptSeed[] {
  const raw = readFileSync(path.join(__dirname, "data", "ontologyConcepts.json"), "utf8");
  return JSON.parse(raw) as OntologyConceptSeed[];
}

export async function seedOntologyConcepts(actor: SeedActor): Promise<void> {
  const seeds = loadSeeds();

  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  const { data: tenants, error: tenantsError } = await tenantsDB.findAll();
  if (tenantsError) throw new Error(`[seedOntologyConcepts] tenant lookup failed: ${tenantsError.message}`);
  const tenantIdByName = new Map((tenants ?? []).map((t) => [t.name, t.id]));

  const seen = new Set<string>();
  const duplicates: string[] = [];
  const rows = seeds.map((s) => {
      const tenantId = s.tenant === undefined ? PLATFORM_TENANT_ID : tenantIdByName.get(s.tenant);
      if (!tenantId) throw new Error(`[seedOntologyConcepts] ${s.concept_type}|${s.code}: unknown tenant "${s.tenant}"`);
      const key = `${s.concept_type}|${s.code}|${tenantId}|${s.version ?? INITIAL_VERSION}`;
      if (seen.has(key)) duplicates.push(`${s.concept_type}|${s.code}|${s.tenant ?? "(platform)"}|${s.version ?? INITIAL_VERSION}`);
      seen.add(key);
      return {
        conceptType: s.concept_type, code: s.code, defaultLabel: s.default_label, description: s.description,
        tenantId, isMandatory: s.is_mandatory, textType: s.text_type, uiGrouping: s.ui_grouping,
        contributedByPack: s.contributed_by_pack, version: s.version, status: s.status, compositionStrategy: s.composition_strategy, compositionSources: s.composition_sources,
        authorId: actor.authoredBy, authorBadge: actor.authorBadge,
      };
  });
  if (duplicates.length) throw new Error(`[seedOntologyConcepts] ontologyConcepts.json has duplicate entries (concept_type|code|tenant|version): ${duplicates.join(", ")}`);

  const { error } = await ontologyDB.bulkInsertConceptVersions(rows);
  if (error) throw new Error(`[seedOntologyConcepts] bulk insert failed: ${error.message}`);
  logger.info(`[seedOntologyConcepts] upserted ${seeds.length} baseline rows`);
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
