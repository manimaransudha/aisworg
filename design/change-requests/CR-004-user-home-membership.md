# CR-004 — Every user belongs to a Platform or a Tenant

**Raised:** 2026-08-12 · **Origin:** Chapter 1 access-control design discussion · **Status:** ✅ Built 2026-08-12 · **Depends on:** CR-005 (tenants must exist standalone for the create-user picker)

### ✅ Built 2026-08-12
Migration `033_user_tenant_membership.sql` adds `users.type ('Platform'|'Tenant')` + a NOT NULL `users.tenant_id`, plus `tenants.is_system`; seeds the reserved `platform` (system) and `demo` (operational sandbox) tenants at fixed ids; backfills existing rows (root-badge holders → Platform/platform, the rest → default) and enforces both columns NOT NULL + a `type` CHECK — all idempotent. Population wired on every path: OAuth (`passportConfig`) stamps `SUPERUSER → Platform/platform`, everyone else `→ Tenant/demo` (active, frictionless); `createPlatformUser` (Identity form) gained a **type selector + tenant picker**; the legacy `/auth/users` create/resend paths stamp Platform / preserve existing. `buildSessionUser` + the test shim carry `type`/`tenant_id`. Tenant pickers (Act-As, Tenant Management, create-user) use `tenantsDB.findAllOperational()` to exclude the `platform` system tenant; `seedIdentityBaseline` seeds all 6 tenants + the 4 users' membership; `db:clean-slate` preserves the reserved `default`/`platform`/`demo` tenants. **Verified:** `tsc` clean · regression **146/146** (on a clean DB) · dry-run **77/77** · clean-slate end-to-end · HTTP audit (create-user type/tenant picker present, `platform` excluded from pickers). *No tenant data isolation or access enforcement — those remain separate later CRs, as scoped.*

**Incidental (from an earlier list-UI retrofit, surfaced by this run):** two e2e assertions on now-paginated global pages (Packs, Attention) were scoped via the search / `pageSize` param so accumulated rows don't hide the fixture; a badge-model failure was pollution-only (passes in isolation) and cleared on the clean DB.

### Decision
Every user is tied to exactly one home, enforced uniformly (no nullable/sentinel special-case):
- `users.type` — `'Platform' | 'Tenant'` (NOT NULL).
- `users.tenant_id` — **NOT NULL**, FK to `tenants`.
- **Platform user:** `type = 'Platform'`, `tenant_id =` the reserved **`platform`** tenant (both fields read "platform"). Root/`SUPERUSER_EMAIL` is a Platform user.
- **Tenant user:** `type = 'Tenant'`, `tenant_id =` their tenant.
- Invariant `type='Platform' ⇔ tenant_id = platform-tenant` is enforced at the write paths + seed (not a raw CHECK, since it references a specific row).

### System tenants
Add `tenants.is_system BOOLEAN NOT NULL DEFAULT FALSE`. Seed a **`platform`** tenant (`is_system = true`) as the home for Platform users — **excluded** from Tenant Management, the Act-As picker, commissioning's tenant selection, and execution-target/contract config (it never hosts engineering). Also seed a **`demo`** tenant (operational, *not* system) as the Google-OAuth sandbox landing; it behaves like any tenant and can host a demo SEU.

### Google OAuth = frictionless sandbox (kept, not disabled)
Google OAuth stays enabled and users stay **active** on first login — the point is to let people play on the platform with zero friction (eventually landing on a demo SEU / end-to-end walkthrough). A self-signup is stamped `type = 'Tenant'`, `tenant_id = demo`, `role = 'general'`. `SUPERUSER_EMAIL` via OAuth is the exception → `type = 'Platform'`, `tenant_id = platform`.

### Population (all creation paths)
- **OAuth** (`userDB.create` in `passportConfig`): `SUPERUSER_EMAIL → (Platform, platform)`, everyone else `→ (Tenant, demo)`, active, role general.
- **`createPlatformUser`** (Identity → new-user form): form gains a **type selector (Platform | Tenant)** and a **tenant picker shown when Tenant**. Platform → `tenant_id = platform`; Tenant → the chosen tenant.
- **Backfill (existing rows):** `SUPERUSER_EMAIL → (Platform, platform)`; all others → `default` as a safe baseline. `seedIdentityBaseline` (authoritative post-clean-slate) then sets the real values for the named seed users — god → (Platform, platform); `superadmin@athens.com` → (Tenant, Athens); `admin@babylon.com` → (Tenant, Babylon); `admin@cambodia.com` → (Tenant, Cambodia).
- **Session:** `buildSessionUser` + `res.locals` carry `type` + `tenant_id` so later work can read "the actor's tenant."

### Explicitly OUT of scope (separate, later CRs)
- **Tenant data isolation** — today there is none; an active `demo` user at `role=general` currently sees *every* tenant's data. The sandbox is only *confined* to demo once isolation is built. This CR only establishes + populates membership; isolation is its own CR (acknowledged, pre-prod acceptable).
- **Role/badge access tightening** (`role=general` is currently near-total access), `product-manager` on Objectives, and `tenant_admin` enforcement (Phase 12).
