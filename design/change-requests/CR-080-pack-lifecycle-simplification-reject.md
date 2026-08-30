# CR-080 — Pack lifecycle simplified (Deprecated dropped, reactivation removed) + Validated → Draft Reject

**Raised:** 2026-08-29 · **Origin:** owner, auditing Chapter 5 §11 against `transition_definitions` while reviewing CR-079's Category-first fix. · **Status:** ✅ **Built 2026-08-29.**

## The gap

Auditing Pack's actual 9 `transition_definitions` rows against Chapter 5 turned up two real questions, not bugs:

1. **What's the difference between Deprecated and Retired?** Chapter 5 never says. Checked the running code directly: `packsDB.findActiveByCode` (`WHERE status = 'Active'`) and every reactivation path's `TERMINAL_REACTIVATABLE_STATES = new Set(["Deprecated", "Retired", "Archived"])` treat them identically — no functional distinction has ever existed. Owner: *"Let us just use retired."*
2. **What's the difference between Published and Active?** This one is real: `findActiveByCode` only ever matches `Active`, so Published is a genuine governance hold point, not a functional state — Chapter 5 §19.12 already documents it as a deliberate separation-of-duties checkpoint (`pack_publish` vs `pack_activate`, different actors). Kept as-is.

Following on, the owner walked Pack's lifecycle end to end and settled a full redesign in one pass:

