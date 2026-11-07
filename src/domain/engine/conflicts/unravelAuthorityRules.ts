import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { authorityRulesDB } from "../../../dblayer/authorityRulesDB.js";
import type { ComposedPacks } from "./composedPacks.js";
import type { TransitionEntityType } from "../../../dblayer/seuTypes.js";

// The roles one source names for one step.
export interface AuthorityRuleRow {
  // The Pack that names the roles, or null when the platform's own definition of the step names them.
  packId: string | null;
  packCode: string | null;
  // The step, as "Entity|from|to". It applies to every Deliverable at that step.
  step: string;
  // The roles, sorted. A Pack's roles for one step are taken together.
  roles: string[];
}

export interface AuthorityRulesUnraveled {
  rules: AuthorityRuleRow[];
}

// Gathers the authority rules of the composed Packs, and the platform's own rule for each step a Pack names. It decides nothing.
export async function unravelAuthorityRules(input: { composedPacks: ComposedPacks }): Promise<AuthorityRulesUnraveled> {
  const rules: AuthorityRuleRow[] = [];
  const steps = new Set<string>();
  for (const pack of input.composedPacks.packs) {
    const rolesByStep = new Map<string, Set<string>>();
    for (const rule of pack.contributions?.authorityRules ?? []) {
      steps.add(rule.governedTransition);
      rolesByStep.set(rule.governedTransition, (rolesByStep.get(rule.governedTransition) ?? new Set<string>()).add(rule.authorisedRole));
    }
    for (const [step, roles] of rolesByStep) rules.push({ packId: pack.id, packCode: pack.code, step, roles: [...roles].sort() });
  }

  for (const step of steps) {
    const [entityType, fromState, toState] = step.split("|");
    if (!entityType || !fromState || !toState) continue;
    const { data: definition } = await transitionDefinitionsDB.find(entityType as TransitionEntityType, fromState, toState);
    if (!definition?.required_authority_rule_id) continue;
    const { data: rule } = await authorityRulesDB.findById(definition.required_authority_rule_id);
    if (rule) rules.push({ packId: null, packCode: null, step, roles: [rule.authorised_role] });
  }
  return { rules };
}
