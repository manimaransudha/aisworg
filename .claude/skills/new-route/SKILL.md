---
name: new-route
description: Create a new web route in this repo as one unit — the controller, its route_authority row, its ViewModel and attachVM registration, and its redirects.ts entry. Use whenever the user asks to add a route, page, or form handler under src/routes, or asks how a route is wired.
---

# Creating a new web route

A route is complete only when all five parts below exist. A missing part fails at runtime: `routeAuthorityGate` denies a route with no `route_authority` row, `attachVM` throws for an unregistered view, and `redirectsFor` falls back to the home page for a path with no `redirects.ts` entry.

Follow `coding_principles.md` for the controller template.

## 1. Controller

- Put the handler in the router file for its area under `src/routes/seu/web/` (mounted at `/aisworg/seu`), `src/routes/web/auth.ts` (`/aisworg/auth`) or `src/routes/web/public.ts` (`/aisworg`).
- A page route uses `attachVM("<view name>")`, sets `req.vm.req` and `req.vm.opt`, sets `req.vm.opt.flash = getFlash(req)`, and ends with `renderView`.
- A list on the page uses `parseListParams`, `paginateList`, `listControls` and `sortLink`.
- Authority comes from the route's `route_authority` row. The handler does not check a badge, a role or a tenant in its own code. Use `requireBadge`, `requireRole` and `requireTenantScope` only for what the row cannot express, and pass them no destination.
- Every redirect that carries a message goes through `redirects` (step 5). The handler never calls `flashError` or `flashSuccess`, and never assigns `req.session.flash`.
- Transition buttons and links follow the badge-gated mechanism: core computes `possibleNextStates` filtered by `trigger === "manual"`, and the web layer filters by held badge.

## 2. route_authority row

- Add the row to `src/dblayer/seed/data/routeAuthority.json` in the same pass: `method`, `path` (the full path, including the mount prefix), `badges`, `roles`, `match_mode`.
- Use `[]` for both arrays when the route needs no badge or role. A route with no row is denied.
- Seed data reaches the database only through `db:clean-slate`. Do not add a `pnpm seed:X` script.

## 3. ViewModel

- Add `src/viewModels/<area>_<page>.ts` with `createViewModel({ required: [...], optional: ["flash"] })`.
- Register it in `src/viewModels/viewRegistry.ts` under the view name, for example `"seu/route-authority/index"`.
- Add an `activePage` branch in `src/middleware/attachVM.ts` when the page needs a highlighted navbar entry. Put the more specific URL test before the less specific one.

## 4. View

- Create the `.ejs` view under `src/views/` named as in the registry.
- A new page uses the full CR-083 styling. Render `flash` unconditionally near the top.

## 5. redirects.ts entry

`src/middleware/redirects.ts` is the only module that calls `flashError` and `flashSuccess`. A destination is declared once per page.

- Add `<name>: page({ prefix, error, success?, deny?, badgefail?, tenantfail? })` under the area (`seu`, `auth` or `home`).
- `prefix` is the request-path prefix that identifies the page. `:name` segments match any value. The entry with the most segments that matches the request wins, and literal segments win a tie.
- `error` is where a failed action lands. `success` defaults to `error`.
- `deny` is where `rolefail`, `badgefail` and `tenantfail` land. It defaults to `/aisworg`. Set `badgefail` or `tenantfail` only when a denial should land elsewhere.
- Patterns may use `:name` for any parameter that appears in `prefix`. The values are read from the request path.
- A prefix identical to an existing one with a different destination makes one of them unreachable. Give the more specific route a longer prefix.
- Call it as `redirects.<area>.<name>.error(req, res, msg)` or `.success(req, res, msg)`. Pass a fourth `path` argument only when the destination is not in the request path, for example a successful create that lands on the new record.
- The authority middleware call `rolefail`, `badgefail`, `tenantfail` and `authfail` themselves through `redirectsFor(req)`. The route names no destination.

## Check before finishing

- The route has a `route_authority` row, a registered ViewModel, a view and a `redirects.ts` entry.
- No file outside `redirects.ts` calls `flashError`, `flashSuccess` or assigns `req.session.flash`.
- Tests that insert `route_authority` rows or assert on a redirect `Location` are updated in the same pass.
- `tsc`, `db:clean-slate` and the tests run only when the user says so.
