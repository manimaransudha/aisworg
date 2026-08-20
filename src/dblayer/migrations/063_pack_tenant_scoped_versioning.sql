-- Pack tenant-scoped versioning (owner, 2026-08-19, CR-026 Part 2: "Pack's own
-- (code, packVersion) has this exact same latent gap today - Fix this also.").
-- Packs already have tenant_id (migration 044), but packs_code_version_key
-- (010_pack_lifecycle.sql) never included it — two different tenants (or a
-- tenant and Platform) publishing the same code+version would collide on a
-- row that isn't actually theirs. Same move as 062_template_tenant_ownership.sql
-- made for Template, one dimension narrower (Pack doesn't need a new column,
-- just the constraint widened).
ALTER TABLE packs DROP CONSTRAINT packs_code_version_key;
ALTER TABLE packs ADD CONSTRAINT packs_code_version_tenant_key UNIQUE (code, pack_version, tenant_id);
