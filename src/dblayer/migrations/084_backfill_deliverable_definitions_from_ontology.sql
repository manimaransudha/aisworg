-- CR-049 Phase 1 bug fix (owner, 2026-08-21: "Should it not have shown the
-- platform deliverables that are in the ontology?") — the 23 pre-existing,
-- Platform-owned `deliverable-name` Ontology concepts (migration 030 +
-- everything added since via the old simple CRUD, before this CR's own
-- addConcept guard) predate the new `deliverable_definitions` table entirely
-- and were never backfilled into it. Concretely broken as a result:
--   1. Invisible on the Deliverable Definitions Registry (this bug report).
--   2. Invisible to listInheritableDeliverableDefinitions (queries
--      deliverable_definitions only) — a tenant could not actually inherit
--      from "Requirements Specification"/"Business Rules" etc. through the
--      Inherit control, contradicting CR-049's own worked examples, which
--      name these exact concepts as the canonical roots to specialise from.
--   3. Unusable as a lineage root for Phase 2's isRenameOf check, for the
--      same reason.
--
-- One deliverable_definitions row per existing Active deliverable-name
-- concept: Platform-owned, Active, version 1.0.0, no parent (they ARE the
-- roots) — the exact shape a Definition reaching Active through the real
-- authoring pipeline would already have. Idempotent (WHERE NOT EXISTS) —
-- safe to run again after any future manual addition to ontology_concepts.
INSERT INTO deliverable_definitions (code, description, version, status, tenant_id)
SELECT oc.code, oc.description, '1.0.0', 'Active', oc.tenant_id
  FROM ontology_concepts oc
 WHERE oc.concept_type = 'deliverable-name'
   AND oc.is_active
   AND NOT EXISTS (
     SELECT 1 FROM deliverable_definitions dd
      WHERE dd.code = oc.code AND dd.tenant_id = oc.tenant_id
   );
