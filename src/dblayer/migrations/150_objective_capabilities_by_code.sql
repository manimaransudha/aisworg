-- Objective↔Capability by code (CR-086 step 2, resolving CR-085's own
-- deferred question). Owner: "The ontology for capability-name in CR086
-- overrides any previous definition." CR-085 already settled that an
-- Objective "does not need [to] know where the capability code came from. It
-- just needs the capability code... This is not objective's job" — resolving
-- a bare code to one specific Pack's `capabilities` row belongs at the
-- Template/commissioning layer, not here.
--
-- objective_capabilities previously stored capability_id, a FK into the
-- functional, Pack-instance-scoped `capabilities` table (populated by
-- seedContributions on every Pack publish — a completely different vocabulary
-- from the Ontology's capability-name concepts, per CR-086). Replaced here
-- with the bare capability-name code directly. No DB-level FK to
-- ontology_concepts (it's tenant-scoped/composite-keyed, and every other
-- Ontology-governed field in the codebase validates the same way — an
-- application-layer assertCanonicalCategory check, not a DB constraint).
ALTER TABLE objective_capabilities ADD COLUMN IF NOT EXISTS capability_code TEXT;

UPDATE objective_capabilities oc
   SET capability_code = c.code
  FROM capabilities c
 WHERE c.id = oc.capability_id
   AND oc.capability_code IS NULL;

ALTER TABLE objective_capabilities DROP CONSTRAINT IF EXISTS objective_capabilities_pkey;
ALTER TABLE objective_capabilities DROP COLUMN IF EXISTS capability_id;
ALTER TABLE objective_capabilities ALTER COLUMN capability_code SET NOT NULL;
ALTER TABLE objective_capabilities ADD CONSTRAINT objective_capabilities_pkey PRIMARY KEY (objective_id, capability_code);
