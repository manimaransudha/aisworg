---
name: author-id-badge
description: Resolve the acting user id and the author badge in routes, core functions, engines and seeds using the shared helpers, with no silent fallback. Use whenever code reads req.session.user.id, picks an authorBadge/authorityBadge, calls badgeAuthorityEngine.resolveAuthorBadge, or publishes an event that needs an actor and badge.
---

# Author id and badge resolution

Every row or event records a real actor id and a real badge. A missing actor or a badge the actor does not hold throws. No `?? "x"`, `|| "root"`, first-held-badge or hand-picked literal is used.

## Pick the pattern

| Situation | Use |
|---|---|
| Route handler writes a row and the badge comes from the route's `route_authority` row | `const { actorId, authorBadge } = await resolveActorAndBadge(req)` |
| Route handler needs only the actor | `const actorId = requireActorId(req)` |
| Route handler gates UI (buttons, `canCopy`, nav) | `const held = await resolveHeldBadges(req)` then `held.has("<noun_verb>")` |
| Core function receives `actorId` and writes a row | `const authorBadge = await badgeAuthorityEngine.resolveAuthorBadge(actorId, "<noun_verb>")` |
| Route has a fixed noun_verb (web authoring by kind) | `badgeAuthorityEngine.resolveAuthorBadge(actorId, \`${kind.toLowerCase()}_define\`)` |
| Engine or sweep publishes an event with no user | `getSystemActor(seuId)`; platform-wide with no SEU: `findPlatformSystemActorId()` and `SYSTEM_ACTOR_BADGE` |
| Seed or migration records `root` for every row | `"root"` unconditionally, only where the owner has agreed |

Helpers live in `src/domain/identity/heldBadges.ts` and `src/domain/engine/badgeAuthorityEngine.ts`.

## Rules

- Core functions are keyed on `actorId`. They do not take `authorBadge` as input when they can resolve it.
- Resolution returns `root` for a root holder and the required badge for a holder. It throws for anyone else. A route whose row lists no badge records `system`.
- Badge names are `noun_verb` in lowercase, for example `objective_propose`, `pack_define`, `review_create`.
- Creation badges are granted. They are not birth transitions (CR-128 will add birth rows). Interim literals: `review_create`, `finding_create`, `finding_convert`, `obligation_create`, `deliverable_create`, `schemadefinition_create`.
- Tenant scope is enforced by `requireTenantScope` (`forParam`, `forField`) on the route. Core logic has no tenant check.
- Authority for routes is a `route_authority` row. Do not call `requireBadge` or check a role in code.
- `transitionEngine.authorise` and `executionEngine` derive the badge from the Transition Definition verb and call `badgeAuthorityEngine.resolveAuthorBadge`. A missing badge throws.
- Every `eventBus.publish` carries a real `actorId` and badge. Never `?? null` or `?? ""`.
- Throws replace `{ ok: false }` for a missing badge. Route handlers keep their `try/catch` and map the error to a status or redirect.

## Checklist for a change

1. Grep the file for `session.user.id`, `session?.user?.id`, `authorBadge`, `authorityBadge`, `.authorise(`, `getHeldBadges(` and `?? "`.
2. Replace each hit with the row from the table above.
3. Remove `authorBadge` from the core input type when the function now resolves it, and update every caller and test fixture in the same pass.
4. Confirm the badge is in the data that grants badges. Non-root test actors must hold it.
5. Add or update a test in `tests/author-badge-resolution.test.ts` style: root, holder, outsider.
6. A route whose `route_authority` row lists no badge records `system` as the author badge. List the badge on the row to record a real one.
