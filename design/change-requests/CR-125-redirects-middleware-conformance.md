# CR-125 — Web controllers redirect through the redirects middleware

**Raised:** 2026-10-17 · **Origin:** `coding_principles.md` (web controller template) requires every redirect on error to use `middleware/redirects.js`. The implementation does not follow it. `src/middleware/redirects.ts` holds only two stock-application entries (`dashboard`, `stocks`) and no route imports it.

**Status:** 🟡 Built pending testing

## Fix the following

| # | Item |
|---|---|
| 1 | Web controllers redirect on error and on success through `redirects.<area>.<page>.<outcome>(req, res, msg)`, as `coding_principles.md` specifies. |
| 2 | `src/middleware/redirects.ts` holds the real destinations, replacing the stock-application `dashboard` and `stocks` entries. |
| 3 | Direct `flashError`, `flashSuccess` and `res.redirect` calls in web controllers move to `redirects`. |
| 4 | A skill describes how to create a new route as one unit: the `route_authority` row, the `attachVM` rules and the `redirects.ts` entry, so that new controllers follow the guideline. |

## Inventory

Audited call site by call site under `src/routes` on 2026-10-17. The full list, with route and resolved destination for each site, is in [CR-125-call-site-audit.md](CR-125-call-site-audit.md).

| Class | Sites |
|---|---|
| `flashError(req, res, dest, msg)` | 295 |
| `flashSuccess(req, res, dest, msg)` | 88 |
| `res.redirect` after a hand-written `session.flash` assignment | 24 |
| `res.redirect` with no message | 14 |
| `wrote()` wrapper in `sdkAuthoring.ts`, which calls `flashSuccess` or `flashError` | 10 |
| **Total** | **431** |

The web files involved number 24, not 22: 22 under `routes/seu/web` and 2 under `routes/web`.

| Destination measure | Value |
|---|---|
| Sites with a static destination | 218 |
| Sites with a destination that depends on a request or result value | 213 |
| Distinct static destinations | 37 |
| Distinct dynamic destination patterns | 22 |
| Sites whose destination is the `Referer` header | 5 |

Findings that fall outside the plain `flashError` and `flashSuccess` form:

| # | Finding | Where |
|---|---|---|
| 1 | Routes set `req.session.flash` by hand and then call `res.redirect`. 24 redirects cover 26 assignments. | `web/auth.ts` (21 assignments), `tenantAdmin.ts` (1), `objectives.ts` (3), `sdkAuthoring.ts` `denyAuthoring` (1) |
| 2 | `web/auth.ts` writes `{ error }` and `{ info }`. Every other site writes `{ type, message }`, which is what `navbar.ejs` and `getFlash` consumers read. | `web/auth.ts` |
| 3 | `denyAuthoring` redirects to the `Referer` header with a hand-written flash. | `sdkAuthoring.ts:90-98` |
| 4 | `devActAs.ts` uses the `Referer` header as its destination at 4 sites. | `devActAs.ts` |
| 5 | `wrote(req, res, dest, result, okMsg)` wraps the flash call, so its 10 callers do not appear in a grep for `flashError` or `flashSuccess`. | `sdkAuthoring.ts:299-395` |
| 6 | `routeAuthorityGate` takes its flash destination from `safeBack(req)`, which reads the `Referer` header. | `middleware/routeAuthorityGate.ts:22` |
| 7 | Middleware outside `routes` redirects directly to login or to the disabled-account page. These are gate behaviour and not controller redirects. | `app.ts` (3), `gatekeeper.ts` (2), `errorHandler.ts` (1), `requireRole.ts` (1), `requireBadge.ts` (1), `routeAuthorityGate.ts` (1) |
| 8 | `middleware/redirects.ts` is imported by no file. | `middleware/redirects.ts` |

## Settled design

