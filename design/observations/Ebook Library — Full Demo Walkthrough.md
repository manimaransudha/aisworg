***All three findings fixed, 2026-08-06:***
- ***Finding #1*** *(`sdk-authoring-scope` missing from the clean slate) — added to `cleanSlate.ts`'s `BASE_PACK_CODES` (imported from `AUTHORING_SCOPE_PACK_CODE`, not hardcoded again), and the row itself restored on the live database via `pnpm migrate:seu` (014_sdk_authoring.sql's own idempotent seed). Verified: the row exists and is Active.*
- ***Finding #2*** *(generated-form Pack-code shape mismatch) — `sdkAuthoring.ts` gained `normalizePackCodes`, used by both `toTemplateSeedInput`/`toProfileSeedInput`, flattening the generated form's real `[{packCode: string}]` submission down to the `string[]` `TemplateSeedInput`/`ProfileSeedInput` actually expect — JSON import (already plain strings) unaffected. Verified against the actual shape `formGenerator.ts`'s `parseFormBody` produces for a `referential-list` field, not assumed: publishing a Template with `mandatoryPackCodes: [{packCode: "technology-nodejs"}]` now correctly registers `["technology-nodejs"]`, not `[object Object]`.*
- ***Finding #3*** *(commissioning always synthesizes a throwaway Profile) — new `findOrCreateDefaultProfile` (`core/profiles.ts`), used by both `commissionFromForm` and `commissionFromExistingObjective`: prefers a real, already-published Profile for the matched Template (development-environment one if there's a choice, distinguishing a real Profile from a past throwaway by `profilesDB.create`'s own generated-code shape), falling back to synthesizing a throwaway only when genuinely none exists — the same fallback behaviour as before. Verified: commissioning against the Objective this walkthrough used now composes `technology-nodejs` (declared optional on `ebook-library-development`), which it never did before.*
  - ***Follow-up, 2026-08-06: the "no real choice, just a heuristic" gap this fix's own comment flagged closed properly, not just documented.*** *`getObjectiveDetail` (`core/objectives.ts`) now computes a `commissioningPreview` — the matched Template plus every real (non-throwaway) Profile for it, via new `listRealProfilesForTemplate` — only while the Objective is Active. The Objective detail page renders a real `<select>` when more than one candidate exists (a plain label when exactly one, nothing when zero — unchanged in that case), and `commissionFromExistingObjective` now accepts an explicit `profileId`, reusing `commissionSeu`'s own existing `base_template_id` check rather than re-validating it. `commissionFromForm`'s quick one-shot path is unaffected — it matches a Template at submit time with no natural seam for a live picker, so it still falls all the way through to the same auto-pick heuristic as before. Verified live (`tests/commission-profile-choice.test.ts`): two real Profiles published against the same Template both surface as candidates, explicitly choosing one actually composes that Profile's own optional Packs (not whichever the heuristic would have picked), and omitting the choice still falls back correctly. Full suite: 104/112 (same 8 pre-existing `template-web-application`-shaped failures as before, zero new ones).*

# E-Book Library — Full Demo Walkthrough

*A complete, real, end-to-end run of the platform on a clean database — Pack authoring through a fully Baselined SEU — built entirely through the real SDK UI and SEU web UI, over real HTTP, as a real user would click through it. Run 2026-08-06 immediately after the database clean slate. Reusable as the literal demo script: every step below is a real screen and a real action, in order. Three real findings surfaced along the way, reported precisely, not routed around.*

## Prerequisites confirmed before starting

