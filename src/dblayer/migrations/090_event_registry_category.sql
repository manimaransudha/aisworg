-- Ch.30 §7 — the illustrative Event Categories (State/Governance/Runtime/
-- Integration/Administrative) are a useful taxonomy independent of §7's own
-- specific (non-mandated) example event names. A property of the event TYPE
-- itself, not of any particular subscription, so it lives on event_registry,
-- not event_subscriptions.
--
-- Owner: "anytime you want to use a check, it is worth checking if it has to
-- be in ontology first" — kept as plain TEXT here (no CHECK constraint,
-- same as every other category field in this codebase), validated at
-- write-time against Ontology concepts (assertCanonicalCategory), exactly
-- the same mechanism as category:evidence/category:deliverable/etc.
-- (core/ontology.ts). Extensible without a migration — a new category is an
-- ontology_concepts row, not a schema/CHECK change.
ALTER TABLE event_registry
  ADD COLUMN category TEXT;

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:event-types', 'State', 'State Event', '11111111-1111-1111-1111-111111111111'),
  ('category:event-types', 'Governance', 'Governance Event', '11111111-1111-1111-1111-111111111111'),
  ('category:event-types', 'Runtime', 'Runtime Event', '11111111-1111-1111-1111-111111111111'),
  ('category:event-types', 'Integration', 'Integration Event', '11111111-1111-1111-1111-111111111111'),
  ('category:event-types', 'Administrative', 'Administrative Event', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