- Drop Deprecated entirely.
- Drop reactivation from a terminal state entirely (`Retired → Active` and `Archived → Active`) — owner: *"Remove: Retired Active activate (reactivation) / Remove: Archived Active activate (reactivation)."*
- Add a real **Validated → Draft (Reject)** hop, mirroring Objective's CR-073 mandatory/always-new-comment discipline — owner: *"From Validation, it can also be rejected and go to the Draft state similar to what we did in Objectives. There has to be a comment field and a similar implementation."*
- Every transition's verb must stay unique per meaning (the noun×verb badge is derived purely from the verb — `pack_<verb>` — so a reused verb across two different hops would silently share one badge). Confirmed: `activate`'s old 4-way reuse (Published→Active + 3 reactivation edges) is gone along with reactivation itself; every remaining verb (`validate`, `publish`, `reject`, `activate`, `retire`, `archive`) now maps to exactly one hop.
- All 6 transitions are `trigger: manual` (no governed hop, unlike Objective's Active→Achieved) — owner: *"By the way, all transitions are manual."*

One real discrepancy from Objective's own precedent, checked and flagged before building: Objective's Reject is its own distinct terminal-ish status (`Active → Reject`), never a reuse of an earlier state. Pack's Reject genuinely re-enters **Draft** instead — owner's own reasoning for the difference: *"Validation validates against packs' schema. Objective has no schema"* — Pack's schema validation makes "go back and fix it in Draft" a meaningful destination in a way Objective's Reject never was.

## The model, as built

**Lifecycle (was 7 states + reactivation, now 6, no reactivation):**

| From | To | Verb | Trigger |
|---|---|---|---|
| Draft | Validated | validate | manual |
| Validated | Published | publish | manual |
| Validated | Draft | reject | manual |
| Published | Active | activate | manual |
| Active | Retired | retire | manual |
| Retired | Archived | archive | manual |

Once Retired or Archived, a Pack Version is permanently done — no way back to Active. `copyPackAsNewDraft` (Registry "Copy") is the only way to carry a terminal Pack's content forward, and it lands in Draft, not Active.

**Reject mechanism (mirrors Objective's CR-073 *discipline*, not its target state):** a mandatory comment on every use, and it must be genuinely new text — not a repeat of the most recent comment already on record. Enforced inside `transitionPack` itself (the real chokepoint, same as `transitionObjective`), not just the UI. New `pack_comments` table — no generic/shared comment table exists to reuse; `objective_comments` is Objective-specific.

**Superseding on republish** (an Active Pack getting replaced by a newer Active Version of the same code) now lands on `Retired` directly — the same `Active → Retired` hop the explicit lifecycle wind-down step uses, not a separate mechanism (it always used `Deprecated` before; there was never a second, distinct meaning to preserve).

## Explicitly out of scope

- A dedicated "Pack was rejected" filtered list/view (Objective has one, CR-073's `getRejectedObjectivesPage`) — not asked for here; comments render inline on the Pack's own authoring page instead.
- Narrowing the shared `PackStatus` TypeScript union — it still includes `"Deprecated"` because Template/Profile/DeliverableDefinition genuinely share the type and still have a real Deprecated status of their own. Pack's own `packs_status_check` CHECK constraint (migration 137) is what actually enforces the new 6-state set at the DB level.

## Built 2026-08-29

> **Migration `137`** — 14 existing `Deprecated` Pack rows moved to `Retired` (no functional difference ever existed); `packs_status_check` rebuilt without `'Deprecated'`; new `pack_comments` table (mirrors `objective_comments` exactly); Pack's 9 `transition_definitions` rows replaced with the 6 above (verb/authority-rule/policy resolved by code, matching `seedTransitionDefinitions.ts`'s own pattern). **Migration `138`** — one new stable `engineering-name` Ontology concept (`test-pack-reject`) for the new reject test, same discipline as migrations 134–136.
>
> **Seed data**, kept in sync so `db:clean-slate` reproduces this exactly: `transitionDefinitions.json` and `authorityVocabulary.json`'s `transitions` array both updated (Pack's Deprecated-related and reactivation rows removed, `Active → Retired` and `Validated → Draft` added). `pack_reject`'s badge needs no manual `TESTER_ALL_ID` patch (unlike CR-072's `objective_propose`) — `Validated` already has a real incoming transition row, so the generic vocabulary-derived grant picks it up automatically.
>
> **`core/packs.ts`** — `reactivateAsNewVersion`/`TERMINAL_REACTIVATABLE_STATES` deleted outright, not deprecated in place; the two "supersede previous Active on republish" call sites now target `Retired`; `EVENT_BY_TARGET_STATE` drops `Deprecated`, adds `Draft: "PackRejected"`; `transitionPack` gained an optional `comment` parameter and a `"comment_required"` result reason, with the exact same checked-after-authorisation, must-be-genuinely-new-text logic `transitionObjective` already has for CR-073.
>
> **`packsDB.ts`** — `addComment`/`getComments`, identical shape to `objectivesDB`'s own.
>
> **Web layer** — the existing generic `POST /sdk/:slug/:draftId/transition` route (already shared by Pack/Template/Profile/Deliverable, driven by whatever `possibleNextStates` the current status offers) now also reads an optional `comment` from the body and threads it through for Pack only; harmless no-op for every other kind and every other Pack target state. `edit.ejs`'s "Lifecycle" card gained one shared, always-optional comment field (real enforcement stays server-side, same discipline the rest of this form already follows) and a "Comments" card showing the thread. `PACK_STATES` (`web/packs.ts`) drops `Deprecated`.
>
> **Chapter 5** updated per the owner's documentation convention for this kind of correction: §11's lifecycle diagram and §15's event list struck through with a bracketed `[Remarks: ...]` explaining the change (not silently rewritten); §19.2/§19.3 (Implementation Specifics) got normal dated append-notes instead, consistent with how every other correction in this chapter's §19 has always been recorded; §19.11's authority-badge table corrected directly (a facts table, not narrative).
>
> **Tests (`pack-sdk.test.ts`)** — every `Deprecated` reference renamed to `Retired` where the underlying behavior is unchanged (supersede-on-republish, x2); the "no Active Version" test's 3-hop wind-down path collapsed to the new 2-hop one; 4 reactivation-specific tests deleted outright (nothing left to test — the mechanism doesn't exist), replaced with one regression guard (`Retired`/`Archived → Active` both now correctly return `no_transition_definition`) and one new test for the Reject mechanism itself (mandatory comment, rejects a stale repeat, re-validate and reject again works with new text). The one authority-tier check worth keeping from the deleted tests (a `general` actor denied on the elevated badge tier) was re-pointed at `Active → Retired`, the hop that now carries that tier. `web-flow.e2e.test.ts`'s Pack lifecycle e2e test retargeted from `Deprecated` to `Retired`. `sdk-authoring.test.ts`'s own `Deprecated` reference is a *different* entity (DeliverableDefinition, which still has a real Deprecated status) — confirmed and left untouched.
>
> `pnpm typecheck` clean throughout. Migrations `137`/`138` applied directly to the dev DB and spot-verified (6 Pack transition rows, 14 rows moved off Deprecated, `pack_comments` table created). Not yet confirmed by an actual test run — owner runs the suite manually.
