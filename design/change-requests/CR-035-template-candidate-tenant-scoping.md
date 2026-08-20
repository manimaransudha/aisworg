# CR-035 — `findCandidateTemplates` scoped to Platform + caller's tenant (was fully unscoped)

**Raised:** 2026-08-19 · **Origin:** discovered while verifying CR-034 — running the full test suite immediately after a fresh `db:clean-slate` failed `sdk-authoring.test.ts`'s own cleanup (`ebms`/`seus` FK violations) in ~4 of 5 attempts. Owner, once the mechanism was traced and confirmed pre-existing but real: "Fix it now." · **Status:** ✅ Built 2026-08-19

> **Built 2026-08-19.**

### Root cause
`findCandidateTemplates` (`core/templates.ts`) called `templatesDB.findAllActive()` — every Active Template, **unscoped by tenant**. CR-026's Template Inheritance model lets a tenant author a Derived Template that keeps its parent's exact `code` (Ch.6 §20.4/§20.14), disambiguated only by `tenant_id`. While such a Derived Template is briefly Active — e.g. `sdk-authoring.test.ts`'s own CR-026 inheritance test walking an Athens-tenant clone of `enterprise-web-application` through Draft → … → Active before its `after()` cleanup deletes it — it satisfies the exact same capability-superset check `findCandidateTemplates` runs for *any* caller, not just Athens. A completely unrelated test file's own commissioning (no explicit template chosen, just capability codes) could match that private, tenant-owned row instead of the Platform one, then `findOrCreateDefaultProfile` would pick up its one real Profile (`sdk-test-profile-parent-...`) as if it were a shared default — leaving dozens of real SEUs/`ebms` rows referencing a Profile the owning test tracks for deletion in its own cleanup, which then fails on the FK.

This is the same class of bug CR-028 already found once (documented as a one-off, non-reproducible race) — but CR-034's 9 new Templates substantially widened the candidate pool for the exact 3-capability set (`requirements-analysis`/`architecture`/`development`) many existing tests already probe (several of the new Templates' required-capability sets are supersets of it), which is almost certainly why it went from "rare flake" to "reproduces ~80% of the time on a fresh reset" today.

### What's built
- `templatesDB.findActiveVisibleTo(viewerTenantId)` already existed (CR-026, mirroring `packsDB`'s own) — `WHERE status = 'Active' AND (tenant_id = Platform OR tenant_id = viewerTenantId)`. `findCandidateTemplates` now takes an optional `viewerTenantId` and calls this instead of the unscoped `findAllActive()`. No `viewerTenantId` given (root/system context, no real caller tenant) narrows to Platform-only — never "every tenant's Templates," which is now structurally unreachable from this function.
- Threaded the real caller's tenant through every production call site:
  - `commissionFromForm` (`core/commissioning.ts`) — already had `input.tenantId`, just passed it through.
  - `commissionFromExistingObjective` — gained a new `tenantId?: string | null` input field; `web/objectives.ts`'s `POST /objectives/:id/commission` route passes `req.session?.user?.tenant_id ?? null`.
  - `GET /api/seu/templates?capabilityCodes=...` (`api/templates.ts`) — passes `req.session?.user?.tenant_id ?? null`.
  - `getObjectiveDetail`'s own commissioning *preview* (`core/objectives.ts`) — owner correction: Objectives have no `tenant_id` column of their own, but `requested_by` (a user id) resolves one via that user's own `tenant_id` — the same derivation any other acting-user tenant lookup uses. Added `userDB.findById` (new) to resolve it; falls back to Platform-only only when `requested_by` is null (a system-created Objective).

### Verification
- `npx tsc --noEmit`: clean.
- Reproduced the failure 4 times across successive fresh `db:clean-slate` → `seed:seu` → full-suite runs before the fix (traced each one by hand: same mechanism, an Athens-tenant `enterprise-web-application`@1.0.0 clone with a later `created_at` than Platform's own, `findCandidateTemplates`'s old unscoped resolution consistently preferring it).
- Post-fix: full suite (`NODE_ENV=test npm test`) on a fresh `db:clean-slate` → `seed:seu`: **148/148**, first attempt.

