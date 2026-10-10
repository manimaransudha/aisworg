import { qualityGateEvaluationsDB } from "../../../dblayer/qualityGateEvaluationsDB.js";
import { obligationsDB } from "../../../dblayer/obligationsDB.js";
import { eventsDB } from "../../../dblayer/eventsDB.js";
import { seuCapabilitiesDB } from "../../../dblayer/seuCapabilitiesDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import {
  metricRegistryEngine,
  type AcceptanceRateValue,
  type CommandVolumeValue,
  type DispatchLatencyValue,
  type EvidenceGenerationValue,
  type FlowMetricsValue,
  type GateLatencySummary,
  type GovernanceMetricsValue,
  type KnowledgeGrowthValue,
  type ReworkRateValue,
  type WorkItemDurationValue,
} from "../../../domain/engine/metricRegistryEngine.js";
import { createObligation } from "./obligations.js";
import { raiseAttentionItem, resolveSystemActor } from "./attentionItems.js";
import type { AcquisitionScope, DispatchLatencyRow, ObligationRow, ReworkRow, TransitionEntityType, WorkItemDurationRow } from "../../../dblayer/seuTypes.js";

export type FlowMetrics = FlowMetricsValue;
export type GovernanceMetrics = GovernanceMetricsValue;
export type { GateLatencySummary };

export interface RuntimeMetrics {
  commandsGenerated: number;
  dispatchLatencies: DispatchLatencyRow[];
  averageDispatchLatencySeconds: number | null;
  workItemDurations: WorkItemDurationRow[];
  averageDurationSeconds: number | null;
}

export interface KnowledgeMetrics {
  totalKnowledgeItems: number;
  byAcquisitionScope: Record<AcquisitionScope, number>;
  evidenceGenerated: number;
}

export interface QualityMetrics {
  reworkEntities: ReworkRow[];
  totalEntitiesMeasured: number;
  entitiesNeedingRework: number;
  reworkRate: number | null;
  averageBlockedAttempts: number | null;
  byLifecycleState: Record<string, number>;
  totalDeliverables: number;
  acceptanceRate: number | null;
}

async function computeMetric<T>(identifier: string, seuId?: string): Promise<T> {
  const result = await metricRegistryEngine.compute(identifier, { seuId });
  if (result.outcome === "NotFound") throw new Error(`no metric_definitions row for identifier "${identifier}" — did migration 017 run?`);
  if (result.outcome === "UnrecognisedMethod") throw new Error(`metric "${identifier}" declares calculation_method "${result.definition.calculation_method}", which metricRegistryEngine doesn't implement`);
  return result.value as T;
}

export async function getFlowMetrics(seuId?: string): Promise<FlowMetrics> {
  return computeMetric<FlowMetrics>("deliverable-cycle-time", seuId);
}

export async function getGovernanceMetrics(seuId?: string): Promise<GovernanceMetrics> {
  return computeMetric<GovernanceMetrics>("quality-gate-latency", seuId);
}

export async function getRuntimeMetrics(seuId?: string): Promise<RuntimeMetrics> {
  const [volume, latency, duration] = await Promise.all([
    computeMetric<CommandVolumeValue>("command-generation-rate", seuId),
    computeMetric<DispatchLatencyValue>("dispatch-latency", seuId),
    computeMetric<WorkItemDurationValue>("work-item-duration", seuId),
  ]);
  return {
    commandsGenerated: volume.commandsGenerated,
    dispatchLatencies: latency.dispatchLatencies,
    averageDispatchLatencySeconds: latency.averageDispatchLatencySeconds,
    workItemDurations: duration.workItemDurations,
    averageDurationSeconds: duration.averageDurationSeconds,
  };
}

export async function getKnowledgeMetrics(seuId?: string): Promise<KnowledgeMetrics> {
  const [growth, evidence] = await Promise.all([
    computeMetric<KnowledgeGrowthValue>("knowledge-growth", seuId),
    computeMetric<EvidenceGenerationValue>("evidence-generation", seuId),
  ]);
  return {
    totalKnowledgeItems: growth.totalKnowledgeItems,
    byAcquisitionScope: growth.byAcquisitionScope,
    evidenceGenerated: evidence.evidenceGenerated,
  };
}

