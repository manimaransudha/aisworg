import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { logger } from "../../utils/logger.js";
import { ontologyDB } from "../ontologyDB.js";
import type { OntologyConceptRow } from "../seuTypes.js";
import { getPlatformTenantId } from "../constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

interface TestOntologyConceptSeed {
  concept_type: string;
  code: string;
  default_label: string;
  description: string | null;
  is_mandatory: boolean | null;
  text_type: "text" | "markdown";
  ui_grouping: string | null;
  contributed_by_pack?: string | null;
  version?: string;
  status?: OntologyConceptRow["status"];
  composition_strategy?: OntologyConceptRow["composition_strategy"];
  composition_sources?: OntologyConceptRow["composition_sources"];
}

export async function seedTestOntology(actor: SeedActor): Promise<void> {
  const seeds = JSON.parse(readFileSync(path.join(__dirname, "data", "test-ontology.json"), "utf8")) as TestOntologyConceptSeed[];
  const tenantId = await getPlatformTenantId();

  const seen = new Set<string>();
  const duplicates: string[] = [];
  const rows = seeds.map((s) => {
    const key = `${s.concept_type}|${s.code}|${s.version ?? "1.0.0"}`;
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
    return {
      conceptType: s.concept_type, code: s.code, defaultLabel: s.default_label, description: s.description,
      tenantId, isMandatory: s.is_mandatory, textType: s.text_type, uiGrouping: s.ui_grouping,
      contributedByPack: s.contributed_by_pack, version: s.version, status: s.status, compositionStrategy: s.composition_strategy, compositionSources: s.composition_sources,
      authorId: actor.authoredBy, authorBadge: actor.authorBadge,
    };
  });
  if (duplicates.length) throw new Error(`[seedTestOntology] test-ontology.json has duplicate entries (concept_type|code|version): ${duplicates.join(", ")}`);

  const { error } = await ontologyDB.bulkInsertConceptVersions(rows);
  if (error) throw new Error(`[seedTestOntology] bulk insert failed: ${error.message}`);
  logger.info(`[seedTestOntology] upserted ${seeds.length} test rows`);
}
