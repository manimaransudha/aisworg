-- CR-067 — Composition Strategy engine, wired to Pack first. `compositionSources`
-- names the Pack(s) a Composition Strategy combines from — how many, and
-- whether they must share this Pack's own code, depends on the chosen
-- strategy (compositionEngine.strategyRequirements). Same shape and
-- resolution discipline as `dependencies`: an array of {packCode}, resolved
-- live via findActiveByCode at compose-time rather than a pinned row id
-- (013_template_profile_pack_by_code.sql's own fix for exactly this
-- problem), not a single FK column — composition can have multiple sources,
-- unlike Template/Profile/Deliverable Definition's own single-parent
-- inheritance columns.
ALTER TABLE packs ADD COLUMN composition_sources JSONB NOT NULL DEFAULT '[]';

-- Schema field: same referential-list + x-referential:"pack-code" mechanism
-- Dependencies already uses (no new widget code for the picker itself).
-- x-show-when is new — the field stays hidden in the authoring form until
-- compositionStrategy has a value, then appears (owner: "when a composition
-- strategy is chosen, the UI widget should appear"). Not added to `required`
-- — same "optional field, conditionally validated" treatment
-- compositionStrategy itself already gets (validatePackSeed enforces the
-- real per-strategy arity once compositionStrategy is actually set).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,compositionSources}',
                  '{"type":"array","x-help":"Pack(s) this Composition Strategy combines from (§8/§21) — how many, and whether they must share this Pack''s own code, depends on the chosen strategy.","x-widget":"referential-list","x-show-when":"compositionStrategy","items":{"type":"object","properties":{"packCode":{"type":"string","x-referential":"pack-code","x-label":"Pack"}}}}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
