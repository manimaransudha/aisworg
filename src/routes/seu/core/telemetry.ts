// Ch.35 Engineering Telemetry Model — Post-MVP Phase 7. Deliberately derives
// every metric from existing Phase 3-6 data (events, quality_gate_evaluations,
// deliverables) with no new persisted metric-storage table — ET-002: "No
// engineering metric shall require duplicate data entry." Telemetry is
// observational only (ET-001 "Telemetry is passive"): nothing here ever
// writes to a Deliverable, Command, Obligation etc. except the one narrow,
// chapter-mandated exception in checkSustainedQualityGateBlocking below
// (FR-35.8), which raises an Obligation, not an engineering state change.
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { qualityGateEvaluationsDB } from "../../../dblayer/qualityGateEvaluationsDB.js";
import { obligationsDB } from "../../../dblayer/obligationsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { createObligation } from "./obligations.js";
import type { DeliverableCycleTimeRow, ObligationRow, QualityGateLatencyRow } from "../../../dblayer/seuTypes.js";

export interface FlowMetrics {
  deliverableCycleTimes: DeliverableCycleTimeRow[];
  averageCycleTimeSeconds: number | null;
}

// Ch.35 §7 Flow Telemetry — "Deliverable cycle time."
export async function getFlowMetrics(): Promise<FlowMetrics> {
  const { data } = await deliverablesDB.findCycleTimes();
  const rows = data ?? [];
  const averageCycleTimeSeconds = rows.length === 0 ? null : rows.reduce((sum, r) => sum + r.cycle_time_seconds, 0) / rows.length;
  return { deliverableCycleTimes: rows, averageCycleTimeSeconds };
}

export interface GateLatencySummary {
  qualityGateId: string;
  gateName: string;
  averageLatencySeconds: number;
  sampleCount: number;
}

export interface GovernanceMetrics {
  qualityGateLatencies: QualityGateLatencyRow[];
  latencyByGate: GateLatencySummary[];
}

// Ch.35 §7 Governance Telemetry — "Quality Gate latency": friction, not
// elapsed calendar time — zero for a gate that always passes on first
// attempt, growing with every Blocked evaluation before the eventual Pass.
export async function getGovernanceMetrics(): Promise<GovernanceMetrics> {
  const { data } = await qualityGateEvaluationsDB.findLatencies();
  const rows = data ?? [];

  const byGate = new Map<string, { gateName: string; total: number; count: number }>();
  for (const row of rows) {
    const existing = byGate.get(row.quality_gate_id) ?? { gateName: row.gate_name, total: 0, count: 0 };
    existing.total += row.latency_seconds;
    existing.count += 1;
    byGate.set(row.quality_gate_id, existing);
  }
  const latencyByGate: GateLatencySummary[] = [...byGate.entries()].map(([qualityGateId, { gateName, total, count }]) => ({
    qualityGateId,
    gateName,
    averageLatencySeconds: total / count,
    sampleCount: count,
  }));

  return { qualityGateLatencies: rows, latencyByGate };
}

// Ch.35 §11: "What counts as 'sustained' (a threshold count, a time window,
// a statistical trend) is a Pack-contributed policy, not fixed by this
// chapter." MVP simplification: a fixed constant rather than a real
// Pack-configurable policy — the Policy model (Ch.24) governs transitions,
// and repurposing it purely as a config carrier for a value nothing ever
// evaluates would stretch it further than Phase 4-6 have. Revisit once
// Policies gain a general config-carrying role beyond gating transitions.
const SUSTAINED_BLOCK_THRESHOLD = 3;

// Ch.23 §7 / Ch.35 §11: marks which Quality Gate a given Organisational
// Learning Obligation is about, so repeat detections don't raise duplicates.
// A description substring, not a dedicated column — the same "small,
// searchable, no schema change" tradeoff Phase 6 made for scope promotion.
function sustainedPatternMarker(qualityGateId: string): string {
  return `qualityGateId:${qualityGateId}`;
}

export type SustainedPatternCheckResult = { raised: false } | { raised: true; obligation: ObligationRow };

// Ch.35 §11 bottleneck analysis: "Where a bottleneck or other measured
// pattern is sustained... Telemetry shall raise an Organisational Learning
// Obligation rather than leave the pattern for engineering judgement to
// notice independently each time." Scoped per-SEU (not cross-SEU/platform-
// wide, which Ch.35 §13's Cross-SEU Analytics would need): the resulting
// Obligation attaches to one SEU and one Deliverable (Phase 4's model), so
// the count that triggers it must be measured at that same scope. Ch.35 §11's
// own primary example ("the same...Decision...reached across many
// Deliverables") doesn't require cross-SEU scope to be meaningful either.
export async function checkSustainedQualityGateBlocking(input: {
  qualityGateId: string;
  gateName: string;
  seuId: string;
  deliverableId: string;
}): Promise<SustainedPatternCheckResult> {
  const { data: blockedCount } = await qualityGateEvaluationsDB.countBlocked(input.qualityGateId, input.seuId);
  if (!blockedCount || blockedCount < SUSTAINED_BLOCK_THRESHOLD) return { raised: false };

  const marker = sustainedPatternMarker(input.qualityGateId);
  const { data: existingObligations } = await obligationsDB.findBySeuId(input.seuId);
  const alreadyRaised = (existingObligations ?? []).some((o) => o.category === "Organisational Learning" && o.description?.includes(marker));
  if (alreadyRaised) return { raised: false };

  const obligation = await createObligation({
    seuId: input.seuId,
    deliverableId: input.deliverableId,
    category: "Organisational Learning",
    title: `Recurring friction: Quality Gate "${input.gateName}" has blocked ${blockedCount} transition attempt(s) in this SEU`,
    description: `Ch.35 §11 sustained-pattern detection (${marker}): this Quality Gate has recorded ${blockedCount} Blocked evaluations in this SEU, at or past the sustained-pattern threshold (${SUSTAINED_BLOCK_THRESHOLD}). Telemetry does not decide the fix — only that the gate's criteria, or the Deliverables reaching it, warrant engineering review (Ch.23 §7 / Ch.35 §11).`,
    severity: "High",
  });

  await eventBus.publish({
    eventType: "SustainedPatternDetected",
    originatingObjectType: "QualityGate",
    originatingObjectId: input.qualityGateId,
    correlationId: eventBus.newCorrelationId(),
    payload: { seuId: input.seuId, blockedCount, threshold: SUSTAINED_BLOCK_THRESHOLD, obligationId: obligation.id },
  });

  return { raised: true, obligation };
}
