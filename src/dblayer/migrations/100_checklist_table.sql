-- CR-060 — Checklist becomes a real, persisted, cross-Pack-referenceable
-- entity, despite having no independent version or lifecycle of its own
-- (Chapter 47 §16, as the owner edited it: "nothing outside its own Pack
-- ever holds a stable reference to a specific Checklist" describes model
-- reach, not a ban on a physical table — owner: "Checklist can be in a
-- table to get a fk. the chapter does not impose the implementation
-- details."). A real table is needed because Review Gate and Quality Gate
-- both gain a `checklist_ids` FK-array pointing at it (099/101).
--
-- No version/is_active/lifecycle columns, and no code/category/capability/
-- applicable-deliverable-type/applicable-transition columns either — all of
-- that scope is carried by whichever gate(s) reference the Checklist, not
-- duplicated here (owner: "Checklist is just the mechanism for review and
-- quality gate"). `items` is a single JSONB array, not a child table
-- (owner: "Inside the checklist table, the list of actual checklist items
-- can be an array.") — each item: statement, prompt, participant
-- (AI/AI+human/human), outputContract, assurance, externalEvidence,
-- mandatory (Mandatory/Recommended). No per-item identifier — items are
-- positional within the array (Ch.47 §9).
--
-- `id` stays stable across every republish of the originating Pack (owner:
-- "It stays... Someone wants to update the checklist with a new item, they
-- can without a version change") — seedContributions upserts this row in
-- place, keyed by (originating_pack_id, name), so any gate's checklist_ids
-- reference survives a Pack republish untouched.
--
-- originating_pack_id is provenance only, not a reference-scoping
-- constraint: any Pack's gate may reference any Pack's checklist by its
-- real id, same reach as Policy (owner: "any Pack's gate can point at any
-- Pack's checklist, same reach as Policy" — checked against "must Pack
-- codes match" and rejected: "code is not unique. so how does it matter?",
-- packs.code being only unique per (code, pack_version, tenant_id), CR-026).
CREATE TABLE IF NOT EXISTS checklists (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  description           TEXT,
  originating_pack_id   UUID NOT NULL REFERENCES packs(id),
  items                 JSONB NOT NULL DEFAULT '[]',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upsert key: one Checklist per (originating Pack, name) — a republish of
-- the same Pack with the same-named Checklist updates this same row rather
-- than minting a new one.
CREATE UNIQUE INDEX IF NOT EXISTS checklists_pack_name_key
  ON checklists (originating_pack_id, name);
