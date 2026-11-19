import { loadSettled, competencyRequirementsOf, eligibilityPoliciesOf, type EligibilityPolicy } from "../../../domain/engine/ebmSettled.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
import { COMPETENCY_DIMENSION_ROLE } from "../../../dblayer/constants.js";
import { evaluateCondition, type GoverningCondition } from "../../../domain/engine/governingCondition.js";
import type { ParticipantMasterRow, PolicyRow, SeuRow } from "../../../dblayer/seuTypes.js";

export interface EligibilityCriteria {
  tenantId: string;
  capabilityCode: string;
  competency?: Record<string, string[]>;
  // The roles of the Capability. A Participant who holds none of them is not eligible. An empty list sets no limit.
  capabilityRoles?: string[];
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

// The roles of a Capability the SEU takes. The EBM records the Capability Definition it took for each Capability, and the roles are read from that Definition.
export async function getCapabilityRoles(seu: SeuRow, capabilityCode: string): Promise<string[]> {
  if (!seu.active_ebm_id) return [];
  const definitionId = (await loadSettled(seu.id))?.capabilities?.result?.find((c) => c.capability === capabilityCode)?.definitionId;
  if (!definitionId) return [];
  const { data: definition, error } = await capabilityDefinitionsDB.findById(definitionId);
  if (error) throw error;
  return (definition?.roles ?? []).map((r) => r.name);
}

export async function findEligibleParticipants(criteria: EligibilityCriteria): Promise<ParticipantMasterRow[]> {
  const { data } = await participantsMasterDB.findEligibleForCapability(criteria.tenantId, criteria.capabilityCode);
  let eligible = data ?? [];
  if (criteria.competency) {
    eligible = eligible.filter((p) => matchesCompetency(p.competency, criteria.competency!));
  }
  if (criteria.capabilityRoles?.length) {
    const roles = new Set(criteria.capabilityRoles);
    eligible = eligible.filter((p) => (p.competency[COMPETENCY_DIMENSION_ROLE] ?? []).some((entry) => roles.has(entry.code)));
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
