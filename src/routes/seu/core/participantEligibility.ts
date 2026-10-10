import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { unravelComposition } from "../../../domain/engine/profileCompositionUnravel.js";
import { evaluateCondition, type GoverningCondition } from "../../../domain/engine/governingCondition.js";
import type { ParticipantMasterRow, PolicyRow, SeuRow } from "../../../dblayer/seuTypes.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "../../../dblayer/constants.js";

export interface EligibilityCriteria {
  tenantId: string;
  capabilityCode: string;
  competency?: Record<string, string[]>;
  requiredPolicyIds?: string[];
  excludeParticipantMasterIds?: string[];
}

function matchesCompetency(participantCompetency: Record<string, Array<{ code: string; proficiency: string }>>, required: Record<string, string[]>): boolean {
  return Object.entries(required).every(([dimension, values]) => {
    const held = (participantCompetency[dimension] ?? []).map((entry) => entry.code);
    return values.some((v) => held.includes(v));
  });
}

function matchesRequiredPolicies(participant: ParticipantMasterRow, policies: PolicyRow[]): boolean {
  return policies.every((policy) => {
    const entry = participant.behaviour_context.find((e) => e.policy === policy.code);
    if (!entry) return false;
    return evaluateCondition(policy.condition as GoverningCondition, entry.payload);
  });
}

export async function resolveEligibilityPolicies(seu: SeuRow): Promise<PolicyRow[]> {
  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  const { composedPacks } = await unravelComposition({ templateIds: [seu.template_id], profileIds: [seu.profile_id] }, seu.tenant_id ?? PLATFORM_TENANT_ID);
  const packIds = composedPacks.map((p) => p.packId);
  const { data: policies } = await policiesDB.findByPackIds(packIds);
  return (policies ?? []).filter((p) => p.scope === "Eligibility");
}

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
