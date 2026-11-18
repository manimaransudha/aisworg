import {
  QUALITY_GATE_COMPOSITION_RULE_ALL_PASSED, QUALITY_GATE_COMPOSITION_RULE_ANY_BLOCKED, QUALITY_GATE_COMPOSITION_RULE_ANY_WAIVED,
  QUALITY_GATE_COMPOSITION_RULE_NO_GATES, QUALITY_GATE_FULL_CONFIDENCE,
  WAIVER_SCOPE_GATE, WAIVER_SCOPE_OBLIGATION, WAIVER_SCOPE_POLICY, WAIVER_SCOPE_POLICY_OBLIGATION,
} from "../../dblayer/constants.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { qualityGateWaiversDB } from "../../dblayer/qualityGateWaiversDB.js";
import type { QualityGateDecisionOutcome, QualityGateWaiverRow } from "../../dblayer/seuTypes.js";
import { expireDueQualityGateWaivers } from "./qualityGateWaiverExpiry.js";

// What a waiver has to name to cover a condition. A condition with null can be covered by no waiver.
export type Waivable =
  | { scope: typeof WAIVER_SCOPE_GATE; qualityGateId: string }
  | { scope: typeof WAIVER_SCOPE_POLICY; policyCode: string }
  | { scope: typeof WAIVER_SCOPE_POLICY_OBLIGATION; policyCode: string; title: string }
  | { scope: typeof WAIVER_SCOPE_OBLIGATION; category: string; title: string };

// One condition of a decision: a Quality Gate line item or one of the other checks of the hop. A condition is Passed or Blocked, and never Waived.
// `waiver` is set by the composition alone, on a Blocked condition that an Active waiver covers. A condition names what a waiver has to name, or a list of
// alternatives of which one is enough (a Policy that raised an Obligation is covered by a waiver of the Policy or of that Obligation).
export interface QualityGateOutcomeInputItem {
  gateName: string;
  outcome: "Passed" | "Blocked";
  waivable: Waivable | Waivable[] | null;
  waiver?: { outcome: "Waived"; waiverId: string };
}

export interface ComposedQualityGateOutcome {
  outcome: QualityGateDecisionOutcome;
  rule: string;
  // The conditions as the composition settled them, each with its waiver when one covers it, in the order they were given.
  items: QualityGateOutcomeInputItem[];
}

// What a decision is made about.
export interface QualityGateOutcomeEntity {
  entityType: string;
  entityId: string;
  seuId: string | null;
}

// Every waiver that is Active in the SEU: the ones granted in it and the ones shared with its Profile. A waiver whose expiry time has passed is expired first.
export async function getWaivers(seuId: string | null): Promise<QualityGateWaiverRow[]> {
  if (!seuId) return [];
  await expireDueQualityGateWaivers(seuId);
  const { data, error } = await qualityGateWaiversDB.findActiveBySeu(seuId);
  if (error) throw error;
  return data ?? [];
}

// A waiver covers an entity when it was granted from it or, for a Deliverable, when it names the Deliverable's code.
export function coversEntity(waiver: QualityGateWaiverRow, entity: QualityGateOutcomeEntity, deliverableCode: string | null): boolean {
  if (waiver.entity_type !== entity.entityType) return false;
  return waiver.entity_id === entity.entityId || (deliverableCode !== null && waiver.deliverable_codes.includes(deliverableCode));
}

export function namesCondition(waiver: QualityGateWaiverRow, waivable: Waivable): boolean {
  if (waiver.scope !== waivable.scope) return false;
  switch (waivable.scope) {
    case WAIVER_SCOPE_GATE: return waiver.quality_gate_id === waivable.qualityGateId;
    case WAIVER_SCOPE_POLICY: return waiver.policy_code === waivable.policyCode;
    case WAIVER_SCOPE_POLICY_OBLIGATION: return waiver.policy_code === waivable.policyCode && waiver.obligation_title === waivable.title;
    case WAIVER_SCOPE_OBLIGATION: return waiver.obligation_category === waivable.category && waiver.obligation_title === waivable.title;
  }
}

// Outcome composition: the outcome of the decision from the conditions of one hop. The composition fetches the Active waivers of the SEU and marks each
// Blocked condition they cover as Waived. The rules then apply in this order.
//   1. No condition: NotApplicable.
//   2. Any condition Blocked and not covered by a waiver: Blocked.
//   3. Every Blocked condition covered by a waiver, and at least one such condition: Waived.
//   4. Every condition Passed: Approved.
export async function composeQualityGateOutcome(items: QualityGateOutcomeInputItem[], entity: QualityGateOutcomeEntity): Promise<ComposedQualityGateOutcome> {
  const blockedAtFirst = items.some((i) => i.outcome === "Blocked");
  const waivers = blockedAtFirst ? await getWaivers(entity.seuId) : [];
  const deliverableCode = blockedAtFirst && waivers.length > 0 && entity.entityType === "Deliverable" ? (await deliverablesDB.findById(entity.entityId)).data?.code ?? null : null;
  const settled: QualityGateOutcomeInputItem[] = items.map((i) => {
    if (i.outcome !== "Blocked" || !i.waivable) return { ...i, waiver: undefined };
    const alternatives = Array.isArray(i.waivable) ? i.waivable : [i.waivable];
    const waiver = waivers.find((w) => coversEntity(w, entity, deliverableCode) && alternatives.some((waivable) => namesCondition(w, waivable)));
    return waiver ? { ...i, waiver: { outcome: "Waived" as const, waiverId: waiver.id } } : { ...i, waiver: undefined };
  });
  if (settled.length === 0) return { outcome: "NotApplicable", rule: QUALITY_GATE_COMPOSITION_RULE_NO_GATES, items: settled };
  if (settled.some((i) => i.outcome === "Blocked" && !i.waiver)) return { outcome: "Blocked", rule: QUALITY_GATE_COMPOSITION_RULE_ANY_BLOCKED, items: settled };
  if (settled.some((i) => i.waiver)) return { outcome: "Waived", rule: QUALITY_GATE_COMPOSITION_RULE_ANY_WAIVED, items: settled };
  return { outcome: "Approved", rule: QUALITY_GATE_COMPOSITION_RULE_ALL_PASSED, items: settled };
}

// Confidence level of a decision, from 0 to 100. A criterion rates each waiver of its gate (`waiverConfidences`), and the decision takes the lowest of them.
// A decision with no rated waiver has full confidence.
export function calculateConfidenceLevel(_composed: ComposedQualityGateOutcome, waiverConfidences: number[]): number {
  return waiverConfidences.length > 0 ? Math.min(...waiverConfidences) : QUALITY_GATE_FULL_CONFIDENCE;
}

// The rationale, generated from the composition and the confidence level. A Waived condition names its waiver.
export function generateQualityGateRationale(composed: ComposedQualityGateOutcome, confidenceLevel: number): string {
  const counts = new Map<string, number>();
  for (const i of composed.items) {
    const effective = i.waiver ? i.waiver.outcome : i.outcome;
    counts.set(effective, (counts.get(effective) ?? 0) + 1);
  }
  const summary = [...counts.entries()].map(([outcome, n]) => `${n} ${outcome}`).join(", ") || "no condition";
  const waived = composed.items.filter((i) => i.waiver).map((i) => `${i.gateName} (waiver ${i.waiver!.waiverId})`);
  return `${composed.outcome} by rule ${composed.rule}: ${summary}; confidence ${confidenceLevel}%${waived.length > 0 ? `. Waived: ${waived.join("; ")}` : ""}`;
}
