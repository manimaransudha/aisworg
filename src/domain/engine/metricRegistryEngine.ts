import { metricDefinitionsDB } from "../../dblayer/metricDefinitionsDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { qualityGateEvaluationsDB } from "../../dblayer/qualityGateEvaluationsDB.js";
import { runtimeTelemetryDB } from "../../dblayer/runtimeTelemetryDB.js";
import { knowledgeItemsDB } from "../../dblayer/knowledgeItemsDB.js";
import { evidenceDB } from "../../dblayer/evidenceDB.js";
import { eventBus } from "./eventBus.js";
import { userDB } from "../../dblayer/userDB.js";
import type { AcquisitionScope, DeliverableCycleTimeRow, DispatchLatencyRow, MetricDefinitionRow, QualityGateLatencyRow, ReworkRow, WorkItemDurationRow } from "../../dblayer/seuTypes.js";

export interface FlowMetricsValue {
  deliverableCycleTimes: DeliverableCycleTimeRow[];
  averageCycleTimeSeconds: number | null;
}

export interface GateLatencySummary {
  qualityGateId: string;
  gateName: string;
  averageLatencySeconds: number;
  sampleCount: number;
}

export interface GovernanceMetricsValue {
  qualityGateLatencies: QualityGateLatencyRow[];
  latencyByGate: GateLatencySummary[];
}

export interface MetricScope {
  seuId?: string;
}

async function deliverableCycleTime(scope: MetricScope): Promise<FlowMetricsValue> {
  const { data } = await deliverablesDB.findCycleTimes(scope.seuId);
  const rows = data ?? [];
  const averageCycleTimeSeconds = rows.length === 0 ? null : rows.reduce((sum, r) => sum + r.cycle_time_seconds, 0) / rows.length;
  return { deliverableCycleTimes: rows, averageCycleTimeSeconds };
}

