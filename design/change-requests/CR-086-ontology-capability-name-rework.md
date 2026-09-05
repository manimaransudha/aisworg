# CR-086 — Rework the `capability-name` Ontology vocabulary

**Raised:** 2026-09-02 · **Origin:** owner, opened while reviewing migration `046_capability_name_ontology.sql` alongside CR-085. Part of a larger rework the owner has flagged ("There is some major rewrite we have to do. So let us do this one step at a time.") — this CR is step one of that larger rework. · **Status:** ✅ Built 2026-09-03 — Steps 1–8 complete (vocabulary rework, Objective's Required Capabilities picker, Pack seed/fixture data remapped, test-fixture ontology pollution removed, Service Definition introduced as a first-class 1:1-per-capability catalog entity, Pack's own Capabilities/Services contributions realigned to derive from the Ontology/catalog instead of duplicating it). Template-side capability resolution (`template_capabilities`, CR-085's own deferred item) remains a future step, tracked there, not here.

## Context so far

- `capability-name` is an Ontology concept type — a flat vocabulary of valid capability code *strings* (`"development"`, `"code-review"`, ...). It has no ids, no per-Pack instances, nothing to join against — it only validates that a Pack's `contributionCapabilities[].code` is a recognized term (`assertCanonicalCategory("capability-name", cap.code, ...)`).
- The real `capabilities` **table** is a separate, materialized structure — one row per Pack that contributes a given capability (`id`, `version`, `originating_pack_id`), created by `seedContributions` (`core/packs.ts`) on every Pack publish. This table is what the rest of the platform actually depends on functionally: commissioning/Template matching, dependency gating, dispatch/SLA resolution, capability fulfillment.
- Migration `046` — the first migration to give `capability-name` real content (23 seed values) — is explicit in its own header that at the time, "nothing consumes capability-name concepts today... reconciling real capability codes with these canonical names is the later 'code engine' step, not this one." That reconciliation is CR-079's `assertCanonicalCategory` check, built later.
- CR-085 (filed the same week) found that `capabilities` table resolution by bare code (`capabilitiesDB.findByCodes`, unscoped) breaks once more than one Pack legitimately shares a `capability-name` term — which is now common, since the Compliance/Domain/Integration Pack batches reuse existing terms rather than inventing new ones.

## Step 1 — the vocabulary itself (done, 2026-09-02)

Migration `046_capability_name_ontology.sql` rewritten to add the 60-concept vocabulary from Book 3 Ch.10's "Capability" table (`design/foundations/03_Book 3 (Refined)/02_Part 2/Chapter 10.md`, under `## Capability`) — codes lowercase-hyphenated, `default_label`/`description` taken from the table, 4 rows with no description left `NULL`. Owner: **"The ontology for capability-name in CR086 overrides any previous definition."** The migration was drafted as a full delete-then-insert replacement, but the owner commented out the `DELETE` before running it against the live DB, so the prior rows (the original 23, plus migrations 068/071/119/130's later additions — project-management, the 16 SDLC-phase codes, the library-domain codes, code-review, etc.) were **not removed**; they coexist in `ontology_concepts` alongside the new 60. `requirements-analysis` and `change-management` share a code string with the new vocabulary (their `default_label` stayed at the old wording — `ON CONFLICT DO NOTHING` skipped the update).

