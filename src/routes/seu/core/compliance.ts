import { seusDB } from "../../../dblayer/seusDB.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { complianceDB } from "../../../dblayer/complianceDB.js";
import { obligationsDB } from "../../../dblayer/obligationsDB.js";
import { evidenceDB } from "../../../dblayer/evidenceDB.js";
import { decisionsDB } from "../../../dblayer/decisionsDB.js";
import { reviewsDB } from "../../../dblayer/reviewsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { resolveAuthor, resolveSystemActor } from "./attentionItems.js";
import type { ComplianceRequirementRow, ComplianceStatus } from "../../../dblayer/seuTypes.js";

const RESOLVED_OBLIGATION_STATUSES = new Set(["Verified", "Closed", "Archived"]);
const QUALIFYING_EVIDENCE_STATUSES = new Set(["Accepted", "Referenced"]);
const QUALIFYING_DECISION_STATUSES = new Set(["Approved", "Applied"]);
const QUALIFYING_REVIEW_OUTCOMES = new Set(["Passed", "Passed with Recommendations"]);

export interface RequirementResult {
  requirementCode: string;
  frameworkCode: string;
  name: string;
  severity: string;
  state: "satisfied" | "unsatisfied" | "waived";
  detail: string;
  supporting: string[];
}

export interface ComplianceConflict {
  requirementCode: string;
  conflictsWith: string;
  detail: string;
}

export interface ComplianceEvaluationResult {
  seuId: string;
  status: ComplianceStatus;
  frameworks: string[];
  results: RequirementResult[];
  conflicts: ComplianceConflict[];
  counts: { total: number; satisfied: number; waived: number; unsatisfied: number };
}

async function composedPackIds(seuId: string): Promise<string[]> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu?.active_ebm_id) return [];
  const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
  const packs = (ebm?.composed_packs as Array<{ packId?: string }> | undefined) ?? [];
  return packs.map((p) => p.packId).filter((id): id is string => typeof id === "string");
}

async function evaluateRequirement(seuId: string, req: ComplianceRequirementRow): Promise<{ satisfied: boolean; detail: string; supporting: string[] }> {
  const criteria = (req.criteria ?? {}) as { type?: string; category?: string };
  const type = criteria.type;
  const category = criteria.category;
  const inCategory = <T extends { category?: string }>(rows: T[]) => (category ? rows.filter((r) => r.category === category) : rows);

  switch (type) {
    case "no_unresolved_obligations": {
      const { data } = await obligationsDB.findBySeuId(seuId);
      const relevant = inCategory(data ?? []);
      const unresolved = relevant.filter((o) => !RESOLVED_OBLIGATION_STATUSES.has(o.status));
      return unresolved.length === 0
        ? { satisfied: true, detail: `no unresolved ${category ?? ""} obligations`.replace("  ", " "), supporting: relevant.map((o) => o.id) }
        : { satisfied: false, detail: `${unresolved.length} unresolved ${category ?? ""} obligation(s)`.replace("  ", " "), supporting: unresolved.map((o) => o.id) };
    }
    case "requires_accepted_evidence": {
      const { data } = await evidenceDB.findBySeuId(seuId);
      const qualifying = inCategory(data ?? []).filter((e) => QUALIFYING_EVIDENCE_STATUSES.has(e.status));
      return qualifying.length > 0
        ? { satisfied: true, detail: `accepted ${category ?? ""} evidence present`.replace("  ", " "), supporting: qualifying.map((e) => e.id) }
        : { satisfied: false, detail: `no accepted ${category ?? ""} evidence`.replace("  ", " "), supporting: [] };
    }
    case "requires_approved_decision": {
      const { data } = await decisionsDB.findBySeuId(seuId);
      const qualifying = inCategory(data ?? []).filter((d) => QUALIFYING_DECISION_STATUSES.has(d.status));
      return qualifying.length > 0
        ? { satisfied: true, detail: `approved ${category ?? ""} decision present`.replace("  ", " "), supporting: qualifying.map((d) => d.id) }
        : { satisfied: false, detail: `no approved ${category ?? ""} decision`.replace("  ", " "), supporting: [] };
    }
    case "requires_accepted_review": {
      const { data } = await reviewsDB.findBySeuId(seuId);
      const qualifying = (data ?? []).filter(
        (r) => r.status === "Accepted" && r.outcome != null && QUALIFYING_REVIEW_OUTCOMES.has(r.outcome) && (!category || r.category === category)
      );
      return qualifying.length > 0
        ? { satisfied: true, detail: `accepted, passing ${category ?? ""} review present`.replace("  ", " "), supporting: qualifying.map((r) => r.id) }
        : { satisfied: false, detail: `no accepted, passing ${category ?? ""} review`.replace("  ", " "), supporting: [] };
    }
    default:
      return { satisfied: false, detail: `unrecognised compliance criteria type: ${type ?? "(none)"}`, supporting: [] };
  }
}

function detectConflicts(requirements: ComplianceRequirementRow[]): ComplianceConflict[] {
  const codes = new Set(requirements.map((r) => r.code));
  const conflicts: ComplianceConflict[] = [];
  for (const req of requirements) {
    for (const other of req.conflicts_with ?? []) {
      if (codes.has(other)) conflicts.push({ requirementCode: req.code, conflictsWith: other, detail: `${req.code} declares a conflict with ${other}, both applicable to this SEU` });
    }
  }
  return conflicts;
}

function rollUp(counts: { total: number; satisfied: number; waived: number; unsatisfied: number }): ComplianceStatus {
  if (counts.total === 0) return "Compliance Unknown";
  if (counts.unsatisfied === 0 && counts.waived === 0) return "Compliant";
  if (counts.unsatisfied === 0 && counts.waived > 0) return "Compliant with Exceptions";
  if (counts.satisfied + counts.waived > 0) return "Partially Compliant";
  return "Non-Compliant";
}

