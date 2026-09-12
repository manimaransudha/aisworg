import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { CapabilityFulfilmentRow, DbResult, FulfilmentStrategy } from "./seuTypes.js";

export const capabilityFulfilmentsDB = {
  async create(input: {
    seuCapabilityId: string;
    participantId: string;
    fulfilmentStrategy?: FulfilmentStrategy;
  }): Promise<DbResult<CapabilityFulfilmentRow>> {
    try {
      const { rows } = await query<CapabilityFulfilmentRow>(
        `INSERT INTO capability_fulfilments (seu_capability_id, participant_id, fulfilment_strategy)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [input.seuCapabilityId, input.participantId, input.fulfilmentStrategy ?? "AI"]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[capabilityFulfilmentsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  // Ch.33 §7's dispatch input — kept as the single most-recently-established
  // active fulfilment for callers that still only want one (dispatchEngine.ts,
  // replaceParticipant). Genuinely the "entire pool" only when a Capability
  // was fulfilled by exactly one Participant; see findActiveManyBySeuCapabilityId
  // below for the real pool now that Fulfil can register several at once
  // (Ch.12 §7 Hybrid/Composite, FR-12.3).
  async findActiveBySeuCapabilityId(seuCapabilityId: string): Promise<DbResult<CapabilityFulfilmentRow | null>> {
    try {
      const { rows } = await query<CapabilityFulfilmentRow>(
        "SELECT * FROM capability_fulfilments WHERE seu_capability_id = $1 AND revoked_at IS NULL ORDER BY established_at DESC LIMIT 1",
        [seuCapabilityId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[capabilityFulfilmentsDB] findActiveBySeuCapabilityId error", err as Error);
      return { error: err as Error };
    }
  },

  // Owner: "The participants dropdown should be multi-select. It chooses as
  // many as it wants as eligible." The real eligible-Participant pool for a
  // Capability (Ch.12 §9) — every active fulfilment, not just the latest.
  async findActiveManyBySeuCapabilityId(seuCapabilityId: string): Promise<DbResult<CapabilityFulfilmentRow[]>> {
    try {
      const { rows } = await query<CapabilityFulfilmentRow>(
        "SELECT * FROM capability_fulfilments WHERE seu_capability_id = $1 AND revoked_at IS NULL ORDER BY established_at",
        [seuCapabilityId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[capabilityFulfilmentsDB] findActiveManyBySeuCapabilityId error", err as Error);
      return { error: err as Error };
    }
  },

  // Participant Lifecycle Governance — Plan, Build order step 4 (Ch.13 §13
  // Replacement): finds the fulfilment a Participant is being replaced out
  // of.
  async findActiveByParticipantId(participantId: string): Promise<DbResult<CapabilityFulfilmentRow | null>> {
    try {
      const { rows } = await query<CapabilityFulfilmentRow>(
        "SELECT * FROM capability_fulfilments WHERE participant_id = $1 AND revoked_at IS NULL ORDER BY established_at DESC LIMIT 1",
        [participantId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[capabilityFulfilmentsDB] findActiveByParticipantId error", err as Error);
      return { error: err as Error };
    }
  },

  // Owner: "the participant dropdown should not show... the ones chosen
  // for replacement." Once a Participant is released from a Capability
  // (releaseParticipants, core/capabilities.ts), nothing about their own
  // capability/competency actually changed — they'd otherwise reappear as
  // "eligible" the moment the Capability reverts to Unfulfilled, defeating
  // the point of replacing them. Every REVOKED fulfilment this exact
  // seu_capability ever had, traced through participants.participant_id
  // (the participants_master FK, migration 195) — not just the most
  // recently revoked one — so a Participant released two rounds ago still
  // never reappears either.
  async findReleasedParticipantMasterIds(seuCapabilityId: string): Promise<DbResult<string[]>> {
    try {
      const { rows } = await query<{ participant_id: string }>(
        `SELECT DISTINCT p.participant_id
           FROM capability_fulfilments cf
           JOIN participants p ON p.id = cf.participant_id
          WHERE cf.seu_capability_id = $1 AND cf.revoked_at IS NOT NULL AND p.participant_id IS NOT NULL`,
        [seuCapabilityId]
      );
      return { data: rows.map((r) => r.participant_id) };
    } catch (err) {
      logger.error("[capabilityFulfilmentsDB] findReleasedParticipantMasterIds error", err as Error);
      return { error: err as Error };
    }
  },

  // Real revoke primitive — the column has existed since 002_seu_platform.sql
  // (every "active" query already filters WHERE revoked_at IS NULL) but
  // nothing ever set it until replacement needed a way to end the old
  // Participant's fulfilment without deleting its history.
  async revoke(id: string): Promise<DbResult<CapabilityFulfilmentRow>> {
    try {
      const { rows } = await query<CapabilityFulfilmentRow>(
        "UPDATE capability_fulfilments SET revoked_at = NOW() WHERE id = $1 RETURNING *",
        [id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[capabilityFulfilmentsDB] revoke error", err as Error);
      return { error: err as Error };
    }
  },
};
