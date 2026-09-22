# Route Authority — design decisions (live whiteboarding, not yet a CR)

Started from: badge/role requirements are literals baked into each route file
(`requireBadge(["identity_manage"], {...})`), so changing which badge/role
gates a route means a code change + deploy. Goal: make that mapping data,
live-queried (no restart), so a tenant introducing a new badge (already
possible today via Ontology `badges:tenant` — no code change) can also have
an existing route point at it without a code change.

## Settled

- New dedicated table, not a reuse of `ontology_concepts` (migration 030's
  `concept_type/code/default_label` shape doesn't fit a method+path+badge
  list+role list+match-mode structure without abusing the label field as a
  JSON blob — ruled out, same "no shortcut that the platform's own
  registries/UI can't reason about" principle already in CLAUDE.md).
- Loaded once into an in-memory cache at app start, not queried per request
  (avoids a DB round trip on every single route hit). The cache is
  refreshed whenever the table is written — the CRUD admin screen's own
  write path reloads the cache (or updates just the affected row) right
  after the DB write completes, so a change is visible on the very next
  request, no restart needed. This differs from `ontologyDB.
  findConceptsByType`'s own live-per-call pattern (badges:platform/
  badges:tenant) — that one stays as-is; this cache is specific to route
  authority, justified by how hot this lookup path is (every gated request).
- Both `requireBadge` and `requireRole` call sites source their required
  list from this table. Badges and roles are both arrays.
- Exactly one exception: the CRUD screen that edits this table itself is
  gated by `requireBadge` with a badge read from an **env var**, default
  `root` if unset — avoids the table governing access to its own editor.
- Coding guideline (to add to CLAUDE.md once this is built): every time a
  new router/route is added, a corresponding row must be added to this
  table in the same build pass — same discipline as the existing "schema-
  changing CRs must list which test fixtures need updating" rule.
- Nav link visibility is driven by this table's `roles[]` for the route a
  link targets — **never** by badge. Badge stays purely a route-enforcement
  concern; a user can see a link and still get denied on click if they lack
  the badge, but a link's visibility itself is role-gated only.
- `badges[]`/`roles[]` values are Ontology-driven, not free text — the CRUD
  screen must validate (and its own picker must offer) only real codes:
  - `badges[]`: the same union `getIdentityDashboardView` already computes —
    noun×verb badges (`listGrantableNounVerbBadges`, `authority_noun_verbs`)
    **union** Ontology admin-surface badges (`listAdminSurfaceBadgeCodes`,
    `badges:platform`/`badges:tenant`). Noun×verb badges are explicitly
    in scope here, not just the 3-code admin-surface set.
  - `roles[]`: Ontology `authorised-role` concept codes
    (`ontologyDB.findConceptsByType("authorised-role", ...)`) — same source
    the modern `requireRole.ts`/`participants_master.authorised_role` model
    already uses. This also resolves the open "which role" question below:
    the modern Ontology-backed `authorised_role`, not the legacy singular
    `users.role` column.

- **Table shape** — `route_authority(method, path, badges text[],
  roles text[], match_mode 'all'|'any' default 'all', description,
  created_at, updated_at)`.

- **Lookup key** — derived automatically at request time from
  `req.baseUrl + req.route.path` (Express sets `req.route` before a route's
  own middleware stack runs, so no manual key string needs to be passed at
  each call site — removes a whole class of "key drifted from the actual
  route" bugs).

- **Missing-row enforcement** — a route hit at request time with no matching
  table row fails closed (deny + loud log) — never allow-by-default. A
  startup check also walks the mounted Express stack and loudly warns/logs
  any authority-gated route with no matching row, but **never blocks boot or
  restarts/shuts down the app** — it's a visibility aid (surfaces the gap
  immediately in logs/monitoring) layered on top of the request-time
  fail-closed behavior, not a gate on startup itself.

- **Env var name** for the bootstrap CRUD-admin badge —
  `ROUTE_AUTHORITY_ADMIN_BADGE`, default `root`.

- **Cache refresh scope** — the in-memory cache only ever gets refreshed
  through the governed CRUD screen's own write path (create/update/delete
  on this table triggers the reload). A direct DB edit to the table outside
  that screen is out of band and won't be picked up until the next app
  restart — consistent with "no parallel/bypass mechanism," and the UI path
  also gives a real audit trail (who changed which route's authority, when)
  that a direct DB edit never would.

- **Nav-link visibility source, in full** — the modern Ontology-backed
  `authorised_role` (`participants_master.authorised_role`), not the legacy
  singular `users.role`. In scope: removing the legacy `users.role`-based
  checks (`_isGeneral/_isPower/_isSuper/_isTenantSuper`) from `navbar.ejs`
  entirely, not leaving them alongside the new per-link `roles[]` lookups —
  the legacy mechanism goes away, it isn't kept as a fallback.

## Next step

All open questions are now resolved. Write this up as a proper CR (next
number is CR-110) before any code — per the three-options design-proposal
rule, the CR should still show minimal/moderate/full framing for the actual
`requireBadge.ts`/`requireRole.ts`/navbar.ejs mechanics, since "table-driven
lookup" still leaves choices in how much of the middleware internals change.
