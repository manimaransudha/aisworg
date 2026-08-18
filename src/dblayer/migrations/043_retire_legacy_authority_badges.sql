-- Badge Management / User Management — owner: "Anything that is legacy has to
-- be removed from this page and the badge management page as well."
--
-- The Layer 2b Creator/Reviewer/Approver badge family (scope_kind
-- 'SEU_or_Pack', code 'creator'/'reviewer'/'approver' plus any Tenant-derived
-- variant of them) and the two already-documented-retired Layer 1
-- sdk_creator/sdk_approver badges are no longer enforced by anything:
--   - transitionEngine.ts's own header: "The legacy authority_rules lookup +
--     required_badge_type acting-badge path + ROLE_LEVEL role fork have been
--     removed."
--   - badgeAuthorityEngine.ts's own header: "the legacy acting-badge +
--     governed_entity_type + capability + SEU/Pack scope check
--     (badgeAuthorityEngine.evaluate) is retired — scope is a separate gate,
--     not this layer."
--   - sdkAuthoring.ts: "the legacy Platform badges sdk_creator/sdk_approver
--     are retired."
-- Every governed transition today runs on noun x verb (CR-006) alone. Deleting
-- these badge_types rows also structurally retires the whole SEU_or_Pack scope
-- kind going forward: createOrRenameTenantBadge's derived_from check
-- (badgeTypesDB.ts) requires a live Platform-recommended (tenant_id IS NULL)
-- parent of the SAME scope_kind — once none remain, no new SEU_or_Pack badge
-- can be derived by any Tenant.
--
-- Idempotent: every DELETE is a no-op once its rows are already gone.

-- No grant referenced any of these as of writing this migration, but delete
-- defensively (dependency order) in case a stale database does carry one.
DELETE FROM badge_grants WHERE badge_type IN ('sdk_creator', 'sdk_approver');
DELETE FROM badge_grants WHERE badge_type IN (SELECT code FROM badge_types WHERE scope_kind = 'SEU_or_Pack');

DELETE FROM badge_types WHERE code IN ('sdk_creator', 'sdk_approver');
DELETE FROM badge_types WHERE scope_kind = 'SEU_or_Pack';
