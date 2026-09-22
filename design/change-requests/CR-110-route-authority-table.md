# CR-110 — Route Authority table

**Raised:** 2026-09-22 · **Origin:** every route's required badge/role is a literal baked into its route file (`requireBadge(["identity_manage"], {...})`), so changing which badge/role gates a route means a code change + deploy — found while gating the new Identity/Badge/User Management routes, where the hub route and its two children ended up on inconsistent badges because nothing surfaced the mismatch.

**Status:** 🟡 Open — table + full backfill built this pass; middleware wiring, CRUD admin screen, and the `navbar.ejs` legacy-role removal are still pending (see "Remaining" below).

## Design decisions

Full whiteboarding trail (started from "is this possible", through the schema shape, cache strategy, and every settled/open item) is in [design/route-authority-decisions.md](../route-authority-decisions.md). Summary of what's settled:

- New dedicated table, `route_authority(method, path, badges text[], roles text[], match_mode 'all'|'any' default 'all', description, created_at, updated_at)` — not a reuse of `ontology_concepts` (that table's `concept_type/code/default_label` shape doesn't fit a multi-field route-authority row).
- Meant to be loaded once into an in-memory cache at app start, refreshed by the (not-yet-built) CRUD admin screen's own write path — no restart to see a change. Not yet wired; see "Remaining."
- Both `requireBadge` and `requireRole` are meant to source their required list from this table automatically, keyed by `req.baseUrl + req.route.path` — no manual key argument per call site. Not yet wired; see "Remaining."
- Exactly one exception: the table's own CRUD screen is gated by `requireBadge` with a badge from an env var (`ROUTE_AUTHORITY_ADMIN_BADGE`, default `root`) — avoids the table governing access to its own editor. Not yet built.
- `badges[]`/`roles[]` values are Ontology-driven: badges from the same union `getIdentityDashboardView` already computes (noun×verb badges ∪ `badges:platform`/`badges:tenant`); roles from Ontology `authorised-role` concepts (`participants_master.authorised_role`), not the legacy singular `users.role`.
- Nav link visibility is meant to be driven by this table's `roles[]` for the route a link targets, never by badge — replacing `navbar.ejs`'s current hardcoded `_isGeneral/_isPower/_isSuper/_isTenantSuper` (legacy `users.role`) checks entirely, not alongside them. Not yet built.
- A route hit with no matching row fails closed (deny + loud log); a startup check separately warns/logs any gap but never blocks boot or restarts the app. Not yet wired.
- Coding guideline (every new route needs a row added in the same build pass) goes into CLAUDE.md once the mechanism is actually live — premature before then, since a missing row has no behavioural consequence yet.

## Changes implemented (this pass)

