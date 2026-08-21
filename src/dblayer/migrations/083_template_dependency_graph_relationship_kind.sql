-- CR-049 Phase 2 — Ch.15 §12's Derivation/Implementation/Decomposition,
-- authored as one more field per dependencyGraph entry, same convention as
-- migrations 076/080. Defaults to "dependency" (existing behaviour, existing
-- seeded Templates' entries round-trip unchanged with no data migration).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,dependencyGraph,items,properties,relationshipKind}',
                  '{"type": "string", "enum": ["dependency", "derivation", "implementation", "decomposition"], "default": "dependency", "x-help": "Only meaningful for a Deliverable-type prerequisite (Ch.15 §12). Implementation/Decomposition carry over unchanged on Template Inheritance (a tenant may rename either end to their own specialised Deliverable, but not restructure the edge); Derivation is freely editable; plain Dependency is unrestricted, as today."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Template' AND version = 1;
