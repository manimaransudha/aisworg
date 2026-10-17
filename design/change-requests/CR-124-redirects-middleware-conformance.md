# CR-124 — Web controllers redirect through the redirects middleware

**Raised:** 2026-10-17 · **Origin:** `coding_principles.md` (web controller template) requires every redirect on error to use `middleware/redirects.js`. The implementation does not follow it. `src/middleware/redirects.ts` holds only two stock-application entries (`dashboard`, `stocks`) and no route imports it.

**Status:** 🟡 Raised — design in progress

## Fix the following

| # | Item |
|---|---|
| 1 | Web controllers redirect on error and on success through `redirects.<area>.<page>.<outcome>(req, res, msg)`, as `coding_principles.md` specifies. |
| 2 | `src/middleware/redirects.ts` holds the real destinations, replacing the stock-application `dashboard` and `stocks` entries. |
| 3 | Direct `flashError`, `flashSuccess` and `res.redirect` calls in web controllers move to `redirects`. |

## Inventory

Audited call site by call site under `src/routes` on 2026-10-17. The full list, with route and resolved destination for each site, is in [CR-124-call-site-audit.md](CR-124-call-site-audit.md).

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
| 1 | The destination is declared once per page in `redirects.ts` as `redirects.<area>.<page>.<outcome>(req, res, msg)`. Outcomes are `error`, `success` and `authfail`. Controllers do not write the path. | `coding_principles.md` lines 254-268 |
| 2 | `flashError` and `flashSuccess` remain the primitives. Each `redirects` entry is a one-line call to them. | `coding_principles.md` lines 217-236 and 254-268 |
| 3 | `requireBadge` and `requireTenantScope` keep their own `redirectTo` and `notFoundRedirect`, given as a literal or a function of `req`. They do not read from `redirects`. | `coding_principles.md` lines 145-159 and 174-186 |

## Still open

| Point | Question |
|---|---|
| Dynamic destinations | Routes whose target depends on `:id` need a defined form in `redirects`. The principles show only literal paths there. |
| Scope of the first pass | All web routes, or one area first. |
