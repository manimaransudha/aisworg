-- Owner (2026-09-22): "Remove the viewer grants." viewer (migration 012's
-- own registration-default row) is not a real badge in the current model —
-- not in authorised-role/authorised_badges, never checked by
-- badgeAuthorityEngine/getHeldBadges. Cleans up every already-granted
-- viewer row plus the badge_types row itself, for a database migrated
-- before migration 012 stopped seeding it.
DELETE FROM badge_grants WHERE badge_type = 'viewer';
DELETE FROM badge_types WHERE code = 'viewer' AND tenant_id IS NULL;
