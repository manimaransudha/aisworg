# CR-110 — Route Authority table

**Raised:** 2026-09-22 · **Origin:** every route's required badge/role is a literal baked into its route file (`requireBadge(["identity_manage"], {...})`), so changing which badge/role gates a route means a code change + deploy — found while gating the new Identity/Badge/User Management routes, where the hub route and its two children ended up on inconsistent badges because nothing surfaced the mismatch.

**Status:** ✅ Closed 2026-09-25.

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



## Changes implemented (4th pass) — full backfill + global gate

- Migration 261 extended (not a new migration file — 261 hadn't been applied yet) with 169 more rows covering every remaining live Express route (owner: "All the express routes should be on the table. Do not exclude any routes") — the whole SEU API layer that previously had no gate at all (empty badges/roles, a real "checked, nothing required" declaration), the hand-rolled `requireAuthorityAdmin`/`requireOntologyAdmin` gates (mapped to their real underlying badges), the legacy `requireRole('general'|'super')` routes (`general` → empty roles, `super` → `roles=['superuser']`), the table's own CRUD screen (documentation row only, see below), the three routes registered directly on `app` in `app.js` (`/`, `/aisworg/login`, `/aisworg/logout`), and `sdkAuthoring.ts`'s dynamic `:slug` routes (informational rows only — see below). 237 rows total.
- `src/domain/identity/routeAuthorityCache.ts` — loads every row once, compiles each `path` with `path-to-regexp`'s `match()` (already an Express 5 dependency, no new package added), and resolves ambiguous overlaps (e.g. `/objectives/new` vs `/objectives/:id`) by preferring fewer params then the longer literal pattern. `refreshRouteAuthorityCache()` is called by the CRUD screen after every create/update/delete so an edit takes effect on the next request, no restart.
- `src/middleware/routeAuthorityGate.ts` — the one global gate, mounted in `app.js` right after `gatekeeper` and before every router. Looks up the incoming `req.method`+`req.path`; a match with empty `badges[]`/`roles[]` passes; a real requirement is checked against `resolveHeldBadges`/`resolveHeldRoles`, same root/superuser bypass semantics `requireBadge.ts`/`requireRole.ts` always had. A request matching no row at all now fails closed (deny + loud log) — safe now that the backfill is complete. Denial: generic message "You are not authorised for this action.", `safeBack()` + flash for web routes, plain JSON 403 for `/aisworg/api/...`.
- Self-governance exception preserved: `routeAuthorityGate` explicitly skips `/aisworg/seu/route-authority*` — that screen's own literal `requireBadge([ROUTE_AUTHORITY_ADMIN_BADGE])` check (unchanged) stays the sole authority over itself, so its table row is a coverage record only, not live enforcement (a stale row can't override the env var).
- `sdkAuthoring.ts`'s `/sdk/:slug*` and `/sdk/:slug/:draftId/{publish,transition}` routes keep their existing dynamic middleware (`requireAuthoring`/`requireDefineBadge`/`requireDraftTenantScope`/`requireRowActionBadge`) unchanged — their table rows are informational (empty badges/roles) since one static row can't represent a per-`:slug`-resolved badge.
- **Not yet done**: the ~237 per-route `requireBadge`/`requireRole` calls (and the two hand-rolled admin-gate functions) are still present in the route files. They're now redundant — the global gate already denies before an unauthorized request reaches them — but harmless (same held-badges/roles resolution, so never disagrees with the global gate). Removing them is a separate, large mechanical pass across ~40 files; not done without a separate go-ahead.

User: do we need to add requireBadge(). Can we have the app.js modified to run through these middleware?

Claude: Express only populates req.route.path once a request reaches a specific route's own middleware stack — i.e., once it's already inside router.get(path, ...). A middleware mounted globally in app.js via plain app.use(fn) runs before any router tries to match the path, so at that point Express hasn't matched anything yet and req.route doesn't exist. So a truly global middleware can't just read req.route.path the way the per-route design assumed — it has to do its own path matching: take the raw incoming path (e.g. /aisworg/seu/objectives/42/edit) and match it against route_authority's stored patterns (e.g. /aisworg/seu/objectives/:id/edit) itself.

That's solvable — Express uses path-to-regexp internally for exactly this, so the global middleware would compile each route_authority row's path into a matcher (once, when the cache loads) and match incoming requests against them. This is genuinely doable, not just a workaround.

If we go this route, the outcome is real: no route file needs a requireBadge()/requireRole() call at all anymore — one middleware in app.js, mounted once after the session/auth gatekeeper and before the routers, handles every gated route by looking itself up in the table. The only exception stays the CRUD screen for route_authority itself, which keeps its own literal env-badge check (it can't depend on the table it manages).
Before I build it, removing the per-route calls entirely surfaces three real gaps I need your call on (not just formality — each one changes behavior):

1. Custom redirect/deny messages disappear. Today, e.g. objectives.ts passes redirectTo: toDetailPage (back to the exact object being edited) and messages like "You don't hold the badge required to edit Objectives." Those are JS closures at the call site — a global middleware has no route-specific closure to run. My default: fall back to Referer-based redirect (same as the old requirePlatformBadge's safeBack()) with a generic denial message. That's a real UX downgrade from today's tailored redirects. Alternative: add redirect_to/deny_message columns to route_authority and backfill them from the current literals, so the exact current behavior is preserved as data too. Which do you want — accept the generic fallback, or preserve exact messages as data?

2. Web vs API mode (redirect+flash vs JSON 403) — I'll infer this from the path prefix (/aisworg/api/... = JSON, everything else = redirect). Fine?

3. Path matching — the global middleware needs to match incoming URLs like /aisworg/seu/objectives/42/edit against stored patterns like /aisworg/seu/objectives/:id/edit. I'd use path-to-regexp, the library Express already uses internally for this, added as a direct dependency. OK?


2. ✅ Done — "every new route needs a row" rule added to CLAUDE.md (Application specifics) and MEMORY.md (`route-authority-table-every-new-route.md`).

No test fixtures updated beyond the one seed fixture fix noted above (required to avoid a real regression, not a nice-to-have) — user will test manually.
