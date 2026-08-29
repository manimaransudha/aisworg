// CR-006 / CR-007 Step 2 — core read + write model for the noun × verb
// authority vocabulary. Lifecycle: add + soft-retire only (never delete/rename).
import { authorityVocabularyDB } from "../../../dblayer/authorityVocabularyDB.js";

export interface AuthorityNounListItem {
  code: string;
  label: string;
  description: string | null;
  isActive: boolean;
  verbCount: number;
  transitionCount: number;
}
export interface AuthorityVerbListItem {
  code: string;
  label: string;
  description: string | null;
  isActive: boolean;
  nounCount: number;
}
export interface AuthorityMappingListItem {
  nounCode: string;
  nounLabel: string;
  verbCode: string;
  verbLabel: string;
  isActive: boolean;
  // CR-072 — read-through from transition_definitions (see AuthorityMappingRow).
  trigger: "manual" | "governed" | null;
  defaultTrigger: "manual" | "governed";
  hasWiredTransitions: boolean;
}
export interface CodeLabelItem {
  code: string;
  label: string;
}

export type WriteResult = { ok: true } | { ok: false; error: string };

// Codes are identity/FK values — restricted to a safe, stable shape (letters,
// digits, underscore, hyphen). Nouns are PascalCase-ish entity types; verbs are
// lower_snake. We validate shape, not case, to stay permissive.
const CODE_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

export async function listAuthorityNouns(): Promise<AuthorityNounListItem[]> {
  const { data } = await authorityVocabularyDB.listNouns();
  return (data ?? []).map((r) => ({
    code: r.code,
    label: r.label,
    description: r.description,
    isActive: r.is_active,
    verbCount: r.verb_count,
    transitionCount: r.transition_count,
  }));
}

export async function listAuthorityVerbs(): Promise<AuthorityVerbListItem[]> {
  const { data } = await authorityVocabularyDB.listVerbs();
  return (data ?? []).map((r) => ({
    code: r.code,
    label: r.label,
    description: r.description,
    isActive: r.is_active,
    nounCount: r.noun_count,
  }));
}

export async function listAuthorityMapping(): Promise<AuthorityMappingListItem[]> {
  const { data } = await authorityVocabularyDB.listMapping();
  return (data ?? []).map((r) => ({
    nounCode: r.noun_code,
    nounLabel: r.noun_label,
    verbCode: r.verb_code,
    verbLabel: r.verb_label,
    isActive: r.is_active,
    trigger: r.trigger,
    defaultTrigger: r.default_trigger,
    hasWiredTransitions: r.has_wired_transitions,
  }));
}

// CR-072 — the only field this page edits on a mapping row: which of every
// transition_definitions row sharing this (noun, verb) is manual vs governed.
// Everything else about a mapping pair (add/retire) is unrelated to this.
export async function updateMappingTrigger(nounCode: string, verbCode: string, trigger: string): Promise<WriteResult> {
  if (trigger !== "manual" && trigger !== "governed") return { ok: false, error: `trigger must be "manual" or "governed", got "${trigger}"` };
  const { data: updatedCount, error } = await authorityVocabularyDB.updateTriggerForVerb(nounCode, verbCode, trigger);
  if (error) return { ok: false, error: error.message };
  if (!updatedCount) return { ok: false, error: `no transition uses ${nounCode} + ${verbCode} yet — nothing to update` };
  // Keeps the mapping's own default_trigger in step with an explicit correction
  // here, so the next NEW transition added under this pair starts consistent
  // with the ones just edited, rather than silently reverting to whatever was
  // chosen back when the pair was first Allowed.
  await authorityVocabularyDB.setDefaultTrigger(nounCode, verbCode, trigger);
  return { ok: true };
}

export async function listActiveNouns(): Promise<CodeLabelItem[]> {
  const { data } = await authorityVocabularyDB.listActiveNouns();
  return data ?? [];
}
export async function listActiveVerbs(): Promise<CodeLabelItem[]> {
  const { data } = await authorityVocabularyDB.listActiveVerbs();
  return data ?? [];
}
// noun code → its active verb codes (for constraining a transition's verb).
export async function activeMappingByNoun(): Promise<Record<string, string[]>> {
  const { data } = await authorityVocabularyDB.listActiveMappingPairs();
  const out: Record<string, string[]> = {};
  for (const { noun_code, verb_code } of data ?? []) (out[noun_code] ??= []).push(verb_code);
  return out;
}

// ── add ───────────────────────────────────────────────────────────────────
export async function addNoun(code: string, label: string, description: string | null): Promise<WriteResult> {
  const c = code.trim();
  if (!CODE_RE.test(c)) return { ok: false, error: `Noun code "${code}" is not a valid code (letters, digits, _ or -; must start with a letter).` };
  if (!label.trim()) return { ok: false, error: "Label is required." };
  const { error } = await authorityVocabularyDB.addNoun(c, label.trim(), description?.trim() || null);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function addVerb(code: string, label: string, description: string | null): Promise<WriteResult> {
  const c = code.trim();
  if (!CODE_RE.test(c)) return { ok: false, error: `Verb code "${code}" is not a valid code (letters, digits, _ or -; must start with a letter).` };
  if (!label.trim()) return { ok: false, error: "Label is required." };
  const { error } = await authorityVocabularyDB.addVerb(c, label.trim(), description?.trim() || null);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function addMapping(nounCode: string, verbCode: string, trigger?: string): Promise<WriteResult> {
  if (!nounCode || !verbCode) return { ok: false, error: "Both a noun and a verb are required." };
  if (trigger !== undefined && trigger !== "manual" && trigger !== "governed") {
    return { ok: false, error: `trigger must be "manual" or "governed", got "${trigger}"` };
  }
  const nouns = new Set((await listActiveNouns()).map((n) => n.code));
  const verbs = new Set((await listActiveVerbs()).map((v) => v.code));
  if (!nouns.has(nounCode)) return { ok: false, error: `"${nounCode}" is not an active noun.` };
  if (!verbs.has(verbCode)) return { ok: false, error: `"${verbCode}" is not an active verb.` };
  // Stored on the mapping itself, never applied retroactively to a
  // transition that already exists — re-submitting Allow for a pair that
  // already has real, wired transitions must never silently change their
  // trigger (the mapping upsert below is idempotent; only its OWN default
  // moves, nothing downstream of it).
  const { error } = await authorityVocabularyDB.addMapping(nounCode, verbCode, (trigger as "manual" | "governed" | undefined) ?? "manual");
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── retire (soft) ───────────────────────────────────────────────────────────
export async function retireNoun(code: string): Promise<WriteResult> {
  const { data, error } = await authorityVocabularyDB.retireNoun(code);
  if (error) return { ok: false, error: error.message };
  return data ? { ok: true } : { ok: false, error: `No noun "${code}".` };
}
export async function retireVerb(code: string): Promise<WriteResult> {
  const { data, error } = await authorityVocabularyDB.retireVerb(code);
  if (error) return { ok: false, error: error.message };
  return data ? { ok: true } : { ok: false, error: `No verb "${code}".` };
}
export async function retireMapping(nounCode: string, verbCode: string): Promise<WriteResult> {
  const { data, error } = await authorityVocabularyDB.retireMapping(nounCode, verbCode);
  if (error) return { ok: false, error: error.message };
  return data ? { ok: true } : { ok: false, error: `No mapping ${nounCode} → ${verbCode}.` };
}
