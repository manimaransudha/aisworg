import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { query } from "../../utils/db.js";
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
  description: string | null;
  category: MetricDefinitionRow["category"];
  unit_of_measure: string;
  aggregation_strategy: MetricDefinitionRow["aggregation_strategy"];
  calculation_method: string;
}

function loadSeeds(): MetricDefinitionSeed[] {
  const raw = readFileSync(path.join(__dirname, "data", "metricDefinitions.json"), "utf8");
  return JSON.parse(raw) as MetricDefinitionSeed[];
}

export async function seedMetricDefinitions(actor: SeedActor): Promise<void> {
  const seeds = loadSeeds();

  const { rows: existing } = await query<{ identifier: string }>("SELECT identifier FROM metric_definitions");
  const existingIdentifiers = new Set(existing.map((r) => r.identifier));

  const missing = seeds.filter((s) => !existingIdentifiers.has(s.identifier));
  if (missing.length === 0) {
    logger.info("[seedMetricDefinitions] every baseline row already present, nothing to do");
    return;
  }

  for (const seed of missing) {
    const { error } = await metricDefinitionsDB.create({
      identifier: seed.identifier,
      name: seed.name,
      description: seed.description,
      category: seed.category,
      unitOfMeasure: seed.unit_of_measure,
      aggregationStrategy: seed.aggregation_strategy,
      calculationMethod: seed.calculation_method,
      authorId: actor.authoredBy,
      authorBadge: actor.authorBadge,
    });
    if (error) throw new Error(`[seedMetricDefinitions] failed to create "${seed.identifier}": ${error.message}`);
    logger.info(`[seedMetricDefinitions] created "${seed.identifier}"`);
  }
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
