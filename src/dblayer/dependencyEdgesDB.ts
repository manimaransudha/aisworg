import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, DependencyEdgeRow, ReadinessState } from "./seuTypes.js";

export const dependencyEdgesDB = {
  async createDeliverableEdge(input: {
    seuId: string;
    fromDeliverableId: string;
    toDeliverableId: string;
    requiredState?: string | null;
  }): Promise<DbResult<DependencyEdgeRow>> {
    try {
      const { rows } = await query<DependencyEdgeRow>(
        `INSERT INTO dependency_edges (seu_id, from_deliverable_id, dependency_type, to_deliverable_id, required_state)
         VALUES ($1, $2, 'Deliverable', $3, $4)
         RETURNING *`,
        [input.seuId, input.fromDeliverableId, input.toDeliverableId, input.requiredState ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[dependencyEdgesDB] createDeliverableEdge error", err as Error);
      return { error: err as Error };
    }
  },

  async createCapabilityEdge(input: {
    seuId: string;
    fromDeliverableId: string;
    toServiceId: string;
    requiredState?: string | null;
  }): Promise<DbResult<DependencyEdgeRow>> {
    try {
      const { rows } = await query<DependencyEdgeRow>(
        `INSERT INTO dependency_edges (seu_id, from_deliverable_id, dependency_type, to_service_id, required_state)
         VALUES ($1, $2, 'Capability', $3, $4)
         RETURNING *`,
        [input.seuId, input.fromDeliverableId, input.toServiceId, input.requiredState ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[dependencyEdgesDB] createCapabilityEdge error", err as Error);
      return { error: err as Error };
    }
  },

  async findByFromDeliverable(deliverableId: string): Promise<DbResult<DependencyEdgeRow[]>> {
    try {
      const { rows } = await query<DependencyEdgeRow>("SELECT * FROM dependency_edges WHERE from_deliverable_id = $1", [deliverableId]);
      return { data: rows };
    } catch (err) {
      logger.error("[dependencyEdgesDB] findByFromDeliverable error", err as Error);
      return { error: err as Error };
    }
  },

  async updateReadiness(id: string, readinessState: ReadinessState): Promise<DbResult<DependencyEdgeRow>> {
    try {
      const { rows } = await query<DependencyEdgeRow>(
        "UPDATE dependency_edges SET readiness_state = $1 WHERE id = $2 RETURNING *",
        [readinessState, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[dependencyEdgesDB] updateReadiness error", err as Error);
      return { error: err as Error };
    }
  },
};
