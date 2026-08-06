// Ch.35 Engineering Telemetry Model — Post-MVP Phase 7. Deliberately derives
// every metric from existing Phase 3-6 data (events, quality_gate_evaluations,
// deliverables) with no new persisted metric-storage table — ET-002: "No
// engineering metric shall require duplicate data entry." Telemetry is
// observational only (ET-001 "Telemetry is passive"): nothing here ever
// writes to a Deliverable, Command, Obligation etc. except the one narrow,
// chapter-mandated exception in checkSustainedQualityGateBlocking below
// (FR-35.8), which raises an Obligation, not an engineering state change.
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
import { raiseAttentionItem } from "./attentionItems.js";
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

// Engineering Telemetry — Plan, Build order step 1: reads through the
// Metric Registry now (metricRegistryEngine.compute) instead of computing
// directly — same computation, same output shape, so nothing downstream
// (the web/api routes, the dashboard view) needed to change. Proves the
// registry against known-good data before anything new depends on it.
// Build order step 2: seuId narrows to one SEU; omitted keeps the original
// platform-wide pooling.
async function computeMetric<T>(identifier: string, seuId?: string): Promise<T> {
  const result = await metricRegistryEngine.compute(identifier, { seuId });
  if (result.outcome === "NotFound") throw new Error(`no metric_definitions row for identifier "${identifier}" — did migration 017 run?`);
  if (result.outcome === "UnrecognisedMethod") throw new Error(`metric "${identifier}" declares calculation_method "${result.definition.calculation_method}", which metricRegistryEngine doesn't implement`);
  return result.value as T;
}

// Ch.35 §7 Flow Telemetry — "Deliverable cycle time."
export async function getFlowMetrics(seuId?: string): Promise<FlowMetrics> {
  return computeMetric<FlowMetrics>("deliverable-cycle-time", seuId);
}

// Ch.35 §7 Governance Telemetry — "Quality Gate latency": friction, not
// elapsed calendar time — zero for a gate that always passes on first
// attempt, growing with every Blocked evaluation before the eventual Pass.
export async function getGovernanceMetrics(seuId?: string): Promise<GovernanceMetrics> {
  return computeMetric<GovernanceMetrics>("quality-gate-latency", seuId);
}

// Ch.35 §7 Runtime Telemetry — Command generation volume, dispatch latency,
// Work Item execution duration. Participant utilisation deliberately
// excluded (held — see the plan's own reasoning).
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

// Ch.35 §7 Knowledge Telemetry — growth (by Acquisition Scope) and Evidence
// generation. Decision reuse and ontology expansion dropped, not built here
// — see the plan's own reasoning.
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

// Ch.35 §7 Quality Telemetry — rework rate and Deliverable acceptance rate.
// Review effectiveness and defect escape rate held, not built here — see
// the plan's own reasoning (no Review entity, no governed backward
// Deliverable transition).
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

// Ch.35 §11: "What counts as 'sustained' (a threshold count, a time window,
// a statistical trend) is a Pack-contributed policy, not fixed by this
// chapter." MVP simplification: a fixed constant rather than a real
// Pack-configurable policy — the Policy model (Ch.24) governs transitions,
// and repurposing it purely as a config carrier for a value nothing ever
// evaluates would stretch it further than Phase 4-6 have. Revisit once
// Policies gain a general config-carrying role beyond gating transitions.
const SUSTAINED_BLOCK_THRESHOLD = 3;

export type SustainedPatternCheckResult = { raised: false } | { raised: true; obligation: ObligationRow };

