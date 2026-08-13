# CR-008 — Tenant-user landing page (redesign)

**Raised:** 2026-08-13 · **Origin:** observed while testing the CR-006 seed users (logging in as `obj-propose@babylon.com`) · **Status:** 🟡 Proposed — **not scheduled** (owner: not fixing now, tracked for later)

### Why
`postLoginRedirectPath` ([auth.js](../../src/routes/web/auth.js)) routes login by platform badge only:

```js
return user.platformBadges.includes('root') ? '/aisworg/seu/identity' : '/aisworg/quickview';
```

So **every non-root user — including a Tenant user — lands on `/aisworg/quickview`**, a generic, legacy page (a leftover from the trading app that shares this Postgres instance). That is the wrong first screen for a tenant user: on login they should land on something relevant to *their* work in *their* tenant.

### What's wanted
When a **Tenant user** logs in, the landing page is redesigned to show their tenant-relevant surface (e.g. their Objectives / SEUs / outstanding work), rather than `/quickview`. This is the "landing" side of the *role/tenant decides where you land* principle (Ch.1 §18.10 — role/tenant is for **landing**, not authority).

### Scope (to detail when scheduled)
- A tenant-appropriate landing view + wiring `postLoginRedirectPath` to send Tenant-type users there.
- Likely keyed on `users.type` / `tenant_id` (CR-004), not on `role`.
- **Depends on tenant data isolation** (the *reach* gate, §18.11 — unbuilt) to scope "their" Objectives/SEUs; until that lands, the landing can only show tenant-labelled-but-unfiltered data, or wait.

### Not in scope / notes
- Not being built now — placeholder to capture the requirement.
- Root/platform landing (`/seu/identity`) is unaffected.