export async function evaluateCompliance(seuId: string, opts?: { persist?: boolean }): Promise<ComplianceEvaluationResult> {
  const packIds = await composedPackIds(seuId);
  const { data: frameworks } = await complianceDB.findApplicableFrameworks(packIds);
  const frameworkCodes = (frameworks ?? []).map((f) => f.code);
  const { data: requirements } = await complianceDB.findRequirementsByFrameworkCodes(frameworkCodes);
  const { data: waivers } = await complianceDB.findActiveWaivers(seuId);
  const waivedCodes = new Set((waivers ?? []).map((w) => w.requirement_code));

  const results: RequirementResult[] = [];
  for (const req of requirements ?? []) {
    if (waivedCodes.has(req.code)) {
      results.push({ requirementCode: req.code, frameworkCode: req.framework_code, name: req.name, severity: req.severity, state: "waived", detail: "waived for this SEU", supporting: [] });
      continue;
    }
    const evald = await evaluateRequirement(seuId, req);
    results.push({
      requirementCode: req.code,
      frameworkCode: req.framework_code,
      name: req.name,
      severity: req.severity,
      state: evald.satisfied ? "satisfied" : "unsatisfied",
      detail: evald.detail,
      supporting: evald.supporting,
    });
  }

  const counts = {
    total: results.length,
    satisfied: results.filter((r) => r.state === "satisfied").length,
    waived: results.filter((r) => r.state === "waived").length,
    unsatisfied: results.filter((r) => r.state === "unsatisfied").length,
  };
  const status = rollUp(counts);
  const conflicts = detectConflicts(requirements ?? []);

  const { data: previous } = await complianceDB.findLatestEvaluation(seuId);

  if (opts?.persist !== false) {
    const systemActor = await resolveSystemActor(seuId);
    const { authorId } = await resolveAuthor(seuId, systemActor.actorId);
    await complianceDB.recordEvaluation({ seuId, status, rationale: { counts, frameworks: frameworkCodes, conflicts }, results, authorId, authorBadge: systemActor.authorBadge });
    await eventBus.publish({ eventType: "ComplianceEvaluated", originatingObjectType: "SEU", originatingObjectId: seuId, seuId, correlationId: eventBus.newCorrelationId(), actorId: systemActor.actorId, authorityBadge: systemActor.authorBadge, payload: { status, counts } });
    if (previous && previous.status !== status) {
      await eventBus.publish({ eventType: "ComplianceStatusChanged", originatingObjectType: "SEU", originatingObjectId: seuId, seuId, correlationId: eventBus.newCorrelationId(), actorId: systemActor.actorId, authorityBadge: systemActor.authorBadge, payload: { from: previous.status, to: status } });
    }
    if (status === "Compliant") {
      await eventBus.publish({ eventType: "ComplianceSatisfied", originatingObjectType: "SEU", originatingObjectId: seuId, seuId, correlationId: eventBus.newCorrelationId(), actorId: systemActor.actorId, authorityBadge: systemActor.authorBadge, payload: {} });
    } else if (status === "Non-Compliant" || status === "Partially Compliant") {
      await eventBus.publish({ eventType: "ComplianceViolationDetected", originatingObjectType: "SEU", originatingObjectId: seuId, seuId, correlationId: eventBus.newCorrelationId(), actorId: systemActor.actorId, authorityBadge: systemActor.authorBadge, payload: { status, unsatisfied: results.filter((r) => r.state === "unsatisfied").map((r) => r.requirementCode) } });
    }
  }

  return { seuId, status, frameworks: frameworkCodes, results, conflicts, counts };
}

export async function grantWaiver(input: { seuId: string; requirementCode: string; rationale: string; grantedBy: string; authorBadge: string; expiresAt?: string | null }) {
  const { data: requirement } = await complianceDB.findRequirementByCode(input.requirementCode);
  if (!requirement) throw new Error(`compliance requirement not found: ${input.requirementCode}`);
  const { data: waiver, error } = await complianceDB.grantWaiver(input);
  if (error || !waiver) throw error ?? new Error("failed to grant waiver");
  await eventBus.publish({ eventType: "ComplianceWaiverGranted", originatingObjectType: "SEU", originatingObjectId: input.seuId, seuId: input.seuId, correlationId: eventBus.newCorrelationId(), actorId: input.grantedBy, authorityBadge: input.authorBadge, payload: { requirementCode: input.requirementCode } });
  return waiver;
}

export async function generateComplianceReport(seuId: string) {
  const evaluation = await evaluateCompliance(seuId, { persist: true });
  const { data: waivers } = await complianceDB.findActiveWaivers(seuId);
  const reportSystemActor = await resolveSystemActor(seuId);
  await eventBus.publish({ eventType: "ComplianceReportGenerated", originatingObjectType: "SEU", originatingObjectId: seuId, seuId, correlationId: eventBus.newCorrelationId(), actorId: reportSystemActor.actorId, authorityBadge: reportSystemActor.authorBadge, payload: { status: evaluation.status } });
  return {
    seuId,
    generatedAt: new Date().toISOString(),
    status: evaluation.status,
    frameworks: evaluation.frameworks,
    counts: evaluation.counts,
    satisfied: evaluation.results.filter((r) => r.state === "satisfied"),
    outstanding: evaluation.results.filter((r) => r.state === "unsatisfied"),
    waived: evaluation.results.filter((r) => r.state === "waived"),
    waivers: waivers ?? [],
    conflicts: evaluation.conflicts,
  };
}

export async function complianceHistory(seuId: string) {
  const { data } = await complianceDB.findEvaluationHistory(seuId);
  return data ?? [];
}
