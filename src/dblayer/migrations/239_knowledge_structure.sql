-- Ch.16 "firm up the Knowledge structure" session (2026-09-19). Closes
-- several §8/§10/§14 gaps flagged in §20.5/§20.11: Evidence References was a
-- singular nullable FK (not the plural §8 field), Related Knowledge (§10)
-- and Decision References/Deliverable References had no column at all,
-- Version/Confidence Level/originating Participant/authority were entirely
-- missing. This database has zero live knowledge_items rows (§20 preamble),
-- so every change below is additive/replacing with no data to carry forward
-- — unlike Decision's own migration 231, which had real rows to migrate.
--
-- Shared reference shape (§10's 7 relationship types), reused identically
-- across evidence_references/deliverable_references/decision_references/
-- knowledge_references: {"derives from": [...], "supports": [...],
-- "contradicts": [...], "refines": [...], "references": [...],
-- "depends upon": [...]}. "supersedes" is additionally valid only inside
-- knowledge_references (owner: "superseded should stay within knowledge
-- references only" — every other type applies universally, owner:
-- "knowledge can contradict anything"). knowledge_references must never
-- contain the row's own id — enforced in application code
-- (createKnowledgeItem/updateKnowledgeReferences), not a DB CHECK, since a
-- JSONB-nested self-reference check isn't cleanly expressible as one.
--
-- deliverable_id (the single producing-Deliverable provenance FK, §14) is
-- kept as-is — structurally load-bearing (SEU derivation, Engineering
-- Capital's own join) and a distinct concept from the new, broader
-- deliverable_references (§8).
--
-- version/author_id/authority_badge mirror Objective's `version` column and
-- Decision's `participant_id`/`authority_badge` (migration 231) exactly:
-- version starts at '1.0.0' (no bump logic yet — no Edit path exists to
-- bump on, deferred per the owner's own note); author_id is set at creation
-- (ungoverned, no badge yet) and updated on every governed transition
-- thereafter alongside authority_badge, from the resolved TransitionOutcome
-- — the row always reflects the most recent actor, full history stays in
-- `events`. author_id references participants(id), not users(id) directly
-- — same resolution decisionsDB's own participant_id already uses
-- (owner: "participant id and user id are 1:1" — either works, this
-- matches the sibling Ch.19 precedent).
-- IF NOT EXISTS on every ADD COLUMN (repo convention, run.ts's own header:
-- "every statement across all files is CREATE ... IF NOT EXISTS / DROP ...
-- IF EXISTS + re-ADD, safe to run repeatedly" — migrations carry no applied
-- ledger and may be replayed in full at any time).
ALTER TABLE knowledge_items
  DROP COLUMN IF EXISTS evidence_id,
  ADD COLUMN IF NOT EXISTS deliverable_references JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS evidence_references JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decision_references JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS knowledge_references JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS confidence_level TEXT,
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS authority_badge TEXT;

-- Ch.16 §11 Validation / §14 "validation history" — append-only, no forced
-- gate on any one transition (owner: "no forced gate"). Same shape as
-- objective_comments (migration 125) / pack_comments (migration 137):
-- insert-only, never UPDATEd/DELETEd at the application layer.
CREATE TABLE IF NOT EXISTS knowledge_validation_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id),
  note_text         TEXT NOT NULL,
  actor_id          INTEGER REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_validation_notes_item ON knowledge_validation_notes (knowledge_item_id, created_at);
