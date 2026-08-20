# CR-033 — Remove the 4 vestigial SDK-authoring bootstrap Templates/Profiles

**Raised:** 2026-08-19 · **Origin:** owner, reviewing the clean-slate script and Template Registry — asked what the `code` on `/sdk/template-authoring/7eff82c8-f47b-43de-8cd9-a207de673fe5` (`sdk-authoring-transition-definition`) actually was, after seeing it render with a "not currently active" Ontology warning on its own authoring page. Investigation found the row (and its 3 siblings) was dead: `sdkAuthoring.ts`'s own header already documented them as vestigial. Owner: "Delete the 4." · **Status:** ✅ Built 2026-08-19

> **Built 2026-08-19.**

### What these were
Four Templates (`sdk-authoring-pack`, `sdk-authoring-template`, `sdk-authoring-profile`, `sdk-authoring-transition-definition`) and their paired Profiles, seeded by `seedSdkAuthoringBootstrap()`/`seedSeu.ts`'s own copy of it. They date from a pre-CR-014 architecture where authoring a Pack/Template/Profile/TransitionDefinition worked by commissioning a real bootstrap SEU against one of these. CR-014's fix moved authoring to entity-direct Drafts (`sdkAuthoring.ts`'s own header: "There is no separate 'SDK authoring' mechanism ... Authoring a Pack/Template/Profile is just working on a Draft row of that entity itself"), and `sdkAuthoring.ts` already flagged the leftover seed constants as vestigial ("kept for the bootstrap seed + seedSeu ... but harmless, and left to avoid a seed churn").

Being real Template rows under CR-021's Ontology-backed `code` (`template-categories`), their synthetic codes never matched any of the 9 real categories, so every one permanently showed "⚠ ... (not currently active)" on its own authoring page — confusing, though functionally harmless since `code` is server-locked regardless of what a form submits.

### What's built here
- Deleted the 4 live Template rows and their 4 Profile rows directly (confirmed zero `ebms`/`seus` referenced them first; `template_capabilities`/`template_packs`/`profile_packs` cascade via real FKs).
- `src/routes/seu/core/sdkAuthoring.ts`: removed `AUTHORING_CAPABILITY_CODE`, `AUTHORING_CATEGORY`, `BOOTSTRAP_TEMPLATE_CODE`, `bootstrapProfileCode` — confirmed via grep these were consumed nowhere except the seed scripts removed below.
- `src/dblayer/seed/seedSdkAuthoringBootstrap.ts` — deleted entirely (its only job was seeding these 4). `package.json`'s `seed:sdk-authoring-bootstrap` script removed with it.
- `src/dblayer/seed/seedSeu.ts` — removed the local `seedSdkAuthoringBootstrap`/`SDK_AUTHORING_KINDS` (a second, independent copy of the same seed logic) and its call site; dropped the now-unused imports.
- `src/dblayer/seed/cleanSlate.ts` — step 2a's Template/Profile wipe no longer excludes a `BOOTSTRAP_TEMPLATE_CODES`/`BOOTSTRAP_PROFILE_CODES` allow-list (nothing needs protecting any more): `DELETE FROM profiles` / `DELETE FROM templates` unconditionally, matching the script's own README claim that "a clean-slate database has no commissionable Template." Removed step 3's `seedSdkAuthoringBootstrap()` call and renumbered steps 4–7 down to 3–6.

### Verification
- `npx tsc --noEmit`: clean.
- `pnpm db:clean-slate` end to end: succeeds, step 2a now reports 0/0 (nothing left needing exclusion), sanity check (Active base Packs survive) still passes.
- `pnpm seed:seu` on top of a freshly clean-slated DB: succeeds, no longer attempts to seed the 4 bootstrap rows.
- Full suite (`NODE_ENV=test npm test`): 148/148.

### Not in scope
- `AUTHORING_SCOPE_PACK_CODE` (`sdk-authoring-scope`, a separate placeholder Pack `ensureAuthoringBadge` validates against, referencing the same now-retired Creator/Approver badge family CR-032 addressed for Act-As) looks like a related vestige but is Pack-side, not Template-side, and wasn't part of what was asked here — left untouched.
