# CR-032 — Dev Act-As switcher: assume real noun_verb badges, not the retired Creator/Reviewer/Approver family

**Raised:** 2026-08-19 · **Origin:** owner — "src/dry-run-suite — I think this is not reflecting the changes we have made so far. Review and update this." Running the suite end to end surfaced a genuine, pre-existing regression (not caused by this session's Pack/Template/Profile work) between CR-001 (dev Act-As switcher) and migration 043 (retiring the legacy Creator/Reviewer/Approver badge_types family once CR-006's noun × verb model went live). Owner: "fix it now in this session." · **Status:** ✅ Built 2026-08-19

> **Built 2026-08-19.**

### What running the suite found
`src/dry-run-suite`'s separation-of-duties scenario calls `P.actAs(Atlas.tenantId, "approver")`, then expects `Defined -> In Progress` to be denied with `authority_denied`. It instead got `dispatch_deferred` (a 409, so the suite's status-only assertion in the earlier "assume the badge" `must()` step masked the real problem).

Root cause, confirmed by direct DB inspection:
- Migration `012_badge_model.sql`/`035_authority_noun_verb.sql`-era authority ran on a `badge_types` vocabulary that included `creator`/`reviewer`/`approver` rows (`scope_kind SEU_or_Pack`).
- CR-006 replaced entity-transition authority with pure noun × verb badges (`badgeAuthorityEngine.authorise`, `deliverable_create`/`deliverable_approve`/`deliverable_baseline`, backed by `authority_nouns`/`authority_verbs`/`authority_noun_verbs`).
- Migration `043_retire_legacy_authority_badges.sql` then deleted the whole Creator/Reviewer/Approver `badge_types` family as dead weight ("anything legacy has to be removed") — correct for the real authority path, but nobody updated `src/dev/actAs.ts` / `src/routes/seu/web/devActAs.ts` (CR-001), which still validated and minted grants against that same now-empty `badge_types` vocabulary.
- Net effect: `devActAs.ts`'s POST handler validated `"approver"` against `listBadgeTypes()`, found no match, and `flashError`'d — but a flash-error redirect is still a 302, so `session.actAs` was silently never set. The dry-run suite's later transition attempt ran as the real (root) actor and passed authority trivially, only then hitting `dispatch_deferred` because the sandbox SEU has no fulfilling Participant.

### What's built here
- `src/dev/actAs.ts`: new `isAssumableBadgeCode(code, tenantId)` — true for `root`, any live `badge_types` row, **or** any Active `authority_noun_verbs` pair rendered as `{noun}_{verb}` (e.g. `deliverable_approve`), via the existing `authorityVocabularyDB.listActiveMappingPairs()`.
- `src/dev/actAs.ts`: `findOrMintGrant` no longer bails out when `badgeTypesDB.resolveForTenant` finds nothing. It now falls through with everything unscoped (`governedEntityType`/`capabilityId`/`scopeId` all `null`) and lets `badgeGrantsDB.create`'s own `validateBadgeGrant` — which already had a noun_verb fallback (see its own header comment, "Bug fix: noun x verb badges … have no badge_types row at all by design") — resolve or reject it. Noun_verb badges are unscoped by construction: `badgeAuthorityEngine.authorise` checks `badge_type` alone, never scope.
- `src/routes/seu/web/devActAs.ts`: POST `/dev/act-as` now validates via `isAssumableBadgeCode` instead of a raw `badge_types`-only check.
- `src/dry-run-suite/scenarios.mjs`: the SoD scenario now assumes `deliverable_approve` (a real, live badge) instead of the retired `approver` label, and asserts against the `deliverable_create`-gated transition by name. Comment updated to explain the CR-006/043 history instead of citing the retired `012_badge_model` Creator/Approver rule.
- `src/dry-run-suite/README.md`: the one line describing this scenario updated to name the real badges.

### Verification
- Ran the suite against a live `NODE_ENV=test` instance before the fix: 76 passed, 1 failed (the SoD case above). After: **77 passed, 0 failed**.
- `npx tsc --noEmit`: clean.
- Full suite (`NODE_ENV=test npm test`): 148/148, including `badge-model.test.ts`'s own in-process coverage of the same noun_verb authority path.

### Not in scope
- The navbar's own Act-As dropdown (`views/partials/navbar.ejs`, populated from `listBadgeTypes` via `app.js`) still only lists `root`/`tenant_admin`/`viewer` — a human using the UI switcher still can't pick a noun_verb badge from the `<select>`. The suite drives the POST endpoint directly (a real HTTP client isn't limited to declared `<option>`s), so this didn't block the fix here, but a live noun_verb picker for the human-facing switcher is a follow-on UI gap, not addressed by this CR.
