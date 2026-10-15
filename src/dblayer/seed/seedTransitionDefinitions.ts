import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { query } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { userDB } from "../userDB.js";
import { authorityVocabularyDB } from "../authorityVocabularyDB.js";
import { transitionDefinitionsDB } from "../transitionDefinitionsDB.js";

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
  requiredPolicyIds?: string[];
  requiredPolicyCodes?: string[];
  requiredQualityGateIds?: string[];
  createsObligation?: string;
  category?: string;
  trigger?: "manual" | "governed";
  submitVerb?: string;
  eventType?: string;
  versionEvent?: string;
  versionHop?: boolean;
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
  authoringMappings?: Array<{ noun: string; verbs: string[] }>;
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

export async function backfillPolicyCode(code: string, policyId: string): Promise<void> {
  const wanting = loadSeeds().filter((s) => (s.requiredPolicyCodes ?? []).includes(code));
  for (const seed of wanting) {
    await query(
      `UPDATE transition_definitions
          SET required_policy_ids = CASE WHEN $4::uuid = ANY(required_policy_ids) THEN required_policy_ids ELSE array_append(required_policy_ids, $4::uuid) END
        WHERE entity_type = $1 AND from_state = $2 AND to_state = $3`,
      [seed.entityType, seed.fromState, seed.toState, policyId]
    );
  }
}

// Loads the Authority vocabulary (nouns, verbs) and the transition definitions together: each
// transition carries its own verb, and the noun-verb pairs are derived from the transitions plus
// the authoring mappings. The vocabulary and the transition definitions are deleted and reloaded.
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
  for (const m of vocab.authoringMappings ?? []) for (const verb of m.verbs) addPair(m.noun, verb, "authoringMappings");
  for (const nv of vocab.nounVerbs ?? []) addPair(nv.noun, nv.verb, "nounVerbs");
  if (problems.length) throw new Error(`[seed:transition-definitions] invalid seed data:\n  ${problems.join("\n  ")}`);

  const vocabulary = await authorityVocabularyDB.replaceVocabulary({
    nouns: vocab.nouns.map((n) => ({ code: n.code, label: n.label, description: n.description ?? null, isActive: n.isActive ?? true })),
    verbs: vocab.verbs.map((v) => ({ code: v.code, label: v.label, description: v.description ?? null, isActive: v.isActive ?? true })),
    pairs,
    authorId: actor.authoredBy,
    authorBadge: actor.authorBadge,
  });
  if (vocabulary.error || !vocabulary.data) throw vocabulary.error ?? new Error("authority vocabulary reload failed");

  const transitions = await transitionDefinitionsDB.replaceAll(
    seeds.map((s) => ({
      entityType: s.entityType,
      fromState: s.fromState,
      toState: s.toState,
      verb: s.verb ?? null,
      requiredAuthorityRuleId: s.requiredAuthorityRuleId ?? null,
      requiredPolicyIds: s.requiredPolicyIds ?? [],
      requiredQualityGateIds: s.requiredQualityGateIds ?? [],
      createsObligation: s.createsObligation ?? null,
      category: s.category ?? null,
      trigger: s.trigger ?? "manual",
      submitVerb: s.submitVerb ?? null,
      eventType: s.eventType ?? null,
      versionEvent: s.versionEvent ?? null,
      versionHop: s.versionHop ?? null,
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