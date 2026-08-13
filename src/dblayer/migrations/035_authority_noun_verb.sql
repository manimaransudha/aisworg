-- CR-006 — Authority as noun × verb (Stage 1a: config schema).
--
-- The clean authority model: a governed transition is a VERB applied to a
-- NOUN. Two SDK-authorable vocabularies (Work outcome = nouns, Work process
-- = verbs) plus a mapping (which verbs are legal on a noun); each transition
-- carries exactly one verb, so the required badge is `noun_verb` directly.
--
-- This migration is ADDITIVE only — it creates the vocabulary tables and adds
-- a nullable `verb` column to transition_definitions. Nothing reads `verb`
-- yet (enforcement collapse is a later stage); authority_rules /
-- badgeAuthorityEngine are untouched here. Seeding the vocabularies and
-- back-filling the verb per transition is done by the separate, re-runnable
-- seedAuthorityVocabulary script (so db:clean-slate can reuse it).

-- Work outcome — the noun vocabulary (the governed entity types). Making this
-- data is what retires the hand-widened transition_definitions.entity_type
-- CHECK: a new noun (Document, Certificate…) becomes a row, not a migration.
CREATE TABLE IF NOT EXISTS authority_nouns (
  code        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Work process — the verb vocabulary (create, review, approve, baseline,
-- define…). Global; reused across nouns (a `noun_` prefix keeps badges
-- distinct, e.g. obligation_assign vs participant_assign).
CREATE TABLE IF NOT EXISTS authority_verbs (
  code        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mapping — which verbs are allowed on which noun. The Transition Definition
-- rows for a noun each pick one verb from this allowed set.
CREATE TABLE IF NOT EXISTS authority_noun_verbs (
  noun_code  TEXT NOT NULL REFERENCES authority_nouns(code) ON DELETE CASCADE,
  verb_code  TEXT NOT NULL REFERENCES authority_verbs(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (noun_code, verb_code)
);

-- Each transition carries exactly one verb. Kept as plain TEXT (like
-- entity_type) rather than a hard FK for now — the seed back-fills it and the
-- enforcement stage will tighten it; additive and low-risk here.
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS verb TEXT;
