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
  }));
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

export async function addMapping(nounCode: string, verbCode: string): Promise<WriteResult> {
  if (!nounCode || !verbCode) return { ok: false, error: "Both a noun and a verb are required." };
  const nouns = new Set((await listActiveNouns()).map((n) => n.code));
  const verbs = new Set((await listActiveVerbs()).map((v) => v.code));
  if (!nouns.has(nounCode)) return { ok: false, error: `"${nounCode}" is not an active noun.` };
  if (!verbs.has(verbCode)) return { ok: false, error: `"${verbCode}" is not an active verb.` };
  const { error } = await authorityVocabularyDB.addMapping(nounCode, verbCode);
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
