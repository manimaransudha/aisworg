import { participantsDB } from "../../dblayer/participantsDB.js";
import { participantsMasterDB } from "../../dblayer/participantsMasterDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { loadSettled, configurationParameter } from "./ebmSettled.js";
import { workItemsDB } from "../../dblayer/workItemsDB.js";
import { COMPETENCY_DIMENSION_ROLE, COMPETENCY_DIMENSION_WORK_TYPE } from "../../dblayer/constants.js";
import type { ParticipantMasterRow, WorkItemRow } from "../../dblayer/seuTypes.js";

export interface DispatchCandidate {
  participantId: string;
  master: ParticipantMasterRow;
}

// The Participants among the candidates who hold the role and the worktype of the Work Item (CR-149). A Work Item with no role or worktype keeps every candidate.
export async function candidatesHoldingWorkItemType(candidateIds: string[], workItem: Pick<WorkItemRow, "role" | "worktype">): Promise<string[]> {
  if (!workItem.role && !workItem.worktype) return candidateIds;
  const held: string[] = [];
  for (const id of candidateIds) {
    const { data: participant } = await participantsDB.findById(id);
    if (!participant?.participant_id) continue;
    const { data: master } = await participantsMasterDB.findById(participant.participant_id);
    const holds = (dimension: string, code: string | null) => !code || (master?.competency?.[dimension] ?? []).some((e) => e.code === code);
    if (holds(COMPETENCY_DIMENSION_ROLE, workItem.role) && holds(COMPETENCY_DIMENSION_WORK_TYPE, workItem.worktype)) held.push(id);
  }
  return held;
}

export async function loadAvailableCandidates(candidateIds: string[]): Promise<DispatchCandidate[]> {
  const out: DispatchCandidate[] = [];
  for (const id of candidateIds) {
    const { data: participant } = await participantsDB.findById(id);
    if (!participant || (participant.state !== "Available" && participant.state !== "Idle") || !participant.participant_id) continue;
    const { data: master } = await participantsMasterDB.findById(participant.participant_id);
    if (!master) continue;
    out.push({ participantId: participant.id, master });
  }
  return out;
}

// Commented out (owner): nothing reads the EBM's pool. The Profile configuration is read from the EBM's settled result.
// async function resolveEbmPoolValue(seuId: string, propertyName: string): Promise<unknown> {
//   const { data: seu } = await seusDB.findById(seuId);
//   if (!seu?.active_ebm_id) return undefined;
//   const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
//   const pool = (ebm?.behaviors as { pool?: Array<{ propertyName: string; value: unknown }> } | null)?.pool ?? [];
//   return pool.find((e) => e.propertyName === propertyName)?.value;
// }

type StrategyFn = (candidates: DispatchCandidate[], context: { seuId: string }) => Promise<DispatchCandidate | null>;

const capabilityMatch: StrategyFn = async (candidates) => candidates[0] ?? null;

const specialistPreference: StrategyFn = async (candidates) => {
  const specialists = candidates.filter((c) => Object.values(c.master.competency).some((entries) => entries.some((e) => e.proficiency === "Expert")));
  return specialists[0] ?? null;
};

const costOptimisation: StrategyFn = async (candidates) => {
  const priced = candidates.filter((c) => c.master.cost != null);
  if (priced.length === 0) return null;
  return priced.reduce((best, c) => (c.master.cost! < best.master.cost! ? c : best));
};

const confidenceOptimisation: StrategyFn = async (candidates) => {
  let best: DispatchCandidate | null = null;
  let bestCount = 0;
  for (const c of candidates) {
    const { data: history } = await participantsDB.findByParticipantMasterId(c.master.id);
    const count = history?.length ?? 0;
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return best;
};

const loadBalancing: StrategyFn = async (candidates) => {
  let best: DispatchCandidate | null = null;
  let bestLoad = Infinity;
  for (const c of candidates) {
    const { data: load } = await workItemsDB.countActiveByParticipantId(c.participantId);
    const n = load ?? 0;
    if (n < bestLoad) {
      best = c;
      bestLoad = n;
    }
  }
  return best;
};

const localityPreference: StrategyFn = async (candidates, context) => {
  const { data: seu } = await seusDB.findById(context.seuId);
  if (!seu) return null;
  for (const c of candidates) {
    const { data: history } = await participantsDB.findByParticipantMasterId(c.master.id);
    for (const engagement of history ?? []) {
      if (engagement.seu_id === context.seuId) continue;
      const { data: pastSeu } = await seusDB.findById(engagement.seu_id);
      if (pastSeu?.objective_id === seu.objective_id) return c;
    }
  }
  return null;
};

const organisationPreference: StrategyFn = async (candidates, context) => {
  const wanted = configurationParameter(await loadSettled(context.seuId), "participatingOrganisationCodes");
  const wantedCodes = Array.isArray(wanted) ? (wanted as string[]) : [];
  if (wantedCodes.length === 0) return null;
  for (const c of candidates) {
    const held = (c.master.competency.Organisation ?? []).map((e) => e.code);
    if (wantedCodes.some((code) => held.includes(code))) return c;
  }
  return null;
};

const STRATEGY_FUNCTIONS: Record<string, StrategyFn> = {
  "capability-match": capabilityMatch,
  "specialist-preference": specialistPreference,
  "cost-optimisation": costOptimisation,
  "confidence-optimisation": confidenceOptimisation,
  "load-balancing": loadBalancing,
  "locality-preference": localityPreference,
  "organisation-preference": organisationPreference,
};

export async function selectParticipant(available: DispatchCandidate[], strategies: Array<{ strategy: string; order: number }>, seuId: string): Promise<{ participantId: string; strategy: string } | null> {
  if (available.length === 0) return null;

  const ordered = strategies.length > 0 ? [...strategies].sort((a, b) => a.order - b.order) : [{ strategy: "capability-match", order: 0 }];
  for (const { strategy } of ordered) {
    const fn = STRATEGY_FUNCTIONS[strategy];
    if (!fn) continue;
    const winner = await fn(available, { seuId });
    if (winner) return { participantId: winner.participantId, strategy };
  }
  return null;
}