export async function getQualityMetrics(seuId?: string): Promise<QualityMetrics> {
  const [rework, acceptance] = await Promise.all([
    computeMetric<ReworkRateValue>("rework-rate", seuId),
    computeMetric<AcceptanceRateValue>("deliverable-acceptance-rate", seuId),
  ]);
  return {
    reworkEntities: rework.reworkEntities,
    totalEntitiesMeasured: rework.totalEntitiesMeasured,
    entitiesNeedingRework: rework.entitiesNeedingRework,
    reworkRate: rework.reworkRate,
    averageBlockedAttempts: rework.averageBlockedAttempts,
    byLifecycleState: acceptance.byLifecycleState,
    totalDeliverables: acceptance.totalDeliverables,
    acceptanceRate: acceptance.acceptanceRate,
  };
}

const SUSTAINED_BLOCK_THRESHOLD = 3;

export type SustainedPatternCheckResult = { raised: false } | { raised: true; obligation: ObligationRow };

async function raiseSustainedPatternObligation(input: {
  marker: string;
  seuId: string;
  dedupScope?: "seu" | "platform";
  relatedObjectType: TransitionEntityType;
  relatedObjectId: string;
  originatingObjectType: string;
  originatingObjectId: string;
  title: string;
  description: string;
  attentionTitle: string;
  attentionDescription: string;
  eventPayload: Record<string, unknown>;
  origin: string;
}): Promise<SustainedPatternCheckResult> {
  const { data: existingObligations } =
    input.dedupScope === "platform" ? await obligationsDB.findByCategory("Organisational Learning") : await obligationsDB.findBySeuId(input.seuId);
  const alreadyRaised = (existingObligations ?? []).some((o) => o.category === "Organisational Learning" && o.description?.includes(input.marker));
  if (alreadyRaised) return { raised: false };

  const systemActor = await resolveSystemActor(input.seuId);
  const obligation = await createObligation({
    relatedObjectType: input.relatedObjectType,
    relatedObjectId: input.relatedObjectId,
    category: "Organisational Learning",
    title: input.title,
    description: input.description,
    severity: "High",
    origin: input.origin,
    originatingEntityType: input.originatingObjectType,
    originatingEntityId: input.originatingObjectId,
    actorId: systemActor.actorId,
    authorBadge: systemActor.authorBadge,
  });

  await eventBus.publish({
    eventType: "SustainedPatternDetected",
    originatingObjectType: input.originatingObjectType,
    originatingObjectId: input.originatingObjectId,
    seuId: input.seuId,
    correlationId: eventBus.newCorrelationId(),
    actorId: systemActor.actorId,
    authorityBadge: systemActor.authorBadge,
    payload: { ...input.eventPayload, obligationId: obligation.id },
  });

  await raiseAttentionItem({
    seuId: input.seuId,
    category: "Escalation",
    priority: "High",
    title: input.attentionTitle,
    description: input.attentionDescription,
    relatedObjectType: "Obligation",
    relatedObjectId: obligation.id,
    ...(await resolveSystemActor(input.seuId)),
  });

  return { raised: true, obligation };
}

export async function checkSustainedQualityGateBlocking(input: {
  qualityGateId: string;
  gateName: string;
  seuId: string;
  deliverableId: string;
}): Promise<SustainedPatternCheckResult> {
  const { data: blockedCount } = await qualityGateEvaluationsDB.countBlocked(input.qualityGateId, input.seuId);
  if (!blockedCount || blockedCount < SUSTAINED_BLOCK_THRESHOLD) return { raised: false };

  const marker = `qualityGateId:${input.qualityGateId}`;
  return raiseSustainedPatternObligation({
    marker,
    seuId: input.seuId,
    relatedObjectType: "Deliverable",
    relatedObjectId: input.deliverableId,
    originatingObjectType: "QualityGate",
    originatingObjectId: input.qualityGateId,
    title: `Recurring friction: Quality Gate "${input.gateName}" has blocked ${blockedCount} transition attempt(s) in this SEU`,
    description: `Ch.35 §11 sustained-pattern detection (${marker}): this Quality Gate has recorded ${blockedCount} Blocked evaluations in this SEU, at or past the sustained-pattern threshold (${SUSTAINED_BLOCK_THRESHOLD}). Telemetry does not decide the fix — only that the gate's criteria, or the Deliverables reaching it, warrant engineering review (Ch.23 §7 / Ch.35 §11).`,
    attentionTitle: `Sustained pattern: Quality Gate "${input.gateName}" needs review`,
    attentionDescription: `Organisational Learning Obligation was raised after ${blockedCount} Blocked evaluations of this gate in this SEU.`,
    eventPayload: { seuId: input.seuId, blockedCount, threshold: SUSTAINED_BLOCK_THRESHOLD },
    origin: "Quality Gates",
  });
}