- Clean-slate database (`Database Clean Slate — Instructions.md`) — usage tables empty, bootstrap survived.
- **One gap in the clean slate itself, found immediately**: `sdk-authoring-scope`, the placeholder Pack `ensureAuthoringBadge` validates new Creator/Approver grants against, was missing — not covered by the clean-slate instructions (my own oversight when writing them; only `platform-core-engineering`/`technology-nodejs` were named as must-survive Packs). Didn't block this run — root's grants from earlier sessions predate the reset and short-circuit the check — but **any genuinely new identity will hit a hard failure the first time they try to author anything through the SDK UI** until this one row is restored (`INSERT INTO packs (code, name, category, pack_version, status, installation_classification, contributions, dependencies) VALUES ('sdk-authoring-scope', 'SDK Authoring Scope (badge-scope anchor, not a real Pack)', 'Platform', '1.0.0', 'Active', 'Optional', '{}', '[]');`, per `014_sdk_authoring.sql`'s own seed). **Fix this before any non-root demo user touches the SDK UI.**

## Part 1 — Authoring, entirely through the SDK UI (no hand-edited JSON, no seed script)

1. **`/aisworg/seu/sdk/pack-authoring`** → New Pack → JSON import → Approve → Publish. Authored `domain-ebook-library@1.0.0`: two Capabilities (`catalog-management`, `circulation-management`), two Services, one Standard Policy, a required dependency on `platform-core-engineering`. Real bootstrap SEU commissioned behind the scenes, real Deliverable walked `Defined → In Progress → Approved → Baselined`, real Evidence auto-created and accepted to satisfy the Trust Pipeline gate (the mechanism fixed earlier this session), `publishPack` genuinely registered it Active.
2. **`/aisworg/seu/sdk/template-authoring`** → same pattern. Authored `template-ebook-library-system`: 5 required Capabilities, 1 mandatory Pack (the one just published), and a real 5-entry Deliverable Catalogue with genuine dependency edges (Architecture Document depends on Requirements Spec; Catalog/Circulation designs both depend on Architecture; Source Code depends on both designs). Confirmed in the database afterward — every dependency edge, every required Capability, exactly as authored.
3. **`/aisworg/seu/sdk/profile-authoring`** → authored `ebook-library-development`, `environment: development`, based on the new Template, with `technology-nodejs` declared as an optional Pack.

**Real finding #2, worth fixing before relying on the generated form (not the JSON import path, which this walkthrough used and which is unaffected):** Template's `mandatoryPackCodes` and Profile's `optionalPackCodes` are declared in the Schema Registry as arrays of `{packCode: string}` objects (the `referential-list` widget's shape) — but `TemplateSeedInput.mandatoryPackCodes`/`ProfileSeedInput.optionalPackCodes` are both actually typed and consumed as plain `string[]` in `templates.ts`/`profiles.ts`. The generated form would submit the schema's declared shape and likely fail or silently corrupt the field. JSON import bypasses this since it goes straight to `toTemplateSeedInput`/`toProfileSeedInput`, which is why this walkthrough (using plain strings via import) worked cleanly.

## Part 2 — Commissioning

4. **`/aisworg/seu/objectives/new`** → created a real Objective, tier Operational, all 5 required Capabilities, statement describing the actual e-book library scenario.
5. **Activated it** (`Proposed → Active`) via the Objective detail page's transition control.
6. **"Commission an SEU from this Objective"** button → real `findCandidateTemplates` match against the 5 required Capabilities → matched the Template from step 2 → SEU commissioned, walked unattended to `Operational`.

**Real finding #3, the most structurally significant one:** the Composed Packs list showed only `domain-ebook-library`, not `technology-nodejs` — because `commissionFromExistingObjective` (`commissioning.ts:264`) **always synthesizes a brand-new, throwaway Profile** (`createProfile({ templateId, environment: "development" })`) rather than ever looking up and using an existing published one. Confirmed the same is true of the older one-shot quick-commission form. **There is currently no web UI path anywhere in the platform to actually put a hand-authored Profile to use once you've built one through the SDK UI.** Didn't block this run functionally — `platform-core-engineering` alone already provides all 5 required Capabilities, so the missing optional Pack was never load-bearing — but it means the Profile-authoring story (step 3 above) currently has no real payoff visible to a demo audience. Worth a decision on whether commissioning should offer "use an existing Profile" as a real choice.

## Part 3 — The full governance story, on real Deliverables

7. **Fulfilled all 5 Capabilities** (SEU detail page, "Assign" forms) with 5 real AI Participants. Confirmed live: every one landed at `Available`, not the old hardcoded `Assigned` bug — the fix from the Participant Lifecycle Governance work, holding on real demo data.
8. **Requirements Specification**: `Defined → In Progress` (real dispatch: Command → Work Item → Participant `Assigned → Executing → Idle`, confirmed via the Participant's final state) → `In Progress → Approved` → created real Evidence, walked `Collected → Validated → Accepted` → `Approved → Baselined`. The Trust Pipeline gate satisfied via the **Evidence** path.
9. **Architecture Document** — used to demonstrate governance actually blocking something, not just passing:
   - `Defined → In Progress`.
   - Created a real Security Obligation against it.
   - Attempted `In Progress → Approved` — **genuinely blocked**, confirmed the Deliverable stayed at `In Progress`, not just a cosmetic warning.
   - **A real Attention Item was raised automatically** — `"Action Required"`, naming the exact Quality Gate — confirming Attention Management fires correctly off a real governance block, not just a designed-but-unexercised code path.
   - Walked the Obligation through its full lifecycle to `Verified`.
   - Retried `Approved` — succeeded.
   - Created a real Decision instead of Evidence this time, walked it to `Applied`, then `Approved → Baselined`. The Trust Pipeline gate satisfied via the **Decision** path — both branches of the "accepted Evidence *or* approved Decision" gate demonstrated on real data in one run.
10. **Catalog Metadata Design, Circulation Rules Design, Source Code** — same Evidence-backed pattern as step 8, each walked fully to `Baselined`. (One self-caught scripting error along the way: with multiple Evidence rows now on the page, an early attempt grabbed the wrong — already-Accepted — row's id from the HTML instead of the newly created one, leaving two Deliverables briefly stuck at `Approved`. Caught by checking the database directly rather than trusting the HTTP 302s, fixed by targeting the correct row's real id.)

**End state, confirmed in the database: all 5 Deliverables `Baselined`, all 5 Participants `Idle`.**

## Part 4 — Telemetry, the payoff screen

11. **`/aisworg/seu/telemetry?seuId=<this SEU>`** — every number real, traceable to something done above, nothing left over from anything else:

| Metric | Value | Traces to |
|---|---|---|
| Deliverables measured | 5 | all 5, real |
| Avg cycle time | 8.7m | real dispatch + governance time |
| Quality Gate passes | 10 | 2 gates × 5 Deliverables |
| Deliverable acceptance rate | 100% | all 5 reached `Baselined` |
| Rework rate | 60% | Architecture Document's real block-then-pass cycle |
| Evidence generated | 4 | Requirements Spec, Catalog, Circulation, Source Code |
| Commands generated | 15 | real dispatch pipeline |
| Knowledge Items | 0 | correctly zero — none created this run |

This is the screen to end the demo on — every number is honest and explainable in real time if someone asks "where does that come from."

## Not included in this walkthrough, and why

- **Participant replacement** (Ch.13 §13) — real and independently tested (`tests/participant-lifecycle.test.ts`), but has no web route yet. Nothing to click, so nothing to demo — not attempted here rather than forced through a script.
- **Knowledge Items / Engineering Capital / scope promotion** — not part of this scenario; would need a Knowledge Item genuinely created and promoted, a different sub-story, not attempted here to keep this walkthrough focused.

## To re-run this for an actual demo

Everything above is idempotent-adjacent but not literally idempotent — re-running Part 1 against a database that already has `domain-ebook-library`/`template-ebook-library-system`/`ebook-library-development` will need either a fresh clean slate first, or new codes. The clean, reusable sequence is: clean slate → fix the `sdk-authoring-scope` gap → Part 1 → Part 2 → Part 3 → end on Part 4's Telemetry screen.
