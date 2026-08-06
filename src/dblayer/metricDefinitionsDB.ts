import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, MetricDefinitionRow } from "./seuTypes.js";

export const metricDefinitionsDB = {
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
