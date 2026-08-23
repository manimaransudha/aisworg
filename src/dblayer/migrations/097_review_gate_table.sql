-- CR-059 — Review Gate becomes a real, persisted, referenceable entity.
--
-- Design settled across a multi-message discussion (2026-08-22): unlike
-- Quality Gate, Review Gate needs no `category` axis at all. Owner:
-- "category-as-gate-code exists to solve a specific problem — multiple
-- independently-authored Packs contributing separate checklist items that
-- need to union-compose into one gate. Review doesn't have that problem. A
-- review is a single reviewer's verdict on one specific deliverable
-- version." Review Gate's real key is (deliverable-name, entity_type,
-- from_state, to_state) — the same materialization-key shape Quality Gate
-- uses, with the deliverable's own type standing in for category. `code`
-- IS that deliverable-name value (owner: "code could just be the
-- deliverable-type code, but it should show up on the form... a pack can
-- hold multiple checklists for different deliverable-type-code") — unlike
-- Quality Gate's own code=category collapse, this stays visible/mandatory
-- on the authoring form rather than being hidden.
--
-- No `category`/`criteria` columns: Quality Gate's own VerifiableItemFields
-- (statement/prompt/participant/...) are declaration-only, never persisted
-- as real quality_gates columns either (they live only in the Pack's raw
-- contributions JSONB) — Review Gate follows the identical precedent.
CREATE TABLE IF NOT EXISTS review_gates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL,
  name                  TEXT NOT NULL,
  entity_type           TEXT NOT NULL CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack', 'Participant', 'Review', 'Finding', 'Template', 'Profile')),
  from_state            TEXT NOT NULL,
  to_state              TEXT NOT NULL,
  originating_pack_id   UUID REFERENCES packs(id),
  version               TEXT NOT NULL DEFAULT '1.0',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active Review Gate per deliverable type per transition, same
-- partial-unique-index discipline as quality_gates_active_scope_category_key.
CREATE UNIQUE INDEX IF NOT EXISTS review_gates_active_scope_key
  ON review_gates (entity_type, from_state, to_state, code)
  WHERE is_active;

-- Linking a real Review back to the Review Gate that produced it — settled
-- as in-scope, not deferred (owner: "this can lead to corrupt data" —
-- matching by a deliverable-name string alone can't tell which transition's
-- Review was intended when the same deliverable type is reviewed more than
-- once in its lifecycle, and can't guarantee the Review actually followed
-- the gate's own declared prompt/participant/outputContract). Nullable:
-- standalone Reviews unrelated to any gate remain allowed.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_gate_id UUID REFERENCES review_gates(id);
