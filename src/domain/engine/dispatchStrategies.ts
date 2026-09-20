// Ch.33 §9 Dispatch Strategies — one function per named strategy, composed
// via the ordered list a Profile's own dispatchStrategyPreference declares.
// dispatchEngine.dispatch() tries each in order (workItemGeneratedHandler /
// redispatch.ts resolve the list and pass it in) until one yields a
// candidate. Every strategy ranks/filters WITHIN the already-Available
// candidate set — Capability Fulfilment's own technology/domain eligibility
// already happened upstream, at fulfilment time, so these never re-derive
// eligibility, only choose among who's eligible AND free right now.
import { participantsDB } from "../../dblayer/participantsDB.js";
import { participantsMasterDB } from "../../dblayer/participantsMasterDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { workItemsDB } from "../../dblayer/workItemsDB.js";
import type { ParticipantMasterRow } from "../../dblayer/seuTypes.js";

export interface DispatchCandidate {
  participantId: string; // participants.id (per-SEU engagement row)
  master: ParticipantMasterRow;
}

// Exported so dispatchEngine.dispatch can distinguish case 4 (nobody
// currently Available — transient, DispatchDeferred) from case 2 (candidates
// ARE Available, but no strategy matched any of them — structural,
// ParticipantUnavailable) before calling selectParticipant.
export async function loadAvailableCandidates(candidateIds: string[]): Promise<DispatchCandidate[]> {
  const out: DispatchCandidate[] = [];
  for (const id of candidateIds) {
    const { data: participant } = await participantsDB.findById(id);
    // Ch.13 §9 — "Available" is reached exactly once, at creation; a
    // Participant that has already completed a Work Item rests at "Idle"
    // (workItems.ts's own comment: "still held by an open Capability
    // Fulfilment, just between Work Items"), the real, documented "ready for
    // the next assignment" state the Idle -> Assigned repeat cycle depends
    // on. Excluding it here meant a fulfilled Capability's Participant could
    // only ever be dispatched to once, for its entire life.
    if (!participant || (participant.state !== "Available" && participant.state !== "Idle") || !participant.participant_id) continue;
    const { data: master } = await participantsMasterDB.findById(participant.participant_id);
    if (!master) continue;
    out.push({ participantId: participant.id, master });
  }
  return out;
}

async function resolveEbmPoolValue(seuId: string, propertyName: string): Promise<unknown> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu?.active_ebm_id) return undefined;
  const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
  const pool = (ebm?.behaviors as { pool?: Array<{ propertyName: string; value: unknown }> } | null)?.pool ?? [];
  return pool.find((e) => e.propertyName === propertyName)?.value;
}

type StrategyFn = (candidates: DispatchCandidate[], context: { seuId: string }) => Promise<DispatchCandidate | null>;

// The baseline: any Available, already capability-eligible candidate.
const capabilityMatch: StrategyFn = async (candidates) => candidates[0] ?? null;

// Ch.33 §9 "prefer specialist Participants when available." No "Specialist"
// Participant Type exists (AI/Human/Automated/External only) — mapped onto
// the real proficiency data instead: a candidate holding at least one
// Expert-level competency.
const specialistPreference: StrategyFn = async (candidates) => {
  const specialists = candidates.filter((c) => Object.values(c.master.competency).some((entries) => entries.some((e) => e.proficiency === "Expert")));
  return specialists[0] ?? null;
};

const costOptimisation: StrategyFn = async (candidates) => {
  const priced = candidates.filter((c) => c.master.cost != null);
  if (priced.length === 0) return null;
  return priced.reduce((best, c) => (c.master.cost! < best.master.cost! ? c : best));
};

// Confidence — a LABELLED adapter stand-in (owner: "what we have is an
// adapter; real organisations will provide us this information"): SEU
// engagement history count as the experience proxy. Highest count wins; a
// candidate with no prior history at all (count 0) never wins this strategy.
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

// Locality — "possessing relevant contextual knowledge": a candidate who has
// previously worked a SEU within the SAME Objective span as the SEU being
// dispatched for now.
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

// Organisation — "prefer Participants belonging to a specified Organisation
// Pack." The SEU's own Profile participatingOrganisationCodes (Ch.7 §5/§12),
// as composed onto the EBM, IS the specified Organisation set; prefer a
// candidate whose own Organisation competency holds a matching code.
const organisationPreference: StrategyFn = async (candidates, context) => {
  const wanted = await resolveEbmPoolValue(context.seuId, "participatingOrganisationCodes");
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

// Tries each strategy in the Profile's own declared order (ascending); the
// first to yield a candidate wins. No preference declared -> Capability
// Match alone (the baseline). An unrecognised strategy code is skipped, not
// a crash — data drift, not a code fault.
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
