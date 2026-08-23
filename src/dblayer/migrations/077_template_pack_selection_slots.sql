-- CR-038 — Template's mandatory Packs get the same category-scoped slots
-- Profile's own Pack selections already have (migration 067, Ch.7 §7):
-- Compliance/Domain/Engineering/Integration/Organisation/Technology, the
-- real category:pack vocabulary in full — a Template's mandatory Packs can
-- span any of the six, unlike Profile's four optional-supplement slots plus
-- one flat 'optional' catch-all. Same join table (template_packs, still
-- keyed by Pack *code*, migration 013), disambiguated by list_kind rather
-- than six new tables. 'mandatory' is the pre-existing flat list's own kind,
-- backfilled so every existing row keeps meaning exactly what it did —
-- getMandatoryPackCodes (unfiltered by list_kind) stays the "every mandatory
-- Pack regardless of category" convenience every other caller (composition,
-- commissioning) already relies on; the six new per-category kinds are
-- purely for the authoring form's own picker slots.
ALTER TABLE template_packs ADD COLUMN IF NOT EXISTS list_kind TEXT NOT NULL DEFAULT 'mandatory';
ALTER TABLE template_packs DROP CONSTRAINT IF EXISTS template_packs_pkey;
ALTER TABLE template_packs ADD PRIMARY KEY (template_id, pack_code, list_kind);