That discovery immediately raised step 2 below, since `capability-name` turned out to have a live consumer (`assertCanonicalCategory("capability-name", ...)`, CR-079, gating every Pack's `contributionCapabilities[].code` at publish time) that CR-086's own original framing had assumed didn't exist yet — and, per step 3, the vocabulary itself already contained several independently-owned code families the new Chapter-10 list doesn't cover.

## Step 2 — Objective's Required Capabilities picker moves to the Ontology (done, 2026-09-02)

**The gap found:** the New/Edit Objective page's "Required Capabilities" checkbox list was reading from the functional `capabilities` table (`capabilitiesDB.findAll()`) — one row per Pack contributing a capability, a completely different vocabulary from `capability-name`. Worse, `objective_capabilities` was a FK join to `capabilities.id`: `createObjective`/`updateObjective` resolved each submitted code to a specific `capabilities` row via `capabilitiesDB.findByCodes` and rejected anything that didn't match a real row. Once step 1 replaced the vocabulary, this was already broken in principle (the two code sets no longer overlap) even though nothing had exercised it yet.

This is the exact fork CR-085 left "explicitly not decided": *"Whether `createObjective`/`dedupeByCode`'s current row-resolving behavior is removed outright, kept as a fallback, or replaced by something that only stores the bare code."* Owner's answer, applied here: the Ontology is authoritative, so Objective stops resolving to `capabilities` rows at all — exactly CR-085's own settled framing ("Objective... does not need [to] know where the capability code came from. It just needs the capability code... This is not objective's job").

**What changed:**
- Migration `150_objective_capabilities_by_code.sql` — `objective_capabilities.capability_id` (FK → `capabilities.id`) replaced with `capability_code TEXT` (bare `capability-name` code), backfilled from the old FK before dropping it.
- `objectivesDB.addCapabilities`/`setRequiredCapabilities`/`getRequiredCapabilities` now take/return bare codes, no join to `capabilities`.
- `core/objectives.ts`: `createObjective`/`updateObjective` validate `requiredCapabilityCodes` against the `capability-name` Ontology vocabulary (`listConceptsForType`, retired = invalid, same discipline as `assertCanonicalCategory`) instead of `capabilitiesDB.findByCodes` + `dedupeByCode` (removed — no longer needed, an Ontology concept is already one row per code). `getObjectiveDetail` resolves display labels via `resolveLabels` (tenant-alias-aware, non-throwing/fallback-to-code for stale data). `suggestCapabilityCodes` now word-matches against Ontology concepts too, so its suggestions correspond to rendered checkboxes.
- New/Edit Objective pages' checkbox list now shows Ontology `code`, `default_label`, and `description` per concept.

**Explicitly out of scope for step 2 (deferred, per "one step at a time"):** Template's own capability resolution (`template_capabilities`, still a FK to `capabilities.id`, same row-picking ambiguity CR-085 described) is untouched. `commissioning.ts`'s Objective→Template handoff already only ever consumed bare `.code` off the Objective side (confirmed by inspection), so this step's blast radius stayed contained to Objective; Template-side resolution and the 8 tests CR-085 catalogued remain a separate future step.

## Step 3 — Pack seed/fixture data remapped to the new vocabulary (done, 2026-09-02)

Auditing every `*.pack.json` under `src/dblayer/seed/data/` (including `test-fixtures/`) found 35 distinct `contributions.capabilities[].code` values in real use — far more than either the old 23-code list or the new 60, because migrations 068/071/119/130 (see Step 1) had already layered in extra, independently-owned code families on top of the original OpenUP set.

Two groups, handled differently:

- **17 "generic OpenUP-style" codes** had an obvious Chapter-10 equivalent and were remapped across 80 Pack/test-fixture files (`contributions.capabilities[].code` and every matching `contributions.services[].capabilityCode`, via a scoped script — never the Pack's own top-level `code`, a separate Pack-identity vocabulary that sometimes coincidentally shares the same string, e.g. `openup-development.pack.json`'s top-level `code: "development"`):

  | old code | new code |
  |---|---|
  | `development` | `software-construction` |
  | `code-review` | `engineering-work-review` |
  | `architecture-solution-design` | `architecture-design` |
  | `configuration-management` | `engineering-configuration` |
  | `infrastructure-management` | `operating-production-systems` |
  | `devops-ci-cd-engineering` | `software-release` |
  | `monitoring-observability-sre` | `operating-production-systems` |
  | `production-support-incident-management` | `operating-production-systems` |
  | `production-deployment-release-management` | `software-release` |
  | `performance-engineering` | `operating-production-systems` |
  | `testing-qa` | `software-validation` |
  | `documentation` | `engineering-documentation` |
  | `integration-engineering` | `software-construction` |
  | `security-engineering` | `protect-organisational-assets` |
  | `knowledge-management` | `recovering-organisational-knowledge` |
  | `requirements-analysis` | unchanged (already the same code) |
  | `change-management` | unchanged (already the same code) |

- **19 codes initially left untouched, then also remapped** (owner: "replace them with one of the 60 ontology that is in 46 migration" — the earlier "leave as their own vocabulary islands" call, made unilaterally, was wrong; migrations 071/130's prior reasoning for keeping them distinct does not survive CR-086's own "overrides any previous definition" directive):

  | old code | new code |
  |---|---|
  | `vision-opportunity-framing` | `requirements-elicitation` |
  | `product-discovery` | `understanding-business-domain` |
  | `experience-design` | `software-design` |
  | `technical-architecture-discovery` | `architecture-design` |
  | `security-privacy-compliance` | `protect-organisational-assets` |
  | `platform-developer-experience` | `software-construction` |
  | `backlog-release-planning` | `requirements-prioritising` |
  | `implementation-engineering` | `software-construction` |
  | `quality-engineering-hardening` | `software-validation` |
  | `scale-performance-optimization` | `operating-production-systems` |
  | `beta-early-access-management` | `software-release` |
  | `launch-management` | `software-release` |
  | `hypercare-stabilization` | `operating-production-systems` |
  | `growth-optimization` | `adapting-business-needs` |
  | `internationalization-localization` | `software-construction` |
  | `ongoing-operations-governance` | `governing-engineering-decisions` |
  | `project-management` | `adapting-business-needs` |
  | `catalog-management` | `understanding-business-domain` |
  | `circulation-management` | `operating-production-systems` |

  Only `contributions.capabilities[].code` and matching `contributions.services[].capabilityCode` were touched — never the Pack's own top-level `code` (a separate Pack-identity vocabulary, `engineering-name`/`domain-name`/etc., validated independently of `capability-name`), even where it coincidentally shares the same string (every `sdlc-phase-NN-*.pack.json`'s own top-level code, e.g. `vision-opportunity-framing`, is untouched).

  A short-lived intermediate misstep, corrected in the same pass: hitting a `"project-management" is not a canonical capability-name concept` Pack-publish failure (from `cleanSlate.ts`'s own `TEST_FIXTURE_PACK_ONTOLOGY_CONCEPTS` safety-net list never having mirrored migrations 068/071's real entries — a pre-existing, unrelated drift bug), the concepts were briefly re-added to that list to unblock the seed run. That re-entrenched exactly the legacy vocabulary this CR is retiring, so it was reverted once the Pack files themselves were remapped instead — the right fix, since nothing needs those concepts to exist once no Pack contributes them.