- `src/dblayer/migrations/261_route_authority.sql` — new: the `route_authority` table, plus a backfill of every route in the app that currently has a real, static `requireBadge([...])`/`requireRole([...])` gate.
- The backfill was generated from the **live, running app's own mounted route tree** (Express 5's `app.router.stack`), not by hand-transcribing route files — a one-off script imported `app`, temporarily instrumented `requireBadge`/`requireRole` to tag each returned middleware with its actual call arguments, walked the real registered routes, and was reverted immediately after (confirmed clean via `git diff`). This guarantees the backfill matches exactly what's mounted today, including catching that `routes/index.js` (a `requireRole(['general'])`-gated `/` route) is dead code — never imported/mounted by `app.js` — and so is correctly excluded.
- 65 rows backfilled, spanning the SEU web and API routers (Objectives, Packs, Identity/Badge/User Management, Schema Registry, and the Template/Profile/Participant/Service/Policy/Capability/Deliverable-Definition registries' `requireRole(["participant"])` gates).

### Explicitly excluded from the backfill (not a gap — these don't fit a static row)

- **Per-request-resolved badges**: `sdkAuthoring.ts`'s kind-based defines (`/sdk/:slug/new`, `/sdk/:slug/:draftId/*`) and `requireRowActionBadge`-gated publish/transition routes — one route pattern, many possible badges depending on runtime data (the `:slug` value or the transition being attempted). These stay on their existing dynamic-resolution mechanism (`requireBadge.ts`'s own header comment already calls this out as the reason `requireBadge` doesn't hardcode "any one of" matching itself).
- **Hand-rolled inline gates that never call `requireBadge`/`requireRole`**: `requireAuthorityAdmin` (`/sdk/authority/*`), `requireOntologyAdmin` (`/sdk/ontology/*`).
- **Router-mount-level gating**: `/aisworg/demo` (`app.use("/aisworg/demo", requireRole(...), demoRouter)`) — gated once for the whole subtree, not per route; `req.route` isn't set at that point, so it doesn't fit the per-route lookup key this table uses.
- **The legacy string-argument `requireRole`** (`middleware/auth.js`: `requireRole('general'|'super')`), used by `routes/web/public.js` and `routes/web/auth.js` — a different, older, rank-based mechanism, explicitly kept untouched per that file's own header comment ("left untouched... per explicit instruction not to delete it"). Out of scope for this effort.
- **Routes with no `requireBadge`/`requireRole` call at all today** — most of the SEU API layer (Evidence, Decisions, Knowledge, Reviews, Compliance, Obligations, Tenants, Execution Targets, Attention Items, External Interactions, Findings, Work Items, etc.). Adding a row for these would assert a gate that doesn't actually exist.
- **CRUD routes for `route_authority` itself** — don't exist yet; will be gated by the env-var badge, not by this table.

## Changes implemented (2nd pass)

- CRUD admin screen for `route_authority`, gated by `requireBadge([process.env.ROUTE_AUTHORITY_ADMIN_BADGE || "root"])` — the one exception in this whole design, since the table can't govern access to its own editor:
  - `src/dblayer/routeAuthorityDB.ts` — the one real write path for this table.
  - `src/routes/seu/web/routeAuthorityRegistry.ts` — list (`GET /aisworg/seu/route-authority`, with the standard `parseListParams`/`paginateList`/`listControls`/`sortLink` search+sort), new/edit forms, create/update/delete.
  - `src/views/seu/route-authority/{index,edit}.ejs` — badge and role pickers are themselves Ontology-driven multi-selects (badges: `listGrantableNounVerbBadges` ∪ `listAdminSurfaceBadgeCodes`; roles: Ontology `authorised-role` concepts), not free text.
  - Mounted in `src/routes/seu/web/index.ts`; view models registered in `src/viewModels/viewRegistry.js`.
  - Linked as a fourth card on the Identity Management hub (`src/views/seu/identity/index.ejs`), alongside Tenant/Badge/User Management — shown only when the viewer actually holds `ROUTE_AUTHORITY_ADMIN_BADGE` (live-checked via `resolveHeldBadges`, the same primitive `requireBadge` itself uses), not unconditionally to everyone who reaches the hub.
  - Editing a row here does **not** yet change enforcement for the ~65 backfilled routes from the first pass — see item 1 below. (The two routes migrated in the 3rd pass, below, ARE live-enforced via the modern `requireRole`, same as before this table existed — this table isn't yet the thing deciding their outcome.)

## Changes implemented (3rd pass) — navbar link visibility

Investigated first: `navbar.ejs`'s `_isGeneral`/`_isPower` aren't real per-link gates (`_isGeneral` just means "logged in at all" — `general` is the floor role everyone has; `_isPower` was declared but never actually read anywhere). The only two genuine per-link restrictions were `_isSuper` (Event Bus) and `_isTenantSuper` (Tenant User Management) — and both of their underlying routes were still on the **legacy** `requireRole('super'|'tenant_super')` (`middleware/auth.js`, singular `users.role`), which the first pass had explicitly excluded as a different, older mechanism.

Since the actual ask is "every route except this table's own CRUD," these two were brought into scope too:

- `src/routes/seu/web/events.ts` (`GET /events`) and `src/routes/seu/web/tenantAdmin.ts` (`GET /tenant-admin/users`, `POST /tenant-admin/users/:id/badges`) — moved from the legacy `requireRole('super'|'tenant_super')` to the modern, Ontology-backed `requireRole(["superuser"]|["tenant_admin"])`. `superuser` and `tenant_admin` are pre-existing `authorised-role` Ontology codes (migration 254) — no new Ontology data introduced.
- `src/dblayer/migrations/262_route_authority_legacy_role_migration.sql` — the 3 corresponding `route_authority` rows.
- `src/dblayer/seed/seedIdentityBaseline.ts` — `TENANT_ADMIN_USERS` fixture users now also get the `tenant_admin` **authorised_role** grant (they already held the `identity_manage` **badge**, a different thing) — without this, the seed data would have locked them out of their own screen the moment its gate stopped reading the legacy `users.role` scalar. Root already holds `superuser` via this same file's existing grant, so no fixture gap there.
- `src/middleware/requireRole.ts` refactored to call a new shared primitive, `src/domain/identity/heldRoles.ts` (`resolveHeldRoles`) — mirrors `heldBadges.ts`'s own CR-076 consolidation, so the navbar's visibility check and the route's own enforcement can't independently drift on what "held" means. Behavior-preserving (same expiry/scope/superuser-bypass logic, just no longer duplicated).
- `src/domain/identity/navRouteAccess.ts` (`resolveNavRouteVisibility`) — looks up a nav link's target route in `route_authority`, and checks the viewer's live `authorised_role` against its `roles[]`. A link whose target has no row, or an empty `roles[]`, is always visible.
- `src/app.js` — computed once per request in the same existing navbar-context middleware that already assembles `ontologyConceptTypes`/`devActAs` (not per-route), for exactly the two nav links that need it; exposed as `res.locals.navRouteVisible`.
- `src/views/partials/navbar.ejs` — `_isPower`/`_isSuper`/`_isTenantSuper` removed entirely (not kept as a fallback); the two links now check `_navRouteVisible['GET /aisworg/seu/events']` / `['GET /aisworg/seu/tenant-admin/users']`. `_isGeneral` stays — it's the authentication gate, not a role gate, and route_authority (address-keyed by path) has no way to answer "is anyone logged in."

## Remaining (separate build passes)

1. Wire `requireBadge.ts`/`requireRole.ts` to actually consult this table (in-memory cache, auto-derived lookup key) instead of taking a literal array — touches every one of the ~65 backfilled call sites plus the two middleware files. Large, unscoped-until-confirmed change; not done in this pass. (Note: this is now also true for the 3 rows added in the 3rd pass — their routes enforce via a literal `requireRole(["..."])` argument today, same status as every other row.)
2. Add the "every new route needs a row" rule to CLAUDE.md once 1 is live.

No test fixtures updated beyond the one seed fixture fix noted above (required to avoid a real regression, not a nice-to-have) — user will test manually.
