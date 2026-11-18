import { CONFIDENCE_LEVEL_PERCENT, UNASSESSED_RECORD_CONFIDENCE_PERCENT, WAIVER_CONTROL_OBLIGATION, WAIVER_SUPPORT_DECISION, WAIVER_SUPPORT_EVIDENCE, WAIVER_SUPPORT_KNOWLEDGE } from "../../dblayer/constants.js";
import { decisionsDB } from "../../dblayer/decisionsDB.js";
import { evidenceDB } from "../../dblayer/evidenceDB.js";
import { knowledgeItemsDB } from "../../dblayer/knowledgeItemsDB.js";
import { qualityGateDefinitionsDB } from "../../dblayer/qualityGateDefinitionsDB.js";
import { qualityGateWaiverRisksDB } from "../../dblayer/qualityGateWaiverRisksDB.js";
import { qualityGateWaiversDB } from "../../dblayer/qualityGateWaiversDB.js";
import type { QualityGateWaiverRow } from "../../dblayer/seuTypes.js";
import { findQualityGateWaiverConfidence, type WaiverConfidenceBasis } from "../../qualitygates/index.js";

// The confidence level of one supporting record, 0 to 100. A record with no confidence level counts for UNASSESSED_RECORD_CONFIDENCE_PERCENT.
async function recordConfidence(type: string, id: string): Promise<number> {
  const { data, error } =
    type === WAIVER_SUPPORT_EVIDENCE ? await evidenceDB.findById(id)
    : type === WAIVER_SUPPORT_KNOWLEDGE ? await knowledgeItemsDB.findById(id)
    : type === WAIVER_SUPPORT_DECISION ? await decisionsDB.findById(id)
    : { data: null, error: new Error(`a waiver has no supporting record of type "${type}"`) };
  if (error) throw error;
  const level = data?.confidence_level;
  return (level ? CONFIDENCE_LEVEL_PERCENT[level] : undefined) ?? UNASSESSED_RECORD_CONFIDENCE_PERCENT;
}

async function basisOf(waiver: QualityGateWaiverRow): Promise<WaiverConfidenceBasis> {
  const { data: controls, error } = await qualityGateWaiverRisksDB.findControlsByWaiverId(waiver.id);
  if (error) throw error;
  const confidences: number[] = [];
  for (const [type, ids] of Object.entries(waiver.supporting_records ?? {})) {
    for (const id of ids) confidences.push(await recordConfidence(type, id));
  }
  return {
    hasObligationControl: (controls ?? []).some((c) => c.control_type === WAIVER_CONTROL_OBLIGATION),
    supportingRecordConfidences: confidences,
  };
}

// The confidence of one waiver by the rules of the criterion of its gate, or null when the criterion has no rule for it (no gate, or a criteria type with no rule yet).
export async function rateWaiver(waiver: QualityGateWaiverRow, criteriaType: string | undefined): Promise<number | null> {
  const rule = findQualityGateWaiverConfidence(criteriaType);
  return rule ? rule(await basisOf(waiver)) : null;
}

// The confidence of each waiver that covers a Quality Gate line item, by the rules of that gate's criterion. A gate whose criterion has no rule yet gives no entry.
export async function rateGateWaivers(covered: Array<{ gateId: string; waiverId: string }>): Promise<number[]> {
  if (covered.length === 0) return [];
  const [{ data: definitions, error: definitionError }, { data: waivers, error: waiverError }] = await Promise.all([
    qualityGateDefinitionsDB.findByIds([...new Set(covered.map((c) => c.gateId))]),
    qualityGateWaiversDB.findByIds([...new Set(covered.map((c) => c.waiverId))]),
  ]);
  if (definitionError) throw definitionError;
  if (waiverError) throw waiverError;
  const ratings: number[] = [];
  for (const c of covered) {
    const rule = findQualityGateWaiverConfidence(definitions?.find((d) => d.id === c.gateId)?.criteria_type);
    const waiver = waivers?.find((w) => w.id === c.waiverId);
    if (rule && waiver) ratings.push(rule(await basisOf(waiver)));
  }
  return ratings;
}
