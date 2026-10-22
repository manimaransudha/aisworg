import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { query } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { userDB } from "../userDB.js";
import { authorityVocabularyDB } from "../authorityVocabularyDB.js";
import { transitionDefinitionsDB } from "../transitionDefinitionsDB.js";
import { ATTESTATION_REQUIRED_POLICY_CODE, getPlatformTenantId } from "../constants.js";
import { isRegisteredAction } from "../../actions/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

interface TransitionDefinitionSeed {
  entityType: string;
  fromState: string;
  toState: string;
  verb?: string;
  requiredAuthorityRuleId?: string;
  requiredPolicyCodes?: string[];
  requiredQualityGateIds?: string[];
  createsObligation?: string;
  category?: string;
  trigger?: "manual" | "governed";
  submitVerb?: string;
  attestationRequired?: boolean;
  eventType?: string;
  versionEvent?: string;
  versionHop?: boolean;
  actionCode?: string;
  submitVersionEvent?: string;
  isActive?: boolean;
  retiredAt?: string;
}

interface VocabItem {
  code: string;
  label: string;
  description?: string;
  isActive?: boolean;
}

interface AuthorityVocabulary {
  nouns: VocabItem[];
  verbs: VocabItem[];
  nounVerbs?: Array<{ noun: string; verb: string; defaultTrigger?: "manual" | "governed"; isActive?: boolean }>;
}

let cachedSeeds: TransitionDefinitionSeed[] | null = null;
function loadSeeds(): TransitionDefinitionSeed[] {
  if (!cachedSeeds) {
    const raw = readFileSync(path.join(__dirname, "data", "transitionDefinitions.json"), "utf8");
    cachedSeeds = JSON.parse(raw) as TransitionDefinitionSeed[];
  }
  return cachedSeeds;
}

function loadVocabulary(): AuthorityVocabulary {
  return JSON.parse(readFileSync(path.join(__dirname, "data", "authorityVocabulary.json"), "utf8")) as AuthorityVocabulary;
}

function findDuplicates(keys: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  }
  return [...dupes];
}

