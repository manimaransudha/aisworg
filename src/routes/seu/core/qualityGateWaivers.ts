// CR-058 §13 — Quality Gate Waivers. Modeled on core/compliance.ts's
// grantWaiver, with one deliberate difference: badge-gated. Compliance's own
// waiver mechanism has no authority check at all (grantedBy is just whoever
// the session user happens to be) — found while designing this CR and
// explicitly not mirrored, since every other governed action on this
// platform requires a real noun_verb badge (CR-006).
import { qualityGatesDB } from "../../../dblayer/qualityGatesDB.js";
import { qualityGateWaiversDB } from "../../../dblayer/qualityGateWaiversDB.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { QualityGateWaiverRow } from "../../../dblayer/seuTypes.js";

const QUALITY_GATE_WAIVE_BADGE = "qualitygate_waive";

export type GrantQualityGateWaiverResult = { ok: true; waiver: QualityGateWaiverRow } | { ok: false; reason: string };

export async function grantQualityGateWaiver(input: {
  qualityGateId: string;
  seuId: string;
  entityType: string;
  entityId: string;
  rationale: string;
  actorId: string;
  grantedBy: number | null;
  expiresAt?: string | null;
}): Promise<GrantQualityGateWaiverResult> {
  if (!input.rationale?.trim()) return { ok: false, reason: "rationale is required" };

  const authority = await badgeAuthorityEngine.authorise({ actorId: input.actorId, requiredBadge: QUALITY_GATE_WAIVE_BADGE });
  if (!authority.allowed) return { ok: false, reason: `missing "${QUALITY_GATE_WAIVE_BADGE}" badge` };

  const { data: gate } = await qualityGatesDB.findByIds([input.qualityGateId]);
  if (!gate || gate.length === 0) return { ok: false, reason: "quality gate not found" };

  const { data: waiver, error } = await qualityGateWaiversDB.grant({
    qualityGateId: input.qualityGateId,
    seuId: input.seuId,
    entityType: input.entityType,
    entityId: input.entityId,
    rationale: input.rationale,
    grantedBy: input.grantedBy,
    authorityBadge: QUALITY_GATE_WAIVE_BADGE,
    expiresAt: input.expiresAt,
  });
  if (error || !waiver) return { ok: false, reason: (error ?? new Error("failed to grant waiver")).message };

  await eventBus.publish({
    eventType: "QualityGateWaiverGranted",
    originatingObjectType: "QualityGate",
    originatingObjectId: input.qualityGateId,
    seuId: input.seuId,
    correlationId: eventBus.newCorrelationId(),
    payload: { entityType: input.entityType, entityId: input.entityId, rationale: input.rationale },
  });

  return { ok: true, waiver };
}

export async function listQualityGateWaivers(seuId: string): Promise<QualityGateWaiverRow[]> {
  const { data } = await qualityGateWaiversDB.findBySeuId(seuId);
  return data ?? [];
}
