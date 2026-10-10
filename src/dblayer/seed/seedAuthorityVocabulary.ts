import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { userDB } from "../userDB.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface VocabItem {
  code: string;
  label: string;
  description?: string;
}
interface TransitionVerb {
  entityType: string;
  fromState: string;
  toState: string;
  verb: string;
}
interface AuthoringMapping {
  noun: string;
  verbs: string[];
}
interface AuthorityVocabulary {
  nouns: VocabItem[];
  verbs: VocabItem[];
  transitions: TransitionVerb[];
  authoringMappings?: AuthoringMapping[];
}

interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

function loadVocabulary(): AuthorityVocabulary {
  const raw = readFileSync(path.join(__dirname, "data", "authorityVocabulary.json"), "utf8");
  return JSON.parse(raw) as AuthorityVocabulary;
}

export async function seedAuthorityVocabulary(actor: SeedActor): Promise<void> {
  const vocab = loadVocabulary();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("TRUNCATE TABLE authority_nouns, authority_verbs CASCADE");

    for (const n of vocab.nouns) {
      await client.query(
        `INSERT INTO authority_nouns (code, label, description, author_id, author_badge)
        VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, is_active = TRUE, author_id = EXCLUDED.author_id, author_badge = EXCLUDED.author_badge`,
        [n.code, n.label, n.description ?? null, actor.authoredBy,  actor.authorBadge]
      );
    }

    for (const v of vocab.verbs) {
      await client.query(
        `INSERT INTO authority_verbs (code, label, description, author_id, author_badge)
        VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, is_active = TRUE, author_id = EXCLUDED.author_id, author_badge = EXCLUDED.author_badge`,
        [v.code, v.label, v.description ?? null, actor.authoredBy,  actor.authorBadge]
      );
    }

    const pairs: Array<[string, string]> = [];
    const seen = new Set<string>();
    const addPair = (nounCode: string, verbCode: string): void => {
      const key = nounCode + String.fromCharCode(31) + verbCode;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push([nounCode, verbCode]);
    };
    for (const t of vocab.transitions) addPair(t.entityType, t.verb);
    for (const m of vocab.authoringMappings ?? []) {
      for (const verb of m.verbs) addPair(m.noun, verb);
    }
    for (const [nounCode, verbCode] of pairs) {
      await client.query(
        `INSERT INTO authority_noun_verbs (noun_code, verb_code, author_id, author_badge)
        VALUES ($1, $2, $3, $4)
         ON CONFLICT (noun_code, verb_code) DO UPDATE SET  author_id = EXCLUDED.author_id, author_badge = EXCLUDED.author_badge`,
        [nounCode, verbCode, actor.authoredBy,  actor.authorBadge]
      );
    }

    let matched = 0;
    const unmatched: string[] = [];
    for (const t of vocab.transitions) {
      const { rowCount } = await client.query(
        `UPDATE transition_definitions SET verb = $4
         WHERE entity_type = $1 AND from_state = $2 AND to_state = $3`,
        [t.entityType, t.fromState, t.toState, t.verb]
      );
      if (rowCount && rowCount > 0) matched += rowCount;
      else unmatched.push(`${t.entityType} ${t.fromState}→${t.toState}`);
    }

    await client.query("COMMIT");
    logger.info(
      `[seed:authority-vocab] ${vocab.nouns.length} nouns, ${vocab.verbs.length} verbs, ${pairs.length} noun-verb mappings; verb set on ${matched} transition definition rows.`
    );
    if (unmatched.length) {
      logger.warn(`[seed:authority-vocab] ${unmatched.length} seeded transitions had no matching transition_definitions row`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { actorId, actorBadge } = await userDB.getSuperuserId();
  if (!actorId) throw new Error("No participants_master row for user_id 1 -- log in as root first.");
  seedAuthorityVocabulary({ authoredBy: actorId, authorBadge: actorBadge })
    .catch((err) => {
      logger.error("[seed:authority-vocab] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