**Follow-up bug from the many-to-one consolidation:** collapsing several old codes onto the same new code (e.g. `infrastructure-management` and `monitoring-observability-sre` both → `operating-production-systems`) meant 9 Integration Packs that had declared *both* old codes ended up with the same code declared twice in one Pack — `checkDuplicates` (`packs.ts`) rejects that outright (`db:clean-slate` caught it live: `"duplicate capability code within Pack: operating-production-systems"`, 9 of 20 Integration Packs failing to publish). Fixed by merging each duplicate pair into one capability entry per affected Pack (`integration-sentry`, `integration-pagerduty`, `integration-aws`, `integration-datadog`, `integration-snyk`, `integration-azure`, `integration-gcp`, `integration-jenkins`, `integration-prometheus-grafana`) — combined `name` (`"A / B"`) and `description` (both original sentences kept, concatenated), not one silently dropped. Applied via targeted span-replacement of just the `contributions.capabilities` array text (matching each file's existing indent style exactly) rather than a full JSON reformat, so nothing else in these files churned.

**Second follow-up: Templates hardcode the same vocabulary too.** `db:clean-slate` next failed publishing `saas-product` (and, by the same cause, every other standard Template): `deliverableCatalogue[].producingCapabilityCode` values are checked against "the Capabilities the selected Packs contribute" (`templates.ts:237`) — the exact same `capability-name` codes, just declared a second time, independently, in the 11 `*.template.json` files. Remapped `producingCapabilityCode` across all 11 (`api-platform`, `ai-platform`, `data-platform`, `embedded-software`, `ebook-library`, `enterprise-web-application-parent`, `legacy-modernisation`, `mobile-application`, `package-implementation`, `saas-product`, `web-application`) using the identical mapping tables above. No duplicate-key issue here even where two old codes collapsed onto one new code (e.g. both `architecture-solution-design` and `technical-architecture-discovery` → `architecture-design` within the same Template) — `templates.ts`'s own duplicate check is keyed on deliverable **name**, not `producingCapabilityCode`, so multiple deliverables legitimately sharing one producing Capability is fine.

**Third follow-up: Templates hardcode the vocabulary in two more places.** `deliverableCatalogue[].producingCapabilityCode` wasn't the only Template-side field — `dependencyGraph[].fromCapabilityCode` (80 occurrences) and, in `ebook-library.template.json` alone, a top-level `requiredCapabilityCodes` array, needed the identical remap; missed in the first Template pass because the search that found `producingCapabilityCode` didn't also check for these. All three fields now use the same mapping tables. (`mandatoryPackCodes` — also present in these files — is a *different* vocabulary, Pack identity/`engineering-name`, not `capability-name`; correctly left untouched, same as every Pack's own top-level `code`.)

Verified after the full remap (Step 3, all five passes — Pack codes, the many-to-one duplicate-code merge, and all three Template fields): every Pack/fixture/Template file still parses as valid JSON, no Pack has a duplicate capability code, and no `services[].capabilityCode`, `producingCapabilityCode`, `fromCapabilityCode`, or Template `requiredCapabilityCodes` entry points at a code missing from migration 046's 60. Zero stragglers.

**Fourth follow-up: ~30 test files hardcode the vocabulary a third time.** `pnpm test` surfaced `unknown capability code(s): architecture-solution-design, development` across most of the integration/e2e suites — 34 test files hardcode the pre-CR-086 codes directly (`requiredCapabilityCodes` arrays, `capabilitiesDB.findByCodes(...)` calls, `.code`/`capability_code` assertions, a `?capabilityCodes=` query string, and a few throwaway test-Pack fixtures). Remapped with the same tables, test-files-only (no core app change) — careful not to touch the 10 places `"development"` means something unrelated (`packsDB.findByCode("development")` — the Pack's own identity code, `packsUsed.includes("development")`, `environment: "development"` — a Profile field). Separately: the DB schema error `column "capability_code" of relation "objective_capabilities" does not exist` seen in the same run is not a test-file issue — it means migration 150 (Step 2) hadn't been applied to whichever database `pnpm test` points at.

Remaining test failures after this pass (11, e.g. `work-item-stall.test.ts`, `service-dependency.test.ts`, `tenant-contract.test.ts`) are CR-085's own pre-existing, already-deferred bug (`capabilitiesDB.findByCodes` has no Pack scoping; dedup can pick a Pack row with no Services when several Packs share a code) — not new, though Step 3's many-to-one consolidation (multiple old codes now sharing `software-construction`/`architecture-design`) made a few more Packs collide into the same already-broken bucket. No test-file fix exists for this; the real fix is CR-085's own deferred Template-level resolution work (`capabilitiesDB.ts`/`templates.ts`/`commissioning.ts` — core app code, out of scope here).

## Step 4 — test fixtures were adding to the capability-name Ontology; removed (done, 2026-09-03)

Owner: **"Are test fixtures adding capability-name to ontology? they should not be."** Confirmed: `cleanSlate.ts`'s `TEST_FIXTURE_PACK_ONTOLOGY_CONCEPTS` array (36 entries) inserted rows under `concept_type = 'capability-name'` — the 24 `test-<code>` twins from migration 119, plus `domain-ebook-library`/`technology-nodejs` (migration 119's own "real Pack" bugfix entries) and 10 more `technology-*` codes the array had drifted to include beyond migration 119's original scope.

Checked every one of the 36 against every current Pack/fixture file's actual `contributions.capabilities[].code`: **all 36 are unused.** They're Pack *identity* codes (already correctly registered under `engineering-name`/`domain-name` via migration 132's `CATEGORY_SCOPED_PACK_NAME_CONCEPTS`) — not capability-name terms at all. No Pack, real or test-fixture, has ever declared a capability contribution using a `test-`-prefixed code or a bare `technology-*` code; every test-fixture Pack reuses the same shared canonical capability codes its real counterpart does (confirmed directly, e.g. `test-sdlc-phase-00-vision-opportunity.pack.json`'s own capability code is the unprefixed `vision-opportunity-framing`, matching the real Pack, not `test-vision-opportunity-framing`). These 36 rows were dead weight from the start, not something CR-086's rework broke.

Fixed: removed `TEST_FIXTURE_PACK_ONTOLOGY_CONCEPTS` and its insert loop from `cleanSlate.ts` entirely (a future clean-slate run won't recreate them), added migration `151_remove_test_fixture_capability_name_pollution.sql` to delete the 36 already-live rows, and corrected `seedTestFixturePacks.ts`'s own header comment, which had claimed migration 119's registration was still needed.

## Step 5 — Service Definition introduced as a first-class entity (done, 2026-09-03)

Book 3 Ch.11 draws a real distinction the platform had never modeled: `service_definitions` is the canonical, versioned **contract** — one per `capability-name` code, 1:1 — while the pre-existing `services` table stays exactly what it always was, the Pack-level **composed** data (many Packs may each compose their own Service against the same Capability). Owner: *"service_definition has the definition and services table will have the pack level composed data. They are 2 different structures."*

Built end-to-end, mirroring the existing Deliverable Definition pattern (Draft-based authoring, `draft_content` JSONB, tenant-scoped, `parent_service_definition_id` for inheritance) but with a real Ch.11 §13 lifecycle instead of Deliverable Definition's plain Draft-default:

- **Ontology**: a new `service-name` concept type (migration 152) — 60 codes, one per `design/fragments/services.csv` row, `code` = slugified "Service" column, aligned 1:1 to the 60 `capability-name` codes from Step 1.
- **Schema/table**: migration 153 — `service_definitions` (`code`, `name`, `capability_code`, `purpose`, `inputs`, `outputs`, `service_level`, `governance`, `success`, `consumers[]`, `version`, `status`), lifecycle `Defined → Published → Active → Deprecated → Retired → Archived` (Ch.11 §13, strictly linear — no reactivation-as-new-version, unlike Deliverable Definition). `consumers[]` hand-resolved from the CSV's free-text Consumers column down to real `capability-name` codes (owner: *"map to the corresponding capability-name(s) correctly... External customers should be vendor-supplier-management. Dont trust the #N suffixes."*). Seed data in migration 154 (60 rows, `status = 'Active'`).
- **Authoring**: full generic-SDK-authoring wiring (`core/serviceDefinitions.ts`, `serviceDefinitionsDB.ts`, `core/sdkAuthoring.ts`/`web/sdkAuthoring.ts` branches for kind `"Service"`) plus a dedicated Service Registry list page, mirroring Deliverable Definition's own authoring + registry pair exactly. Badge convention `service_define`/`service_publish`/etc. Both `authorityVocabulary.json` (verb backfill) and — the actually load-bearing file — `transitionDefinitions.json` (the 5 real `Service` transition rows; discovered mid-build that the former alone does *not* create `transition_definitions` rows, only backfills `verb` on existing ones).

## Step 6 — `service_level` becomes structured JSONB (done, 2026-09-03)

Owner: *"service_level field in service_definitions has to be a jsonb and resemble the structure `[{code: ambiguity-free, label: Percent unambiguous requirements, target_level: minimum, target: 60, units: percent}, {}..]`."* Migration 155 converts the column from plain `TEXT` to `JSONB` (an array of `{code, label, target_level, target, units}` objects) and patches the `Service` schema-registry row's own JSON Schema to match; all 60 seed rows given a first-pass structured breakdown of their original free-text Service Level phrase (target numbers are a reasoned baseline per the migration's own header comment, not owner-specified — flagged as adjustable via the authoring UI now that one exists). `ServiceLevelExpectation` (`seuTypes.ts`) is the shared TypeScript shape, reused again in Steps 7–8 below.

Mechanically this needed `domain/sdk/formGenerator.ts` to learn two new tricks, both now generic (not Service-specific): a nested-list item field can itself be Ontology-backed (`x-referential` + `x-ontology` at the *item* level, previously only a top-level marker), and a brand-new top-level `x-widget: "referential-multi-select"` (a flat multi-select of Ontology codes, for a field like `consumers` that has no per-row shape worth wrapping into objects).

## Step 7 — Pack's own `contributionCapabilities[]` stops duplicating the Ontology (done, 2026-09-03)

Owner: *"capability code is from a dropdown of capability-name"* (already true, migration 131) *"Name and description should not be editable"* → then, taken to its conclusion: *"what is stored in contributionCapabilities[]? Just store only the code."*

`contributionCapabilities[]` narrowed from `{code, name, description}` to `{code}` alone (migration 157) — `name`/`description` are 100% derivable from the `capability-name` concept the code already resolves to (and already validates against). `core/packs.ts`'s `seedContributions` now resolves them from `ontologyDB.findConcept("capability-name", ...)` at publish time instead of trusting the Pack's own authored row, so the separate `capabilities` table (the real, functional registry Step 2's own Context section describes) still gets real `name`/`description` — just sourced from the Ontology, not duplicated free text. The authoring form shows the Capability's Ontology description as a read-only guidance line under the dropdown (never a submitted field).

## Step 8 — Pack's own `contributionServices[]` realigned to the Service Definition catalog (done, 2026-09-03)

Owner: *"The services form should show all services tied to the capabilities that are in contributions.capability[]. So Capability Code will be a display only field. Name and Contract Description are display only. these fields do not have to be stored in the contributionServices[]. The service level should show the Service's service level and allow edits to the targets... The original service definition should not be overwritten."*

`contributionServices[]` narrowed to `{code, serviceLevel}` (migration 158) — `code` now picks a canonical Service Definition (Step 5's catalog), filtered client-side to whichever Service Definitions align to a Capability this same Pack already declares (Step 7's own list) — the same "narrow one field's options by another field's live value" pattern Dependencies' own category filter already used, generalized. `capabilityCode`/`name`/`contractDescription` are shown read-only, resolved off the chosen Service Definition (never stored). `serviceLevel` carries only this Pack's own **target overrides** (`{code, target}` — `code` identifies which of the Definition's own expectations is overridden; label/target_level/units are always read from the Definition, never re-typed) — a row left unedited simply inherits the Definition's own target; the Definition row itself is never written to. `core/packs.ts`'s `seedContributions` resolves + merges at publish time, writing the merged, resolved result to the Pack-composed `services` table only (whose own `service_level` column was upgraded from the old free `{label, target: string}` pair to the same `ServiceLevelExpectation` shape, since it's now genuinely fed from a Service Definition).

**Real seed data did not fit the new model as originally authored — found and fixed in the same pass.** ~24 real Pack files (`sdlc-phase-*`, `openup-*`, `domain-ebook-library`, ...) plus their 23 test-fixture twins declared, per Pack, *several* independently-named Services under one Capability (e.g. `sdlc-phase-00-vision-opportunity.pack.json` had 10 distinct Services — "vision-one-pager," "lean-business-model-canvas," etc. — all under `requirements-elicitation`) — directly at odds with a Service Definition being 1:1 per Capability. Owner's resolution: **"Align the services to the capability."** Each Pack's multiple bespoke Service entries were collapsed to exactly one `{code}` entry per distinct Capability it declares, using that Capability's own canonical Service Definition code (looked up via migration 154's capability→service mapping); test-fixture twins regenerated as exact replicas of their (now-updated) real counterpart (owner: *"test twins should be replica of the original packs"* — confirmed the only real difference between a Pack and its twin is a `test-` prefix on the top-level `code`). The old per-service Service Level entries (free-text "Quality Bar"/"Turnaround Time" pairs) had no corresponding dimension in the new Service Definition catalog and were dropped rather than force-mapped — Packs now simply inherit their Service Definition's own declared targets until authored otherwise.

Migrations 157/158 (Steps 7–8) had not been applied as of this CR's Built date — same as every other migration in this CR's history, applying them remains the owner's own action.
