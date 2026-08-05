-- Bug fix (Open Design Questions.md #2's second half) — template_packs/
-- profile_packs pinned a specific Pack *row* (pack_id), resolved once when a
-- Template/Profile was authored and never revisited. compositionEngine
-- already correctly excludes a non-Active Pack from composition (its own
-- earlier fix) — but once the pinned row itself became non-Active (Archived,
-- say) and a newer Version was published and made Active under the same
-- code, the Template/Profile still pointed at the old, now-terminal row.
-- There was nothing newer to fall back to, so the Pack just silently
-- disappeared from every new commissioning instead of the new Active
-- version being picked up automatically.
--
-- Fix: store the Pack's `code` instead of a frozen row id. Composition
-- resolves that code to whichever Version is currently Active *at
-- commissioning time* (packsDB.findActiveByCode — the same lookup
-- publishPack's own supersede step already uses), so a new Active version
-- just shows up in the next commissioning, with zero action from anyone.
--
-- Existing SEUs are unaffected either way: an EBM's composedPacks is a
-- permanent snapshot taken once at commissioning (domain/engine/
-- compositionEngine.ts), never re-read against a Pack's live status
-- afterward — this migration only changes how a *future* commissioning
-- resolves a Template/Profile's Pack references, not anything already
-- composed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_packs' AND column_name = 'pack_id') THEN
    ALTER TABLE template_packs ADD COLUMN pack_code TEXT;
    UPDATE template_packs tp SET pack_code = p.code FROM packs p WHERE p.id = tp.pack_id;
    ALTER TABLE template_packs ALTER COLUMN pack_code SET NOT NULL;
    ALTER TABLE template_packs DROP CONSTRAINT IF EXISTS template_packs_pkey;
    ALTER TABLE template_packs DROP COLUMN pack_id;
    ALTER TABLE template_packs ADD PRIMARY KEY (template_id, pack_code);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profile_packs' AND column_name = 'pack_id') THEN
    ALTER TABLE profile_packs ADD COLUMN pack_code TEXT;
    UPDATE profile_packs pp SET pack_code = p.code FROM packs p WHERE p.id = pp.pack_id;
    ALTER TABLE profile_packs ALTER COLUMN pack_code SET NOT NULL;
    ALTER TABLE profile_packs DROP CONSTRAINT IF EXISTS profile_packs_pkey;
    ALTER TABLE profile_packs DROP COLUMN pack_id;
    ALTER TABLE profile_packs ADD PRIMARY KEY (profile_id, pack_code);
  END IF;
END $$;