export async function checkSustainedPolicyWaivers(): Promise<SustainedPatternCheckResult[]> {
  const { data: waivers } = await eventsDB.countStandardPolicyDeviations();
  const results: SustainedPatternCheckResult[] = [];
  for (const waiver of waivers ?? []) {
    if (waiver.count < SUSTAINED_BLOCK_THRESHOLD) continue;
    const marker = `policyWaiver:${waiver.policy_id}`;
    const result = await raiseSustainedPatternObligation({
      marker,
      seuId: waiver.seu_id,
      relatedObjectType: "SEU",
      relatedObjectId: waiver.seu_id,
      originatingObjectType: "Policy",
      originatingObjectId: waiver.policy_id,
      title: `Recurring waiver: Policy "${waiver.policy_name}" has been waived ${waiver.count} time(s) in this SEU`,
      description: `Ch.35 §11 sustained-pattern detection (${marker}): this Standard Policy's condition has failed ${waiver.count} times in this SEU without blocking (Ch.24 §11), at or past the sustained-pattern threshold (${SUSTAINED_BLOCK_THRESHOLD}). Telemetry does not decide whether the Policy or the engineering practice is wrong — only that it warrants review.`,
      attentionTitle: `Sustained pattern: Policy "${waiver.policy_name}" needs review`,
      attentionDescription: `Organisational Learning Obligation was raised after ${waiver.count} waivers of this Policy in this SEU.`,
      eventPayload: { seuId: waiver.seu_id, policyCode: waiver.policy_code, waivedCount: waiver.count, threshold: SUSTAINED_BLOCK_THRESHOLD },
      origin: "Policies",
    });
    results.push(result);
  }
  return results;
}

export async function checkSustainedCapabilityShortages(): Promise<SustainedPatternCheckResult[]> {
  const { data: shortages } = await seuCapabilitiesDB.findUnfulfilledByCapability();
  const results: SustainedPatternCheckResult[] = [];
  for (const shortage of shortages ?? []) {
    if (shortage.seu_ids.length < SUSTAINED_BLOCK_THRESHOLD) continue;
    const representativeSeuId = shortage.seu_ids[0];
    const marker = `capabilityShortage:${shortage.capability_id}`;
    const result = await raiseSustainedPatternObligation({
      marker,
      seuId: representativeSeuId,
      dedupScope: "platform",
      relatedObjectType: "SEU",
      relatedObjectId: representativeSeuId,
      originatingObjectType: "Capability",
      originatingObjectId: shortage.capability_id,
      title: `Recurring shortage: Capability "${shortage.capability_name}" is unfulfilled across ${shortage.seu_ids.length} SEUs`,
      description: `Ch.35 §11 sustained-pattern detection (${marker}): ${shortage.seu_ids.length} SEUs currently have no Participant fulfilling this Capability, at or past the sustained-pattern threshold (${SUSTAINED_BLOCK_THRESHOLD}). Attached to this SEU as a representative instance — the shortage itself is platform-wide, not specific to this SEU alone.`,
      attentionTitle: `Sustained pattern: Capability "${shortage.capability_name}" is chronically short`,
      attentionDescription: `Organisational Learning Obligation was raised after this Capability sat Unfulfilled across ${shortage.seu_ids.length} SEUs.`,
      eventPayload: { capabilityCode: shortage.capability_code, affectedSeuIds: shortage.seu_ids, threshold: SUSTAINED_BLOCK_THRESHOLD },
      origin: "Telemetry and Knowledge Model",
    });
    results.push(result);
  }
  return results;
}
