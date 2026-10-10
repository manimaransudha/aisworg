import { query, bulkInsert } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ParticipantMasterRow, ParticipantType } from "./seuTypes.js";

type ParticipantMasterInput = {
  tenantId: string;
  type: ParticipantType;
  displayName: string;
  capabilities?: string[];
  competency?: Record<string, Array<{ code: string; proficiency: string }>>;
  cost?: number | null;
  behaviourContext?: Array<{ policy: string; payload: Record<string, unknown> }>;
  authorisedRole?: Array<{ role: string; effective_till: string; seu_ids: string[] }>;
  authorisedBadges?: Array<{ badge: string; effective_till: string; seu_ids: string[] }>;
  isActive?: boolean;
  userId: string | null;
};

const PARTICIPANTS_MASTER_COLUMNS = [
  "tenant_id",
  "type",
  "display_name",
  "capabilities",
  "competency",
  "cost",
  "behaviour_context",
  "authorised_role",
  "authorised_badges",
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
    input.cost ?? null,
    JSON.stringify(input.behaviourContext ?? []),
    JSON.stringify(input.authorisedRole ?? []),
    JSON.stringify(input.authorisedBadges ?? []),
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

  async findByUserId(userId: string): Promise<DbResult<ParticipantMasterRow | null>> {
    try {
      const { rows } = await query<ParticipantMasterRow>("SELECT * FROM participants_master WHERE user_id = $1", [userId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[participantsMasterDB] findByUserId error", err as Error);
      return { error: err as Error };
    }
  },

  async setAuthorisedRole(id: string, authorisedRole: Array<{ role: string; effective_till: string; seu_ids: string[] }>): Promise<DbResult<ParticipantMasterRow>> {
    try {
      const { rows } = await query<ParticipantMasterRow>(
        "UPDATE participants_master SET authorised_role = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [JSON.stringify(authorisedRole), id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[participantsMasterDB] setAuthorisedRole error", err as Error);
      return { error: err as Error };
    }
  },

  async setAuthorisedBadges(id: string, authorisedBadges: Array<{ badge: string; effective_till: string; seu_ids: string[] }>): Promise<DbResult<ParticipantMasterRow>> {
    try {
      const { rows } = await query<ParticipantMasterRow>(
        "UPDATE participants_master SET authorised_badges = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [JSON.stringify(authorisedBadges), id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[participantsMasterDB] setAuthorisedBadges error", err as Error);
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

  async findAll(): Promise<DbResult<ParticipantMasterRow[]>> {
    try {
      const { rows } = await query<ParticipantMasterRow>("SELECT * FROM participants_master ORDER BY tenant_id, created_at");
      return { data: rows };
    } catch (err) {
      logger.error("[participantsMasterDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

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