async function qualityGateLatency(scope: MetricScope): Promise<GovernanceMetricsValue> {
  const { data } = await qualityGateEvaluationsDB.findLatencies(scope.seuId);
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

export interface CommandVolumeValue {
  commandsGenerated: number;
}

async function commandGenerationCount(scope: MetricScope): Promise<CommandVolumeValue> {
  const { data } = await runtimeTelemetryDB.countCommandsGenerated(scope.seuId);
  return { commandsGenerated: data ?? 0 };
}

export interface DispatchLatencyValue {
  dispatchLatencies: DispatchLatencyRow[];
  averageDispatchLatencySeconds: number | null;
}

async function dispatchLatency(scope: MetricScope): Promise<DispatchLatencyValue> {
  const { data } = await runtimeTelemetryDB.findDispatchLatencies(scope.seuId);
  const rows = data ?? [];
  const averageDispatchLatencySeconds = rows.length === 0 ? null : rows.reduce((sum, r) => sum + r.latency_seconds, 0) / rows.length;
  return { dispatchLatencies: rows, averageDispatchLatencySeconds };
}

export interface WorkItemDurationValue {
  workItemDurations: WorkItemDurationRow[];
  averageDurationSeconds: number | null;
}

async function workItemDuration(scope: MetricScope): Promise<WorkItemDurationValue> {
  const { data } = await runtimeTelemetryDB.findWorkItemDurations(scope.seuId);
  const rows = data ?? [];
  const averageDurationSeconds = rows.length === 0 ? null : rows.reduce((sum, r) => sum + r.duration_seconds, 0) / rows.length;
  return { workItemDurations: rows, averageDurationSeconds };
}

export interface KnowledgeGrowthValue {
  totalKnowledgeItems: number;
  byAcquisitionScope: Record<AcquisitionScope, number>;
}

async function knowledgeGrowth(scope: MetricScope): Promise<KnowledgeGrowthValue> {
  const { data } = await knowledgeItemsDB.countByAcquisitionScope(scope.seuId);
  const byAcquisitionScope = data ?? { SEU: 0, Capability: 0, Enterprise: 0, Platform: 0 };
  const totalKnowledgeItems = Object.values(byAcquisitionScope).reduce((sum, n) => sum + n, 0);
  return { totalKnowledgeItems, byAcquisitionScope };
}

export interface EvidenceGenerationValue {
  evidenceGenerated: number;
}

async function evidenceGeneration(scope: MetricScope): Promise<EvidenceGenerationValue> {
  const { data } = await evidenceDB.count(scope.seuId);
  return { evidenceGenerated: data ?? 0 };
}

export interface ReworkRateValue {
  reworkEntities: ReworkRow[];
  totalEntitiesMeasured: number;
  entitiesNeedingRework: number;
  reworkRate: number | null;
  averageBlockedAttempts: number | null;
}

async function reworkRate(scope: MetricScope): Promise<ReworkRateValue> {
  const { data } = await qualityGateEvaluationsDB.findReworkByEntity(scope.seuId);
  const rows = data ?? [];
  const totalEntitiesMeasured = rows.length;
  const entitiesNeedingRework = rows.filter((r) => r.blocked_count > 0).length;
  const reworkRateValue = totalEntitiesMeasured === 0 ? null : entitiesNeedingRework / totalEntitiesMeasured;
  const averageBlockedAttempts = totalEntitiesMeasured === 0 ? null : rows.reduce((sum, r) => sum + r.blocked_count, 0) / totalEntitiesMeasured;
  return { reworkEntities: rows, totalEntitiesMeasured, entitiesNeedingRework, reworkRate: reworkRateValue, averageBlockedAttempts };
}

export interface AcceptanceRateValue {
  byLifecycleState: Record<string, number>;
  totalDeliverables: number;
  acceptanceRate: number | null;
}

async function deliverableAcceptanceRate(scope: MetricScope): Promise<AcceptanceRateValue> {
  const { data } = await deliverablesDB.findLifecycleStateDistribution(scope.seuId);
  const byLifecycleState = data ?? {};
  const totalDeliverables = Object.values(byLifecycleState).reduce((sum, n) => sum + n, 0);
  const acceptanceRate = totalDeliverables === 0 ? null : (byLifecycleState["Baselined"] ?? 0) / totalDeliverables;
  return { byLifecycleState, totalDeliverables, acceptanceRate };
}

const CALCULATION_METHODS: Record<string, (scope: MetricScope) => Promise<unknown>> = {
  deliverable_cycle_time: deliverableCycleTime,
  quality_gate_latency: qualityGateLatency,
  command_generation_count: commandGenerationCount,
  dispatch_latency: dispatchLatency,
  work_item_duration: workItemDuration,
  knowledge_growth: knowledgeGrowth,
  evidence_generation: evidenceGeneration,
  rework_rate: reworkRate,
  deliverable_acceptance_rate: deliverableAcceptanceRate,
};

export type MetricComputationResult =
  | { outcome: "Computed"; definition: MetricDefinitionRow; value: unknown }
  | { outcome: "NotFound" }
  | { outcome: "UnrecognisedMethod"; definition: MetricDefinitionRow };

export const metricRegistryEngine = {
  async compute(identifier: string, scope: MetricScope = {}): Promise<MetricComputationResult> {
    const { data: definition } = await metricDefinitionsDB.findByIdentifier(identifier);
    if (!definition) return { outcome: "NotFound" };

    const method = CALCULATION_METHODS[definition.calculation_method];
    if (!method) {
      return { outcome: "UnrecognisedMethod", definition };
    }

    const value = await method(scope);

    const { actorId: metricActorId, actorBadge: metricActorBadge } = await userDB.getSuperuserId();
    await eventBus.publish({
      eventType: "MetricCalculated",
      originatingObjectType: "MetricDefinition",
      originatingObjectId: definition.id,
      seuId: scope.seuId ?? null,
      correlationId: eventBus.newCorrelationId(),
      actorId: metricActorId,
      authorityBadge: metricActorBadge,
      payload: { identifier: definition.identifier, category: definition.category },
    });

    return { outcome: "Computed", definition, value };
  },
};
