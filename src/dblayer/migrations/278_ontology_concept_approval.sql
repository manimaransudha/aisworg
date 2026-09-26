-- CR-113 item 6 — ConceptCreated approval flow.
--
-- Any participant holding ontology_approve sees every Draft concept and can
-- Approve (Draft -> Active) or Reject (Draft -> Draft, stays in Draft, with
-- mandatory feedback — same discipline as Objective's own Active -> Reject,
-- CR-073, migration 125's objective_comments). Both hops derive their badge
-- from the SAME verb ('approve') on purpose — there is no separate reject
-- badge here (owner: "only an approver can reject? they are 2 outcomes of
-- the same process").
CREATE TABLE IF NOT EXISTS ontology_concept_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id    UUID NOT NULL REFERENCES ontology_concepts(id),
  comment_text  TEXT NOT NULL,
  actor_id      INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ontology_concept_comments_concept_id ON ontology_concept_comments (concept_id, created_at);

-- transition_definitions rows (Version Feature Plan.md §3) — Draft -> Active
-- is the concept's first real activation (VersionActivated, same position as
-- Objective's own Activate row); Draft -> Draft (reject) is not
-- version-significant, same as Objective's own Reject row.
INSERT INTO transition_definitions (entity_type, from_state, to_state, event_type, version_event)
VALUES
  ('Ontology', 'Draft', 'Active', 'ConceptApproved', 'VersionActivated'),
  ('Ontology', 'Draft', 'Draft',  'ConceptRejected',  NULL)
ON CONFLICT (entity_type, from_state, to_state) DO UPDATE SET
  event_type = EXCLUDED.event_type,
  version_event = EXCLUDED.version_event;

UPDATE transition_definitions SET verb = 'approve'
WHERE entity_type = 'Ontology' AND from_state = 'Draft' AND to_state IN ('Active', 'Draft');

-- event_registry rows — events.event_type/event_subscriptions.event_type are
-- both FK'd to this table. ConceptCreated itself was never registered here
-- despite already being published (addConcept, emitConceptCreated) — a
-- pre-existing gap this pass also closes, since the new subscription below
-- requires the row to exist.
INSERT INTO event_registry (event_type, description) VALUES
  ('ConceptCreated', 'Ch.18 §14 — a new Ontology Concept code''s first Version (Draft), either from Ontology Management''s own Add/Save or proposed by an x-ontology-composable schema field elsewhere on the platform.'),
  ('ConceptApproved', 'CR-113 item 6 — an ontology_approve holder accepted a Draft concept; Draft -> Active.'),
  ('ConceptRejected', 'CR-113 item 6 — an ontology_approve holder rejected a Draft concept with feedback; stays Draft.')
ON CONFLICT (event_type) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO event_subscriptions (event_type, handler_name) VALUES
  ('ConceptCreated', 'conceptCreated')
ON CONFLICT (event_type, handler_name) DO NOTHING;

-- route_authority (CR-110) — the new Approvals tab + its two actions.
INSERT INTO route_authority (method, path, badges, roles, match_mode) VALUES
  ('GET',  '/aisworg/seu/sdk/ontology/approvals',         ARRAY['ontology_approve'], '{}', 'all'),
  ('POST', '/aisworg/seu/sdk/ontology/approvals/approve',  ARRAY['ontology_approve'], '{}', 'all'),
  ('POST', '/aisworg/seu/sdk/ontology/approvals/reject',   ARRAY['ontology_approve'], '{}', 'all')
ON CONFLICT (method, path) DO UPDATE SET
  badges     = EXCLUDED.badges,
  roles      = EXCLUDED.roles,
  match_mode = EXCLUDED.match_mode,
  updated_at = NOW();
