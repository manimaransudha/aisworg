// Ch.12 §8 Fulfilment Criteria — the ONE place "which Participants satisfy
// this Capability" is decided, used by both the SEU detail page's Fulfil
// dropdown (core/seus.ts) and fulfilCapability's own server-side re-check
// (core/capabilities.ts), so the two can never drift apart. Today this only
// matches on Assigned Capabilities (capability compatibility, §8's first
// criterion); it's the deliberate seam to grow the rest of §8's list into —
// competency (dimension = category:pack, CR-099), behavioural compatibility
// with the EBM, required knowledge, required authority, engineering
// constraints, Pack-specific requirements — without touching either caller.
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { unravelComposition } from "../../../domain/engine/profileCompositionUnravel.js";
import { evaluateCondition, type GoverningCondition } from "../../../domain/engine/governingCondition.js";
import type { ParticipantMasterRow, PolicyRow, SeuRow } from "../../../dblayer/seuTypes.js";

export interface EligibilityCriteria {
  tenantId: string;
  capabilityCode: string;
  // Optional narrowing, one entry per category:pack code (CR-099 — Domain/
  // Technology today, Ontology-extensible to any Pack category). A
  // Participant matches a dimension if it holds AT LEAST ONE of the listed
  // values, not all of them — "banking OR health experience" reads as
  // ["banking","health"], not "must have both."
  competency?: Record<string, string[]>;
  // CR-104 — scope: "Eligibility" Policy ids (a background check, say) this
  // Capability Fulfilment requires. Checked against a candidate
  // Participant's own behaviour_context, never a transition's context —
  // onboarding, not engineering behaviour, so this is never read off any
  // EBM (see resolveEligibilityPolicies below).
  requiredPolicyIds?: string[];
  // Owner: "the participant dropdown should not show... the ones chosen
  // for replacement." A Participant just released from THIS Capability
  // (releaseParticipants, core/capabilities.ts) would otherwise reappear
  // here the instant the Capability reverts to Unfulfilled — nothing about
  // their own capability/competency changed, only their assignment to this
  // one slot did. Populated by the caller from
  // capabilityFulfilmentsDB.findReleasedParticipantMasterIds, not computed
  // in here — this function stays a pure filter over whatever set it's given.
  excludeParticipantMasterIds?: string[];
}

function matchesCompetency(participantCompetency: Record<string, Array<{ code: string; proficiency: string }>>, required: Record<string, string[]>): boolean {
  return Object.entries(required).every(([dimension, values]) => {
    const held = (participantCompetency[dimension] ?? []).map((entry) => entry.code);
    return values.some((v) => held.includes(v));
  });
}

// CR-104 — a required Policy is checked against whichever of the
// Participant's own behaviour_context entries names it by code (Ch.13 §14 —
// "policy" + "payload"), not against a transition's context object. No
// matching entry at all means the condition has nothing to evaluate against,
// so it fails closed (never eligible), same discipline unrecognised
// condition types already use in governingCondition.ts.
function matchesRequiredPolicies(participant: ParticipantMasterRow, policies: PolicyRow[]): boolean {
  return policies.every((policy) => {
    const entry = participant.behaviour_context.find((e) => e.policy === policy.code);
    if (!entry) return false;
    return evaluateCondition(policy.condition as GoverningCondition, entry.payload);
  });
}

// CR-104 — scope "Eligibility" Policies a SEU's Capability Fulfilment
// requires, resolved LIVE off the SEU's own Template/Profile composition —
// deliberately never through the EBM (behaviors/applicable_policy_ids/
// seu_scoped_policy_ids all describe Engineering Behaviour; Participant
// eligibility is onboarding, a different domain entirely, even though both
// happen to draw on the same composed Packs). Reuses unravelComposition
// directly — the same real composition logic (including CR-104's own
// Mandatory-Pack folding) commissioning itself runs, not a re-derived copy.
export async function resolveEligibilityPolicies(seu: SeuRow): Promise<PolicyRow[]> {
  const { composedPacks } = await unravelComposition({ templateIds: [seu.template_id], profileIds: [seu.profile_id] }, seu.tenant_id);
  const packIds = composedPacks.map((p) => p.packId);
  const { data: policies } = await policiesDB.findByPackIds(packIds);
  return (policies ?? []).filter((p) => p.scope === "Eligibility");
}

// Owner: "the primary programming language should be unioned with the
// technology competencies in the packs... Same with domain as well. Now,
// the capability fulfilment helper has to include this technology and
// domain check as well." The union itself is computed once, at EBM
// composition (unravelComposition/computeCompetencyRequirements,
// domain/engine/profileCompositionUnravel.ts) and carried onto the active
// EBM's own behaviors.competencyRequirements (compositionCompleted.ts) —
// read back here, the single place both the Fulfil dropdown
// (getSeuDetailView, core/seus.ts) and its own server-side re-check
// (resolveMasterParticipant, core/capabilities.ts) get it from, so they
// can never drift apart, same discipline as findEligibleParticipants
// itself. A SEU with no active EBM yet (still Pending) has nothing to
// require.
export async function getSeuCompetencyRequirements(seu: SeuRow): Promise<Record<string, string[]>> {
  if (!seu.active_ebm_id) return {};
  const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
  const behaviors = ebm?.behaviors as { competencyRequirements?: Record<string, string[]> } | null;
  return behaviors?.competencyRequirements ?? {};
}

export async function findEligibleParticipants(criteria: EligibilityCriteria): Promise<ParticipantMasterRow[]> {
  const { data } = await participantsMasterDB.findEligibleForCapability(criteria.tenantId, criteria.capabilityCode);
  let eligible = data ?? [];
  if (criteria.competency) {
    eligible = eligible.filter((p) => matchesCompetency(p.competency, criteria.competency!));
  }
  if (criteria.requiredPolicyIds?.length) {
    const { data: requiredPolicies } = await policiesDB.findByIds(criteria.requiredPolicyIds);
    eligible = eligible.filter((p) => matchesRequiredPolicies(p, requiredPolicies ?? []));
  }
  if (criteria.excludeParticipantMasterIds?.length) {
    const excluded = new Set(criteria.excludeParticipantMasterIds);
    eligible = eligible.filter((p) => !excluded.has(p.id));
  }
  return eligible;
}
