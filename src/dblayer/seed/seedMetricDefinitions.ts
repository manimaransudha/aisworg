import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { logger } from "../../utils/logger.js";
import { metricDefinitionsDB } from "../metricDefinitionsDB.js";
import type { MetricDefinitionRow } from "../seuTypes.js";
import { userDB } from "../userDB.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

interface MetricDefinitionSeed {
  identifier: string;
  name: string;
  description?: string | null;
  category: MetricDefinitionRow["category"];
  unit_of_measure: string;
  aggregation_strategy: MetricDefinitionRow["aggregation_strategy"];
  calculation_method: string;
  version?: number;
  originating_pack_id?: string | null;
}

function loadSeeds(): MetricDefinitionSeed[] {
  const raw = readFileSync(path.join(__dirname, "data", "metricDefinitions.json"), "utf8");
  return JSON.parse(raw) as MetricDefinitionSeed[];
}

export async function seedMetricDefinitions(actor: SeedActor): Promise<void> {
  const seeds = loadSeeds();

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const seed of seeds) {
    if (seen.has(seed.identifier)) duplicates.add(seed.identifier);
    seen.add(seed.identifier);
  }
  if (duplicates.size) throw new Error(`[seedMetricDefinitions] duplicate identifier in metricDefinitions.json: ${[...duplicates].join(", ")}`);

  for (const seed of seeds) {
    const { error } = await metricDefinitionsDB.upsert({
      identifier: seed.identifier,
      name: seed.name,
      description: seed.description ?? null,
      category: seed.category,
      unitOfMeasure: seed.unit_of_measure,
      aggregationStrategy: seed.aggregation_strategy,
      calculationMethod: seed.calculation_method,
      version: seed.version ?? 1,
      originatingPackId: seed.originating_pack_id ?? null,
      authorId: actor.authoredBy,
      authorBadge: actor.authorBadge,
    });
    if (error) throw new Error(`[seedMetricDefinitions] failed to upsert "${seed.identifier}": ${error.message}`);
  }
  logger.info(`[seedMetricDefinitions] upserted ${seeds.length} baseline rows`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { actorId, actorBadge } = await userDB.getSuperuserId(); 
  if (!actorId) throw new Error("No participants_master row for user_id 1 -- log in as root first.");
  seedMetricDefinitions({ authoredBy: actorId, authorBadge: actorBadge })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("[seed:event-subscriptions] failed", err as Error);
      process.exit(1);
    });
}