// Loads the Authority vocabulary (nouns, verbs) and the transition definitions together: each
// transition carries its own verb, and the noun-verb pairs are derived from the transitions. The vocabulary and the transition definitions are deleted and reloaded.
export async function seedTransitionDefinitions(actor: SeedActor): Promise<void> {
  const seeds = loadSeeds();
  const vocab = loadVocabulary();

  const problems: string[] = [];
  const nounCodes = new Set(vocab.nouns.map((n) => n.code));
  const verbCodes = new Set(vocab.verbs.map((v) => v.code));
  for (const key of findDuplicates(vocab.nouns.map((n) => n.code))) problems.push(`duplicate noun: ${key}`);
  for (const key of findDuplicates(vocab.verbs.map((v) => v.code))) problems.push(`duplicate verb: ${key}`);
  for (const key of findDuplicates(seeds.map((s) => `${s.entityType}|${s.fromState}|${s.toState}`))) problems.push(`duplicate transition: ${key}`);

  for (const key of findDuplicates((vocab.nounVerbs ?? []).map((nv) => `${nv.noun}|${nv.verb}`))) problems.push(`duplicate nounVerbs entry: ${key}`);
  const overrides = new Map((vocab.nounVerbs ?? []).map((nv) => [`${nv.noun}|${nv.verb}`, nv]));

  const pairKeys = new Set<string>();
  const pairs: Array<{ nounCode: string; verbCode: string; defaultTrigger: "manual" | "governed"; isActive: boolean }> = [];
  const addPair = (nounCode: string, verbCode: string, source: string): void => {
    if (!nounCodes.has(nounCode)) problems.push(`${source}: unknown noun ${nounCode}`);
    if (!verbCodes.has(verbCode)) problems.push(`${source}: unknown verb ${verbCode}`);
    const key = `${nounCode}|${verbCode}`;
    if (pairKeys.has(key)) return;
    pairKeys.add(key);
    const override = overrides.get(key);
    pairs.push({ nounCode, verbCode, defaultTrigger: override?.defaultTrigger ?? "manual", isActive: override?.isActive ?? true });
  };
  for (const s of seeds) if (s.verb) addPair(s.entityType, s.verb, `transition ${s.entityType}|${s.fromState}|${s.toState}`);
  for (const nv of vocab.nounVerbs ?? []) addPair(nv.noun, nv.verb, "nounVerbs");
  // Policy codes resolve to the Active, Platform-owned Policy Definitions seeded before this step. A code with no
  // Policy Definition is an error: it would otherwise leave the transition without the Policy it names.
  const policyCodes = [...new Set(seeds.flatMap((s) => s.requiredPolicyCodes ?? []))];
  const policyIdByCode = new Map<string, string>();
  if (policyCodes.length > 0) {
    const { rows: policyRows } = await query<{ id: string; code: string }>(
      "SELECT id, code FROM policy_definitions WHERE code = ANY($1::text[]) AND status = 'Active' AND tenant_id = $2",
      [policyCodes, await getPlatformTenantId()]
    );
    for (const row of policyRows) {
      if (policyIdByCode.has(row.code)) problems.push(`policy code ${row.code}: more than one Active Policy Definition`);
      policyIdByCode.set(row.code, row.id);
    }
    for (const code of policyCodes) if (!policyIdByCode.has(code)) problems.push(`policy code ${code}: no Active Policy Definition — seed Policy Definitions first`);
  }
  for (const s of seeds) if (s.actionCode && !isRegisteredAction(s.actionCode)) problems.push(`transition ${s.entityType}|${s.fromState}|${s.toState}: action ${s.actionCode} has no implementation in src/actions`);
  if (problems.length) throw new Error(`[seed:transition-definitions] invalid seed data:\n  ${problems.join("\n  ")}`);

  const vocabulary = await authorityVocabularyDB.replaceVocabulary({
    nouns: vocab.nouns.map((n) => ({ code: n.code, label: n.label, description: n.description ?? null, isActive: n.isActive ?? true })),
    verbs: vocab.verbs.map((v) => ({ code: v.code, label: v.label, description: v.description ?? null, isActive: v.isActive ?? true })),
    pairs,
    authorId: actor.authoredBy,
    authorBadge: actor.authorBadge,
  });
  if (vocabulary.error || !vocabulary.data) throw vocabulary.error ?? new Error("authority vocabulary reload failed");

  // A transition that requires an attestation carries the UUID of the Policy Definition that states the requirement.
  let attestationPolicyId: string | null = null;
  if (seeds.some((s) => s.attestationRequired)) {
    const { rows } = await query<{ id: string }>(
      "SELECT id FROM policy_definitions WHERE code = $1 AND status = 'Active' AND tenant_id = $2",
      [ATTESTATION_REQUIRED_POLICY_CODE, await getPlatformTenantId()]
    );
    if (rows.length !== 1) throw new Error(`[seed:transition-definitions] expected one Active Policy Definition "${ATTESTATION_REQUIRED_POLICY_CODE}", found ${rows.length} — seed Policy Definitions first`);
    attestationPolicyId = rows[0].id;
  }

  const transitions = await transitionDefinitionsDB.replaceAll(
    seeds.map((s) => ({
      entityType: s.entityType,
      fromState: s.fromState,
      toState: s.toState,
      verb: s.verb ?? null,
      requiredAuthorityRuleId: s.requiredAuthorityRuleId ?? null,
      requiredPolicyIds: [...(s.requiredPolicyCodes ?? []).map((code) => policyIdByCode.get(code)!), ...(s.attestationRequired && attestationPolicyId ? [attestationPolicyId] : [])],
      requiredQualityGateIds: s.requiredQualityGateIds ?? [],
      createsObligation: s.createsObligation ?? null,
      category: s.category ?? null,
      trigger: s.trigger ?? "manual",
      submitVerb: s.submitVerb ?? null,
      eventType: s.eventType ?? null,
      versionEvent: s.versionEvent ?? null,
      versionHop: s.versionHop ?? null,
      actionCode: s.actionCode ?? null,
      submitVersionEvent: s.submitVersionEvent ?? null,
      isActive: s.isActive ?? true,
      retiredAt: s.retiredAt ?? null,
      authorId: actor.authoredBy,
      authorBadge: actor.authorBadge,
    }))
  );
  if (transitions.error || transitions.data === undefined) throw transitions.error ?? new Error("transition definitions reload failed");

  const { nouns, verbs } = vocabulary.data;
  logger.info(`[seed:transition-definitions] ${nouns} nouns, ${verbs} verbs, ${vocabulary.data.pairs} noun-verb mappings, ${transitions.data} transition definitions reloaded.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error("No participants_master row for user_id 1 -- log in as root first.");
  seedTransitionDefinitions({ authoredBy: actorId, authorBadge: actorBadge })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("[seedTransitionDefinitions] failed", err as Error);
      process.exit(1);
    });
}