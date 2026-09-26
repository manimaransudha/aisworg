// SDK UI Layer Plan — Transition Definition's own authoring surface (Build
// order step 6). Ch.29 grounding: §9 State Transitions, §10 Transition
// Definitions. CR-019: authored via the CR-007 noun x verb add/retire form
// below, not a schema-driven pipeline.
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { authorityVocabularyDB } from "../../../dblayer/authorityVocabularyDB.js";
import { listActiveNouns, activeMappingByNoun, type WriteResult } from "./authorityVocabulary.js";

// CR-007: the current, live Transition Definitions — the governed-transition
// graph as it actually stands (authority rule + required badge/role, policy &
// quality-gate counts), for the "current definitions" view on the authoring
// surface.
export interface TransitionDefinitionListItem {
  id: string;
  entityType: string;
  fromState: string;
  toState: string;
  verb: string | null;
  isActive: boolean;
  retiredAt: string | null;
  // CR-006: the noun × verb authority the transition will require once
  // enforcement collapses onto it (`noun_verb`). Display-only for now.
  nounVerbBadge: string | null;
  authorityRuleCode: string | null;
  requiredBadgeType: string | null;
  authorisedRole: string | null;
  policyCount: number;
  qualityGateCount: number;
  createsObligation: string | null;
  category: string | null;
}

export async function listCurrentTransitionDefinitions(): Promise<TransitionDefinitionListItem[]> {
  const { data } = await transitionDefinitionsDB.listAll();
  return (data ?? []).map((r) => ({
    id: r.id,
    entityType: r.entity_type,
    fromState: r.from_state,
    toState: r.to_state,
    verb: r.verb,
    isActive: r.is_active,
    retiredAt: r.retired_at,
    nounVerbBadge: r.verb ? `${r.entity_type.toLowerCase()}_${r.verb}` : null,
    authorityRuleCode: r.authority_rule_code,
    requiredBadgeType: r.required_badge_type,
    authorisedRole: r.authorised_role,
    policyCount: r.policy_count,
    qualityGateCount: r.quality_gate_count,
    createsObligation: r.creates_obligation,
    category: r.category,
  }));
}

// CR-007 Step 2 — detail of one transition definition (resolved codes) for the
// view-detail page.
export interface TransitionDefinitionDetailItem {
  id: string;
  entityType: string;
  fromState: string;
  toState: string;
  verb: string | null;
  nounVerbBadge: string | null;
  isActive: boolean;
  retiredAt: string | null;
  authorityRuleCode: string | null;
  policyCodes: string[];
  qualityGateCodes: string[];
  createsObligation: string | null;
  category: string | null;
}

export async function getTransitionDefinitionDetail(id: string): Promise<TransitionDefinitionDetailItem | null> {
  const { data } = await transitionDefinitionsDB.findDetailById(id);
  if (!data) return null;
  return {
    id: data.id,
    entityType: data.entity_type,
    fromState: data.from_state,
    toState: data.to_state,
    verb: data.verb,
    nounVerbBadge: data.verb ? `${data.entity_type.toLowerCase()}_${data.verb}` : null,
    isActive: data.is_active,
    retiredAt: data.retired_at,
    authorityRuleCode: data.authority_rule_code,
    policyCodes: data.policy_codes,
    qualityGateCodes: data.quality_gate_codes,
    createsObligation: data.creates_obligation,
    category: data.category,
  };
}

// CR-007 Step 2 — add a transition definition (edge + verb). The noun must be an
// active noun and the verb must be in that noun's active mapping (the Mapping
// tab is what says which verbs are legal on a noun). No authority rule / policy
// wiring here — that is the retiring CR-006 mechanism; the verb is the authority.
export async function addTransitionDefinition(input: {
  entityType: string;
  fromState: string;
  toState: string;
  verb: string;
}): Promise<WriteResult> {
  const entityType = input.entityType?.trim();
  const fromState = input.fromState?.trim();
  const toState = input.toState?.trim();
  const verb = input.verb?.trim();
  if (!entityType || !fromState || !toState || !verb) return { ok: false, error: "Noun, from-state, to-state and verb are all required." };
  if (fromState === toState) return { ok: false, error: "From-state and to-state must differ." };

  const nouns = new Set((await listActiveNouns()).map((n) => n.code));
  if (!nouns.has(entityType)) return { ok: false, error: `"${entityType}" is not an active noun.` };

  const allowed = (await activeMappingByNoun())[entityType] ?? [];
  if (!allowed.includes(verb)) {
    return { ok: false, error: `Verb "${verb}" is not allowed on ${entityType}. Add it on the Mapping tab first.` };
  }

  // A new edge starts at the mapping's own default_trigger (owner: "add a
  // dropdown to choose trigger and pass it in the allow function") — set
  // once, on the Mapping tab, when the noun+verb pair was allowed.
  const { data: defaultTrigger } = await authorityVocabularyDB.findDefaultTrigger(entityType, verb);
  const { error } = await transitionDefinitionsDB.insertDefinition({ entityType, fromState, toState, verb, trigger: defaultTrigger });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Edit action for the authoring list (owner: "View, Retire and Add are
// there. Edit is missing") — only creates_obligation/category, same scope
// transitionDefinitionsDB.updateMetadata deliberately keeps to.
export async function updateTransitionDefinition(id: string, input: { createsObligation?: string | null; category?: string | null }): Promise<WriteResult> {
  const { data, error } = await transitionDefinitionsDB.updateMetadata(id, {
    createsObligation: input.createsObligation?.trim() ? input.createsObligation.trim() : null,
    category: input.category?.trim() ? input.category.trim() : null,
  });
  if (error) return { ok: false, error: error.message };
  return data ? { ok: true } : { ok: false, error: "No such transition definition." };
}

export async function retireTransitionDefinition(id: string): Promise<WriteResult> {
  const { data, error } = await transitionDefinitionsDB.retireById(id);
  if (error) return { ok: false, error: error.message };
  return data ? { ok: true } : { ok: false, error: "No such transition definition." };
}