// Ch.35 §11 bottleneck analysis: "Where a bottleneck or other measured
// pattern is sustained... Telemetry shall raise an Organisational Learning
// Obligation rather than leave the pattern for engineering judgement to
// notice independently each time." Shared by all three pattern types below
// — Engineering Telemetry — Plan, Build order step 5 generalised this the
// same way SDK UI Layer Plan.md generalised the Quality-Gate mechanism for
// Transition Definition: one mechanism, reused, not bespoke copies per
// pattern type. `marker` is a description substring, not a dedicated column
// — the same "small, searchable, no schema change" tradeoff Phase 6 made
// for scope promotion — so repeat detections of the same pattern don't
// raise duplicate Obligations.
//
// Real bug, fixed 2026-08-06: dedup used to search obligationsDB.findBySeuId
// (input.seuId), which is correct only when seuId is stable across repeated
// checks for the same pattern — true for checkSustainedQualityGateBlocking
// (the real SEU that blocked) and checkSustainedPolicyWaivers (the real SEU
// that waived), but false for checkSustainedCapabilityShortages, whose
// seuId (and relatedObjectId — the same value there) is a shifting "most
// recently affected" representative pick by design. Every time the
// representative shifted, the SEU-scoped dedup search looked at a SEU that
// had never had this Obligation before and missed — confirmed live: 6 real
// chronic shortages had produced 37 Obligations. The only thing actually
// stable across checks for that caller is the capability id baked into
// `marker` itself, which no per-SEU or per-related-object search can reach
// — fixed by adding an explicit `dedupScope`: "seu" (default, unchanged
// behaviour for the other two callers) searches obligationsDB.findBySeuId;
// "platform" searches every Organisational Learning Obligation regardless
// of SEU, for the one caller whose pattern genuinely isn't SEU-scoped.
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
}): Promise<SustainedPatternCheckResult> {
  const { data: existingObligations } =
    input.dedupScope === "platform" ? await obligationsDB.findByCategory("Organisational Learning") : await obligationsDB.findBySeuId(input.seuId);
  const alreadyRaised = (existingObligations ?? []).some((o) => o.category === "Organisational Learning" && o.description?.includes(input.marker));
  if (alreadyRaised) return { raised: false };

  const obligation = await createObligation({
    seuId: input.seuId,
    relatedObjectType: input.relatedObjectType,
    relatedObjectId: input.relatedObjectId,
    category: "Organisational Learning",
    title: input.title,
    description: input.description,
    severity: "High",
  });

  await eventBus.publish({
    eventType: "SustainedPatternDetected",
    originatingObjectType: input.originatingObjectType,
    originatingObjectId: input.originatingObjectId,
    correlationId: eventBus.newCorrelationId(),
    payload: { ...input.eventPayload, obligationId: obligation.id },
  });

  // Ch.34 §7: a sustained organisational pattern is exactly the "Escalation"
  // category ("Requires management attention") — distinct from the
  // per-attempt "Action Required" Attention Item transitionDeliverable
  // already raises for the ordinary blocked-transition case.
  await raiseAttentionItem({
    seuId: input.seuId,
    category: "Escalation",
    priority: "High",
    title: input.attentionTitle,
    description: input.attentionDescription,
    relatedObjectType: "Obligation",
    relatedObjectId: obligation.id,
  });

  return { raised: true, obligation };
}

// Scoped per-SEU (not cross-SEU/platform-wide, which Ch.35 §13's Cross-SEU
// Analytics would need): the resulting Obligation attaches to one SEU and
// one Deliverable (Phase 4's model), so the count that triggers it must be
// measured at that same scope. Ch.35 §11's own primary example ("the
// same...Decision...reached across many Deliverables") doesn't require
// cross-SEU scope to be meaningful either.
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
  });
}

// Ch.35 §11 bottleneck (c) — "a Policy repeatedly waived." Platform-wide
// scan (unlike checkSustainedQualityGateBlocking, this isn't triggered
// inline by one transitioning entity — a waiver doesn't have one obvious
// caller to thread the check through without touching every core/*.ts
// transition* function). Reads transitionEngine.ts's own
// StandardPolicyDeviation event (this step's small prerequisite). Called
// from the Telemetry web dashboard's own GET handler — Telemetry itself is
// the natural trigger point for its own §11 obligation, not a side effect
// buried in an unrelated transition.
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
    });
    results.push(result);
  }
  return results;
}

// Ch.35 §11 bottleneck (d) — "a capability shortage recurring across
// multiple SEUs," the chapter's own genuinely cross-SEU example. Real
// tension resolved here: obligations.seu_id is NOT NULL, so a pattern with
// no single owning SEU still needs one to attach to. Resolution: attach to
// the most recently affected SEU as a representative instance (seu_ids is
// ordered newest-first by seuCapabilitiesDB.findUnfulfilledByCapability),
// with the description naming the true cross-SEU count — the artifact
// lives on one SEU because the schema requires it to, not because the
// pattern is actually specific to that SEU. The representative SEU
// genuinely does shift between checks as new SEUs are commissioned with the
// same unfulfilled Capability, so dedup can't be scoped to it or to
// relatedObjectId (the same shifting value) — dedupScope: "platform" (see
// raiseSustainedPatternObligation's own comment, fixed 2026-08-06) searches
// every Organisational Learning Obligation platform-wide for this caller
// instead, matching on the stable capability id already baked into `marker`.
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
    });
    results.push(result);
  }
  return results;
}
