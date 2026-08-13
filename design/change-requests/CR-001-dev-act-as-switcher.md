# CR-001 — Dev-only "Act As" switcher (tenant + badge impersonation)

**Raised:** 2026-08-12 · **Requested by:** platform owner · **Status:** ✅ Built 2026-08-12

### ✅ Built 2026-08-12

Delivered as a dev-only, god-user-only, flag-gated impersonation context that routes through the **real** authority path (no bypass). Verified: `tsc` clean · full regression **146/146** · dry-run **77/77** (the previously-documented separation-of-duties negative case is now exercised end-to-end — acting as `approver`, the creator-only `Defined → In Progress` transition is denied `authority_denied`, and reset-to-root ungates it) · gate predicates unit-checked (prod off, `DEV_ACT_AS=off` off, non-god off even with a `root` badge) · live HTTP audit of the platform-badge axis (a `requirePlatformBadge('root')` surface flips 200 → 302-denied → 200 across assume/reset).

**Files:**
- `src/dev/actAs.ts` *(new)* — the three gates (`devActAsFeatureEnabled` / `isGodUser` / `devActAsAvailable`), `effectivePlatformBadges` projection, `listTenants` / `listBadgeTypes`, and dev-gated `findOrMintGrant`. Every export is a no-op / null / false in production.
- `src/middleware/auth.js` + `src/middleware/requirePlatformBadge.ts` — read `effectivePlatformBadges(req) ?? user.platformBadges`, so assuming a non-root badge suppresses the root bypass (prod unchanged, since the projection returns null there).
- `src/routes/seu/web/devActAs.ts` *(new)* + `index.ts` mount — `POST /dev/act-as` and `POST /dev/act-as/reset`, both 404 unless the switcher is live.
- `src/routes/seu/api/deliverables.ts` — resolves/mints the acting grant to the assumed badge scoped to the target Deliverable's SEU, passed explicitly so it wins over the auto-resolver's root preference.
- `src/routes/seu/web/seus.ts` — acting tenant becomes the default commissioning tenant (explicit form value still wins).
- `src/app.js` — `res.locals.devActAs` assembled only when the switcher is live.
- `src/views/partials/navbar.ejs` — the dropdown, rendered only when `res.locals.devActAs` is populated.
- `src/dry-run-suite/lib/platform.mjs` + `scenarios.mjs` — `actAs` / `resetActAs` helpers and the upgraded separation-of-duties scenario.

**Note — the badge, not the role, authorises transitions** *(owner clarification, 2026-08-12):* `authorisedRole` on deliverable rules is display-only; `012_badge_model` retrofits deliverable transitions to badge-typed authority rules (`Defined→In Progress` = `creator`; `In Progress→Approved` / `Approved→Baselined` = `approver`). So assuming a badge genuinely changes who may transition — which is why the switcher's engineering-badge path produces a real `authority_denied`.

## CR-001a — Denial redirect loop (fix, 2026-08-12)

**Reported:** From the navbar as root, choosing the default tenant + `Creator` sent `/identity` into an infinite redirect loop, logging repeatedly: `[requirePlatformBadge] …/identity — needs Platform badge "root", holds [creator]`.

**Root cause:** a pre-existing latent bug that CR-001 was the first to reach. The Act-As switcher renders in the navbar on *every* page, including the `requirePlatformBadge('root')` admin pages (`/identity`, Schema Registry, Pack Authoring). Assuming `creator` correctly denies `/identity` — but the denial redirected to `req.headers.referer`, which *was* `/identity` (the page hosting the switcher). Result: `/identity → 302 → /identity → …`. Root never triggered it before because root passed every check, so an admin-page denial was never reachable.

**Fix:** `src/middleware/safeBack.ts` *(new)* — a denial never redirects back to the same path it is denying; when Referer equals the current request path it falls through to `/aisworg`. Wired into both `requirePlatformBadge.ts` and `requireRole` (`auth.js`) — the loop-prone `referer || '/aisworg'` pattern lived in both.

**Verified:** reproduced live — `creator` GET `/identity` now `302 → /aisworg → 200` (terminates in one redirect); reset-to-root restores `/identity` (`200`); `tsc` clean; regression **146/146**.

**Intended behaviour (not a bug):** as `creator` you *lose* the `root`-gated admin pages (`/identity`, Schema Registry, Pack Authoring) and land on the dashboard with a denial flash; ordinary SEU pages stay reachable because they use `requireRole` and the underlying role is still `super`. The navbar switcher remains available on the dashboard to reset to root. This is the switcher exercising real denials as designed.

---

**Original request & scope below (retained for the record).**

**Status when raised:** In build

### Request (as raised)

> A root id should be able to switch to any tenant and any badge in the dev environment so it is easy to test.
>
> Build a dev-only navbar switcher with a tenant selector and a badge selector; the tenant selector lists tenants; the badge selector lists badge types from the vocabulary; picking one sets the session's acting context and mints the grant if it doesn't exist. This feature should be available to root only and in the dev environment only. There should be a flag to switch this feature off even in dev if it is not required.

