import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, MetricDefinitionRow } from "./seuTypes.js";

export const metricDefinitionsDB = {
  async create(input: {
    identifier: string;
    name: string;
    description: string | null;
    category: MetricDefinitionRow["category"];
    unitOfMeasure: string;
    aggregationStrategy: MetricDefinitionRow["aggregation_strategy"];
    calculationMethod: string;
    // author_id/author_badge are NOT NULL on the table -- every caller must
    // resolve and pass its own real actor + badge, never a default/null.
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<MetricDefinitionRow>> {
    try {
      const { rows } = await query<MetricDefinitionRow>(
        `INSERT INTO metric_definitions (identifier, name, description, category, unit_of_measure, aggregation_strategy, calculation_method, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [input.identifier, input.name, input.description, input.category, input.unitOfMeasure, input.aggregationStrategy, input.calculationMethod, input.authorId, input.authorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[metricDefinitionsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findByIdentifier(identifier: string): Promise<DbResult<MetricDefinitionRow | null>> {
    try {
      const { rows } = await query<MetricDefinitionRow>("SELECT * FROM metric_definitions WHERE identifier = $1", [identifier]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[metricDefinitionsDB] findByIdentifier error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<MetricDefinitionRow[]>> {
    try {
      const { rows } = await query<MetricDefinitionRow>("SELECT * FROM metric_definitions ORDER BY category, identifier");
      return { data: rows };
    } catch (err) {
      logger.error("[metricDefinitionsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },
};
