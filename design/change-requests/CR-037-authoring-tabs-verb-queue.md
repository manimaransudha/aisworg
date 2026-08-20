# CR-037 — Authoring tabs: "I defined" (any status) + per-verb queues only

**Raised:** 2026-08-20 · **Origin:** owner, notes.md — "The vertical tabs should show the ones on my verb queue. Eg. Packs that I defined irrespective of whatever status it is in, packs that are in validate etc. Tabs like All Validated packs are not required as they are available in the Pack registry." · **Status:** ✅ Built 2026-08-20

> **Built 2026-08-20.**

### What changed
The Authoring surface (`GET /sdk/:slug`, `buildAuthoringTabs`) used to build one tab **per verb** the entity's noun has: for `define`, "Draft packs I authored"; for every other verb, a "what did I already do" tab labelled `All {Verb}ed {kind}s` (root) / `User {Verb}ed {kind}s`, plus a special-cased `Active {kind}s` live-catalog tab — alongside a separate Queue tab per verb ("what's waiting for my action"). That's now two tab families collapsed to two tabs types:

- **"I defined"** — every row this actor authored, at *whatever status it currently sits at* (Draft, Validated, Published, Active, Deprecated, …), not just the ones still literally in Draft. New `listMyAuthoredRows` (`core/sdkAuthoring.ts`): `findAll()` (already existed, used by root's own "see everything" Registry-adjacent views) filtered client-side to `authored_by === actorId`, since `findDrafts` is hardcoded to `WHERE status IN ('Draft', 'Validated')` and can't answer "any status."
- **A Queue tab per verb this actor holds the badge for** — unchanged (`listAuthoringQueue`, separation-of-duties gating intact).
- **Removed**: every `All/User {Verb}ed {kind}s` tab and the `Active {kind}s` live-catalog tab — CR-036's now-filterable Registry shows exactly that information (state chips + the entity's own status badge), so these were pure duplication once Registry could filter by state.

`listAuthoringByVerb` (the function these removed tabs were built on) had no other callers once this was done — removed from both `core/sdkAuthoring.ts` and its now-unused import in the web route, along with the now-dead `verbPastTense`/`VERB_PAST_TENSE` helper.

### Verification
- `npx tsc --noEmit`: clean.
- Real HTTP smoke test (root, every badge): Pack Authoring shows "I defined" + all 6 queue tabs (Validate/Publish/Activate/Deprecate/Retire/Archive queue), no "Active Packs"/"All Validated Packs" style tabs remain; Template/Profile Authoring pages render (200) unaffected.
- Full suite (`NODE_ENV=test npm test`) on a fresh `db:clean-slate` → `seed:seu`: **148/148**.

### Not in scope
- "Open question not for implementation now: How does the participant integration get used in transition activities?" — owner's own note, deliberately left open, not addressed here.
