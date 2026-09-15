// CR-098 (Ch.13 §8) — the tenant-scoped, cross-SEU resource registry.
import { query, bulkInsert } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ParticipantMasterRow, ParticipantType } from "./seuTypes.js";

type ParticipantMasterInput = {
  tenantId: string;
  type: ParticipantType;
  displayName: string;
  capabilities?: string[];
  competency?: Record<string, string[]>;
  behaviourContext?: Array<{ policy: string; payload: Record<string, unknown> }>;
  isActive?: boolean;
  userId?: number | null;
};

const PARTICIPANTS_MASTER_COLUMNS = [
  "tenant_id",
  "type",
  "display_name",
  "capabilities",
  "competency",
  "behaviour_context",
  "is_active",
  "user_id",
];

function toRow(input: ParticipantMasterInput): unknown[] {
  return [
    input.tenantId,
    input.type,
    input.displayName,
    JSON.stringify(input.capabilities ?? []),
    JSON.stringify(input.competency ?? {}),
    JSON.stringify(input.behaviourContext ?? []),
    input.isActive ?? true,
    input.userId ?? null,
  ];
}

export const participantsMasterDB = {
  async create(input: ParticipantMasterInput): Promise<DbResult<ParticipantMasterRow>> {
    try {
      const { rows } = await bulkInsert<ParticipantMasterRow>(
        "participants_master",
        PARTICIPANTS_MASTER_COLUMNS,
        [toRow(input)]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[participantsMasterDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async createMany(inputs: ParticipantMasterInput[]): Promise<DbResult<ParticipantMasterRow[]>> {
    if (inputs.length === 0) return { data: [] };
    try {
      const { rows } = await bulkInsert<ParticipantMasterRow>(
        "participants_master",
        PARTICIPANTS_MASTER_COLUMNS,
        inputs.map(toRow)
      );
      return { data: rows };
    } catch (err) {
      logger.error("[participantsMasterDB] createMany error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<ParticipantMasterRow | null>> {
    try {
      const { rows } = await query<ParticipantMasterRow>("SELECT * FROM participants_master WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[participantsMasterDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-103 — resolves the participants_master identity behind a logged-in
  // user, for that user's own "SEUs I'm a Participant on" home page. Only
  // ever set for a Human-type master (migration 195's own user_id comment).
  async findByUserId(userId: number): Promise<DbResult<ParticipantMasterRow | null>> {
    try {
      const { rows } = await query<ParticipantMasterRow>("SELECT * FROM participants_master WHERE user_id = $1", [userId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[participantsMasterDB] findByUserId error", err as Error);
      return { error: err as Error };
    }
  },

  async findByTenantId(tenantId: string): Promise<DbResult<ParticipantMasterRow[]>> {
    try {
      const { rows } = await query<ParticipantMasterRow>("SELECT * FROM participants_master WHERE tenant_id = $1 ORDER BY created_at", [tenantId]);
      return { data: rows };
    } catch (err) {
      logger.error("[participantsMasterDB] findByTenantId error", err as Error);
      return { error: err as Error };
    }
  },

  // Registry page (root/platform view — every tenant's resources).
  async findAll(): Promise<DbResult<ParticipantMasterRow[]>> {
    try {
      const { rows } = await query<ParticipantMasterRow>("SELECT * FROM participants_master ORDER BY tenant_id, created_at");
      return { data: rows };
    } catch (err) {
      logger.error("[participantsMasterDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  // Ch.12 §18.1/§18.4 follow-up (owner: "The Participant name should be a
  // dropdown that gives a list of participants that satisfy the
  // capability... gives a list of available participants") — the SEU
  // detail page's Fulfil form's own candidate list: every active,
  // this-tenant participants_master resource whose capabilities[] already
  // includes the code being fulfilled. `@>` is JSONB containment — capabilities
  // is a bare array of capability-name codes (migration 195).
  async findEligibleForCapability(tenantId: string, capabilityCode: string): Promise<DbResult<ParticipantMasterRow[]>> {
    try {
      const { rows } = await query<ParticipantMasterRow>(
        `SELECT * FROM participants_master
         WHERE tenant_id = $1 AND is_active = TRUE AND capabilities @> $2::jsonb
         ORDER BY display_name`,
        [tenantId, JSON.stringify([capabilityCode])]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[participantsMasterDB] findEligibleForCapability error", err as Error);
      return { error: err as Error };
    }
  },
};
