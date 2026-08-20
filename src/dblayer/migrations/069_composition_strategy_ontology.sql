-- Ontology (Ch.18) — composition-strategy concepts. Owner, 2026-08-19 (CR-030):
-- "composition strategy field in the pack authoring details below; these
-- have to be declared as composition strategy in Ontology and on the pack,
-- this is a dropdown field" — the seven values and definitions given
-- verbatim, seeded here (description = the owner's own definition, shown as
-- live guidance under the dropdown, same mechanism CR-023 built for
-- template-categories). Platform-owned, open vocabulary like every other
-- concept type — a tenant may add its own via Ontology Management.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, description) VALUES
  ('composition-strategy', 'override', 'Override', '11111111-1111-1111-1111-111111111111', 'The new contribution replaces the existing one entirely. Nothing survives from the original. This is the tenant-overrides-a-Domain-Pack case: the tenant''s content fully takes the platform''s place, for them.'),
  ('composition-strategy', 'merge', 'Merge', '11111111-1111-1111-1111-111111111111', 'The two contributions are reconciled into one, field by field, where they overlap — not just concatenated, actually combined.'),
  ('composition-strategy', 'supplement', 'Supplement', '11111111-1111-1111-1111-111111111111', 'The new contribution adds to the existing one without touching it; the original stays primary, the addition is secondary. Asymmetric — one Pack''s content is base, the other''s is extra.'),
  ('composition-strategy', 'union', 'Union', '11111111-1111-1111-1111-111111111111', 'The plain set-combination: every item from every contributing Pack, treated as equal peers, nothing dropped.'),
  ('composition-strategy', 'intersection', 'Intersection', '11111111-1111-1111-1111-111111111111', 'Only what both contributions agree on survives; anything unique to just one is dropped.'),
  ('composition-strategy', 'alias', 'Alias', '11111111-1111-1111-1111-111111111111', 'One contribution is just a different name pointing at the same underlying thing — no new content, just a redirect. The mechanism behind Ontology code/name relabeling, applied as a Pack-level composition move rather than a display-label rule.'),
  ('composition-strategy', 'conflict-detection', 'Conflict Detection', '11111111-1111-1111-1111-111111111111', 'Deliberately does not auto-combine. Flags that two contributions disagree and surfaces it for resolution rather than silently picking one — backs the EBM conflict-blocks-commissioning behaviour (FR-3.6/3.7).')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
