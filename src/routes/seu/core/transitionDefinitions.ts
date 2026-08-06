// SDK UI Layer Plan — Transition Definition's own authoring surface (Build
// order step 6). Ch.29 grounding: §9 State Transitions, §10 Transition
// Definitions. Structural + referential check, same reasoning as
// validatePackSeed/validateTemplateSeed/validateProfileSeed.
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { authorityRulesDB } from "../../../dblayer/authorityRulesDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { qualityGatesDB } from "../../../dblayer/qualityGatesDB.js";
import type { TransitionEntityType } from "../../../dblayer/seuTypes.js";

// Mirrors transition_definitions' own entity_type CHECK constraint
// (002_seu_platform.sql, widened by later migrations) — kept here as a
// plain list rather than introspecting the DB, same as every other
// enum-shaped validation in this codebase (e.g. core/packs.ts's
// PACK_CATEGORIES).
const VALID_ENTITY_TYPES: TransitionEntityType[] = [
  "SEU",
  "Deliverable",
  "Objective",
  "Obligation",
  "Evidence",
  "Knowledge",
  "Decision",
  "KnowledgeScope",
  "AttentionItem",
  "ExternalInteraction",
  "Pack",
];

export interface TransitionDefinitionSeedInput {
  entityType: string;
  fromState: string;
  toState: string;
  requiredAuthorityRuleCode?: string | null;
  requiredPolicyCodes?: string[];
  requiredQualityGateCodes?: string[];
  createsObligation?: string | null;
}

export type TransitionDefinitionValidationResult = { ok: true } | { ok: false; errors: string[] };

export async function validateTransitionDefinitionSeed(seed: TransitionDefinitionSeedInput): Promise<TransitionDefinitionValidationResult> {
  const errors: string[] = [];

  if (!VALID_ENTITY_TYPES.includes(seed.entityType as TransitionEntityType)) {
    errors.push(`entityType must be one of ${VALID_ENTITY_TYPES.join(", ")}, got "${seed.entityType}"`);
  }
  if (!seed.fromState?.trim()) errors.push("fromState is required");
  if (!seed.toState?.trim()) errors.push("toState is required");

  if (seed.requiredAuthorityRuleCode) {
    const { data: rule } = await authorityRulesDB.findByCode(seed.requiredAuthorityRuleCode);
    if (!rule) errors.push(`requiredAuthorityRuleCode "${seed.requiredAuthorityRuleCode}" does not resolve to a real Authority Rule`);
  }

  for (const code of seed.requiredPolicyCodes ?? []) {
    const { data: policy } = await policiesDB.findByCode(code);
    if (!policy) errors.push(`requiredPolicyCodes references unknown Policy code "${code}"`);
  }

  for (const code of seed.requiredQualityGateCodes ?? []) {
    const { data: gate } = await qualityGatesDB.findByCode(code);
    if (!gate) {
      errors.push(`requiredQualityGateCodes references unknown Quality Gate code "${code}"`);
      continue;
    }
    // Referential check the schema itself can't express: a gate resolved by
    // id at evaluation time (qualityGateEngine.evaluateByIds) never re-checks
    // its own (entityType, fromState, toState) — a mismatched gate here
    // would just be silently inert at runtime, not loudly wrong, so it's
    // caught here instead.
    if (gate.entity_type !== seed.entityType || gate.from_state !== seed.fromState || gate.to_state !== seed.toState) {
      errors.push(`Quality Gate "${code}" is scoped to ${gate.entity_type} ${gate.from_state} -> ${gate.to_state}, not ${seed.entityType} ${seed.fromState} -> ${seed.toState}`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export type PublishTransitionDefinitionResult = { ok: true; transitionDefinitionId: string } | { ok: false; errors: string[] };

export async function publishTransitionDefinition(seed: TransitionDefinitionSeedInput): Promise<PublishTransitionDefinitionResult> {
  const validation = await validateTransitionDefinitionSeed(seed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  let requiredAuthorityRuleId: string | null = null;
  if (seed.requiredAuthorityRuleCode) {
    const { data: rule } = await authorityRulesDB.findByCode(seed.requiredAuthorityRuleCode);
    requiredAuthorityRuleId = rule?.id ?? null;
  }

  const requiredPolicyIds: string[] = [];
  for (const code of seed.requiredPolicyCodes ?? []) {
    const { data: policy } = await policiesDB.findByCode(code);
    if (policy) requiredPolicyIds.push(policy.id);
  }

  const requiredQualityGateIds: string[] = [];
  for (const code of seed.requiredQualityGateCodes ?? []) {
    const { data: gate } = await qualityGatesDB.findByCode(code);
    if (gate) requiredQualityGateIds.push(gate.id);
  }

  const { data: transitionDefinition, error } = await transitionDefinitionsDB.upsert({
    entityType: seed.entityType as TransitionEntityType,
    fromState: seed.fromState,
    toState: seed.toState,
    requiredAuthorityRuleId,
    requiredPolicyIds,
    requiredQualityGateIds,
    createsObligation: seed.createsObligation ?? null,
    category: null,
  });
  if (error || !transitionDefinition) return { ok: false, errors: [(error ?? new Error("failed to upsert transition definition")).message] };
  return { ok: true, transitionDefinitionId: transitionDefinition.id };
}
