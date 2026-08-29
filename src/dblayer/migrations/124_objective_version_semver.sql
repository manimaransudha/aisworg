-- Objective version becomes a real n.n.n string (owner: "Version is in the
-- format n.n.n") instead of a bare integer. Every existing row's integer N
-- becomes "N.0.0"; objectivesDB.update/updateParent now bump the patch
-- segment only on every edit (no major/minor bump concept is defined yet) —
-- same "every edit advances the version by one step" behavior the integer
-- column already had, just semver-shaped.
ALTER TABLE objectives ALTER COLUMN version TYPE TEXT USING (version::text || '.0.0');
ALTER TABLE objectives ALTER COLUMN version SET DEFAULT '1.0.0';
