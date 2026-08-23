-- CR-058 follow-up 2, correction — migration 093 removed `criteriaCategory`
-- entirely, on the assumption that the gate's own `category` (now = code,
-- category:evidence-backed) could serve every criteria type's category
-- narrowing. Wrong for requires_accepted_review specifically: Review has its
-- own category vocabulary (Ch.25 §7 — Requirements/Architecture/Design/
-- Code/Security/Test/Deployment/Operational, still free text), disjoint
-- from Evidence's — confirmed by tests/review-model.test.ts's own
-- category-specific-Review-gate test, which constructs
-- `criteria: { type: "requires_accepted_review", category: "Architecture" }`
-- directly against the DB layer, independent of Pack authoring. The engine
-- capability was never meant to be removed; only the Pack-authoring FORM
-- field needs restoring here.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionQualityGates,items,properties,criteriaCategory}',
                  '{"type": "string", "x-help": "Review category (requires_accepted_review only) — a different vocabulary from this gate’s own Category field"}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