### Problem it solves

In dev, the only identities available are (a) the `NODE_ENV === 'test'` auto-login shim, which hardcodes a single root identity (`id:1`, `role:super`, `platformBadges:['root']`), and (b) real Google-OAuth logins. There is no way to *act as* a different tenant or a different (non-root) badge without seeding users and juggling OAuth sessions. Because root passes every authority check (the `requireRole` / `requirePlatformBadge` testing bypasses), **denial paths and per-tenant behaviour can never be exercised interactively** — the same gap the dry-run suite documents (separation-of-duties negative case unreachable under the single root identity).

### Agreed scope

A dev-only "Act As" context, selecting **real** tenants and badges and routing them through the **normal** authority/tenant resolution — never a bypass.

1. **Navbar switcher** (dev-only, root-only, flag-gated):
   - **Tenant selector** — lists rows from `tenants`.
   - **Badge selector** — lists badge *types* from the `badge_types` vocabulary (`badgeTypesDB.findAllForTenant(tenantId)` → platform-default badges + the selected tenant's variants). Not a fixed dev seed — the menu is the live vocabulary.
2. **On pick** — persist `req.session.actAs = { tenantId, badgeType }`, and **mint the `badge_grant` if one doesn't already exist** for the acting identity at the required scope. Minting is permitted only because the real identity is root and the environment is dev.
3. **Effect on authority** — when `actAs.badgeType !== 'root'`, the session's *effective* acting badge is the assumed badge, and the root bypass in `requireRole` / `requirePlatformBadge` does **not** short-circuit. This is the payoff: a creator badge genuinely gets denied the approver transition; tenant Atlas genuinely resolves its own execution targets/aliases. Selecting **root** returns to full access (the default / escape hatch).

### Guardrails (load-bearing)

- **Dev only.** The switcher UI, its routes, and grant-minting are all gated to `NODE_ENV !== 'production'`. None of it exists in prod — no route mounted, no navbar control rendered, no mint path reachable.
- **God user only — the single `SUPERUSER_EMAIL` identity.** *(Owner refinement, 2026-08-12: not merely "any root badge holder.")* Availability is gated on `session.user.email === process.env.SUPERUSER_EMAIL` (the env-file god identity — the one `passportConfig.js` force-promotes to `super` and `badgeBootstrap.ts` seeds `root` for). This is exposed as a derived `isGodUser` flag rather than a new `goduser` DB role — no migration, and it is inherently exclusive: **even if the god user creates other users with the `root` badge, none of them qualify**, because only the env email matches. (A first-class `role: "goduser"` was the owner's suggested mechanism; collapsed to the email-derived flag as the least-invasive way to get the same one-and-only-one guarantee.)
- **Off switch.** A feature flag (`DEV_ACT_AS`, default on in dev) disables the whole feature even in dev when set to `off`: no navbar control, routes 404, no context applied.
- **No prod escalation.** It never mounts in prod, only the god identity can reach it, and minting requires that identity — it cannot be a privilege-escalation path.

### Build sequence

1. **Config flag** — resolve `DEV_ACT_AS` once (`enabled = NODE_ENV !== 'production' && flag !== 'off'`); expose a single `devActAsEnabled(req)` predicate that also checks the caller holds `root`.
2. **Session context + resolution** — `req.session.actAs = { tenantId, badgeType }`; a middleware that, when enabled and set, projects the acting context onto the request (effective tenant, effective acting badge grant), and stops the root bypass from firing for a non-root assumed badge.
3. **Grant minting** — on selecting a badge, find-or-create the `badge_grant` for the acting holder at the correct scope (via `badgeGrantsDB`), dev-gated.
4. **Routes** — dev-only `POST /aisworg/seu/dev/act-as` (set tenant + badge) and a reset to root; CSRF-protected like the other web forms.
5. **Navbar surface** — a dropdown (rendered only when `devActAsEnabled`) showing the current acting tenant + badge, the tenant list, and the badge-type list for the selected tenant; `res.locals` carries the current `actAs` and the option lists.
6. **Verification** — full regression (must stay green with the feature off, which is the default in `NODE_ENV=test`); a dry-run scenario that switches to a creator badge and asserts `authority_denied` on the approver transition (closes the documented limitation); manual HTTP check that the switcher is absent in a simulated prod env and for a non-root identity.

### Decisions

- **Badge menu = live vocabulary, not dev seeds.** The dropdown lists `badge_types`; grants are minted on demand. No maintained seed list. *(Confirmed with owner: "Why do I need dev seeds?" — we don't.)*
- **Switch routes through real resolution, not a bypass.** So dev and prod share the same authority path; what you test is what ships.
- **Root is a badge you can pick, not a level above the tenant axis.** Two independent axes — tenant (context) × badge (authority). "Act as root" is the reset.
