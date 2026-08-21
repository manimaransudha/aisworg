-- CR-043 follow-up (found running tests) — deriveDependencyDefinitionsFromCatalogue's
-- delete-then-insert isn't atomic against another process doing the same
-- thing concurrently for the same owner (two DELETEs can both see "nothing
-- to remove" before either INSERT commits, since there's no row for either
-- to lock against) — 16+ test files each call ensureWebAppTemplateFixture
-- in their own node --test process, all against the same shared dev
-- database, and duplicate rows accumulated across repeated runs. A real
-- uniqueness constraint on the natural key turns a silent duplicate insert
-- into a no-op instead. NULLS NOT DISTINCT (PG15+) so two unnamed-type rows
-- (from_name IS NULL) with everything else equal collide too, not just
-- named ones — plain UNIQUE treats NULL as distinct from itself otherwise.
ALTER TABLE dependency_definitions
  ADD CONSTRAINT dependency_definitions_natural_key
  UNIQUE NULLS NOT DISTINCT (owning_entity_type, owning_entity_id, from_entity_type, from_name, from_state, to_entity_type, to_name, to_state);
