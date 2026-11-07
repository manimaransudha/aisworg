import { loadSettled, competencyRequirementsOf, eligibilityPoliciesOf, type EligibilityPolicy } from "../../../domain/engine/ebmSettled.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { evaluateCondition, type GoverningCondition } from "../../../domain/engine/governingCondition.js";
import type { ParticipantMasterRow, PolicyRow, SeuRow } from "../../../dblayer/seuTypes.js";

export interface EligibilityCriteria {
  tenantId: string;
  capabilityCode: string;
  competency?: Record<string, string[]>;
  requiredPolicies?: EligibilityPolicy[];
  excludeParticipantMasterIds?: string[];
}

function matchesCompetency(participantCompetency: Record<string, Array<{ code: string; proficiency: string }>>, required: Record<string, string[]>): boolean {
  return Object.entries(required).every(([dimension, values]) => {
    const held = (participantCompetency[dimension] ?? []).map((entry) => entry.code);
    return values.some((v) => held.includes(v));
  });
}

function matchesRequiredPolicies(participant: ParticipantMasterRow, policies: EligibilityPolicy[]): boolean {
  return policies.every((policy) => {
    const entry = participant.behaviour_context.find((e) => e.policy === policy.code);
    if (!entry) return false;
    return evaluateCondition(policy.condition as unknown as GoverningCondition, entry.payload);
  });
}

// The eligibility Policies the SEU takes, read from the EBM's settled result.
export async function resolveEligibilityPolicies(seu: SeuRow): Promise<EligibilityPolicy[]> {
  if (!seu.active_ebm_id) return [];
  return eligibilityPoliciesOf(await loadSettled(seu.id));
}

export async function getSeuCompetencyRequirements(seu: SeuRow): Promise<Record<string, string[]>> {
  if (!seu.active_ebm_id) return {};
  return competencyRequirementsOf(await loadSettled(seu.id));
}

export async function findEligibleParticipants(criteria: EligibilityCriteria): Promise<ParticipantMasterRow[]> {
  const { data } = await participantsMasterDB.findEligibleForCapability(criteria.tenantId, criteria.capabilityCode);
  let eligible = data ?? [];
  if (criteria.competency) {
    eligible = eligible.filter((p) => matchesCompetency(p.competency, criteria.competency!));
  }
  if (criteria.requiredPolicies?.length) {
    eligible = eligible.filter((p) => matchesRequiredPolicies(p, criteria.requiredPolicies!));
  }
  if (criteria.excludeParticipantMasterIds?.length) {
    const excluded = new Set(criteria.excludeParticipantMasterIds);
    eligible = eligible.filter((p) => !excluded.has(p.id));
  }
  return eligible;
}
