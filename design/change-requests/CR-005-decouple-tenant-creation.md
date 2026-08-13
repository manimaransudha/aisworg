# CR-005 — Decouple tenant creation from tenant-admin assignment

**Raised:** 2026-08-12 · **Origin:** Chapter 1 access-control design discussion · **Status:** ✅ Built 2026-08-12 · **Blocks:** CR-004 (its create-user tenant picker needs tenants that exist independently of admins)

### ✅ Built 2026-08-12
`createTenantWithFirstAdmin(code, name, adminEmail)` replaced by a standalone `createTenant(code, name)` in `core/identity.ts`; `POST /identity/tenants` now creates the tenant only, and the Tenant Management form dropped its `adminEmail` field. A tenant's first admin is created separately via `createPlatformUser(type='Tenant', tenant_id)` (CR-004) and granted `tenant_admin` through the existing Badge-grant action. **Verified** alongside CR-004 (tsc, 146/146, dry-run 77/77, HTTP audit — the tenant-create form has zero `adminEmail` fields).

### Problem
`createTenantWithFirstAdmin(code, name, adminEmail)` (behind `POST /identity/tenants`) **bundles** tenant creation with granting `tenant_admin` to a pre-existing user — so a tenant cannot exist without, or before, an admin. That conflicts with CR-004's model, where a Tenant user is created *pointing at an already-existing tenant*.

### Decision — split into three independent steps
1. **Create tenant** — `createTenant(code, name)` (+ `is_system` default false); the Tenant Management form drops the `adminEmail` field.
2. **Create the tenant's admin user** — via `createPlatformUser(type = Tenant, tenant_id = <the tenant>)` (CR-004's form).
3. **Grant `tenant_admin`** — the existing separate badge-grant action.

### Impact
- `identity.ts` core: `createTenantWithFirstAdmin` → `createTenant`; the grant path already exists (`issueBadgeGrant`).
- Web: `POST /identity/tenants` simplified; Tenant Management form loses `adminEmail`.
- Sequencing: land **before/with CR-004**.
