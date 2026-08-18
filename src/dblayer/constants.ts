// Fixed, well-known ids for reserved system rows — CR-004's reserved Tenants
// (migration 033 / seedIdentityBaseline.ts). Shared here so code that needs
// to compare against "the Platform tenant" (Pack ownership visibility, owner:
// "Platform packs will be available to all users of the platform") doesn't
// each redeclare the same literal.
export const PLATFORM_TENANT_ID = "11111111-1111-1111-1111-111111111111";