| # | Decision | Basis |
|---|---|---|
| 1 | The destination is declared once per page in `redirects.ts` as `redirects.<area>.<page>.<outcome>(req, res, msg)`. Outcomes are `error`, `success`, `authfail`, `rolefail`, `badgefail` and `tenantfail`. Controllers do not write the path. | `coding_principles.md` lines 254-268 |
| 2 | `flashError` and `flashSuccess` remain the primitives. Each `redirects` entry is a one-line call to them. | `coding_principles.md` lines 217-236 and 254-268 |
| 3 | The authority middleware redirect through `redirects`. `requireRole` calls `rolefail`, `requireBadge` calls `badgefail`, and `requireTenant` and `requireTenantScope` call `tenantfail`. | User instruction, 2026-10-17 |
| 4 | The authority middleware work out the `redirects.<area>.<page>` entry from the request path. Routes do not name the page when they mount the middleware. | User instruction, 2026-10-17 |
| 5 | `redirects.ts` is keyed by path prefix. The authority middleware pick the entry whose prefix is the longest match for the request path. The `route_authority` table and cache are not used for this, and the table is unchanged. | User instruction, 2026-10-17 |
| 6 | A destination that depends on the request is a function of `req` that reads `req.params`, `req.query` or `req.body`. The signature stays `(req, res, msg)`. No further parameter is added. | User instruction, 2026-10-17 |
| 7 | The destination is always the page that the request path carries. A value created by the handler is not passed to `redirects`. | User instruction, 2026-10-17 |
| 8 | When a successful create, copy or commission lands on the entity it created, the call passes that path explicitly as an optional fourth argument, `redirects.<area>.<page>.success(req, res, msg, path)`. The id is not in the request path, so the page lookup cannot supply it. | User instruction, 2026-10-17 |
| 9 | The purpose is to regulate flash messages. Only `redirects.ts` calls `flashError` and `flashSuccess`. No controller, middleware or other code calls them, and no code assigns `req.session.flash` by hand. | User instruction, 2026-10-17 |
| 10 | The `{ info }` messages in `web/auth.ts` become `success`. Every flash is `{ type, message }` with `type` of `error` or `success`. | User instruction, 2026-10-17 |
| 11 | The first pass covers all web routes. | User instruction, 2026-10-17 |

## Built (2026-10-17)

| Area | Change |
|---|---|
| `src/middleware/redirects.ts` | Rewritten. 92 pages (`auth` 5, `home` 2, `seu` 85), each declared with a path prefix. `redirectsFor(req)` picks the entry with the longest matching prefix. The module is the only caller of `flashError` and `flashSuccess`. Every page has `error`, `success`, `authfail`, `rolefail`, `badgefail` and `tenantfail`. |
| Controllers | 378 `flashError` and `flashSuccess` calls in 22 files under `src/routes` now call `redirects.<area>.<page>.<outcome>`. A call whose destination differs from the page's declared one passes it as the fourth `path` argument. |
| `src/routes/web/auth.ts` | 21 hand-written `session.flash` assignments replaced by `redirects.auth.*`. `{ info }` messages became `success`. The login, forgot-password and users pages read the flash through `getFlash`. |
| Other hand-written flash | `objectives.ts` (3 assignments), `tenantAdmin.ts` (1) and `sdkAuthoring.ts` `denyAuthoring` (1) now go through `redirects`. |
| `sdkAuthoring.ts` | The `wrote()` helper and its 10 callers use `redirectsFor(req)` and no longer pass a destination. |
| Middleware | `requireBadge`, `requireRole`, `requireTenantScope` and `routeAuthorityGate` call `badgefail`, `rolefail`, `tenantfail` and `authfail`. The `redirectTo` and `notFoundRedirect` options are removed from the middleware and from their callers. |
| `src/types/express-session.d.ts` | `flash` is `{ type: "error" | "success"; message: string }`. |
| `src/views/auth/users.ejs` | Renders `flash.type` and `flash.message`. |
| `.claude/skills/new-route/SKILL.md` | New skill: the controller, the `route_authority` row, the ViewModel, the view and the `redirects.ts` entry as one unit. |

## Test fixtures updated in the same pass

| File | Change |
|---|---|
| `tests/web-flow.e2e.test.ts` | The badge-denied `GET /seu/objectives/new` assertion expects `/aisworg`, because gate denials no longer return to the `Referer`. Two comments describing the `safeBack` behaviour were updated. |

## Incidental changes in the same pass

- Deleted `src/routes/index.ts-E`, a stray file left by an earlier `sed -i` on macOS.
- Removed 52 local `backTo`-style constants that nothing references any more.

## Behaviour changes to check

| # | Change |
|---|---|
| 1 | A gate denial lands on the page's `deny` destination, `/aisworg` by default, and no longer on the `Referer`. |
| 2 | A missing session in `requireBadge`, `requireRole` and `routeAuthorityGate` now flashes "Session expired" through `authfail`. Before, it redirected to the login page with no message. |
| 3 | A web route with no `route_authority` row is denied through `badgefail`. |
| 4 | `denyAuthoring` in `sdkAuthoring.ts` lands on the page's `badgefail` destination, not the `Referer`. |
| 5 | `devActAs`, `tenantAdmin` and `demo` pass their original destination as the `path` argument, so their behaviour is unchanged. |

## Not run

`tsc`, `db:clean-slate` and the test suite were not run. The build has been read but not compiled.

## Still open

| Point | Question |
|---|---|
| `coding_principles.md` | Lines 145-159 and 174-186 still describe `redirectTo` and `notFoundRedirect` on `requireBadge` and `requireTenantScope`, and the `redirects.ts` template still shows one `error` and `success` pair per page. They disagree with the build. |
| Plain redirects | 14 `res.redirect` calls that carry no message remain, along with the gate redirects in `app.ts`, `gatekeeper.ts` and `errorHandler.ts`. Decision 9 covers flash messages only. |
