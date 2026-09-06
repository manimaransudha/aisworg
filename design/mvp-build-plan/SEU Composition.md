# Unravel a Profile's full composition on Commissioning Validation, and detect real cross-Pack conflicts

## Context

The Commissioning Validation page (`seus/validate.ejs`) today shows a selected Profile's own
Configuration Parameters and a bare list of composed Pack codes — nothing about what those Packs
actually *contribute*. Owner: *"I am not confident you are unravelling every detail to check for
conflicts... a profile has to unravel everything except the metadata."* Confirmed scope, verbatim:
every composed Pack's Capabilities, Services (with Service Level), Policies, Checklists, Review
Gates, Quality Gates, Authority Rules, and Pack Dependencies (mandatory/optional/conditional/
incompatible, resolved transitively) — excluding only a Pack's own administrative shell (owner,
publisher, description, installationClassification, packVersion, category).

Two corrections shaped the approach, both from this same conversation:
- **Unraveling is a read, not a composition.** Owner: *"Should n't it just be a read from the
  database and surfacing the details?"* Resolving/displaying what a Profile pulls in requires no
  merging or combining — it's walking references (Pack codes → Pack rows → their own contributions;
  Policy codes → `policy_definitions` rows; dependency Pack codes → more Pack rows) and presenting
  them. This does not touch `compositionEngine.ts`.
- **Conflict detection must be built from scratch, as its own separate feature — not by extending
  `detectGovernanceConflicts` or citing it as precedent.** Owner: *"detectGovernanceConflicts is not
  your reference. build the conflict detection from scratch as a separate feature so it is easy to
  work on if we have to change it."* `detectGovernanceConflicts` (Authority Rules, Quality Gates)
  stays exactly as it is, untouched, in `compositionEngine.ts`. The new checks live in a new,
  independent module with zero dependency on `compositionEngine.ts`.

## Every field, one row each — composed or not

"Composed" = this field's value is thrown into **one flat, source-agnostic property pool** — every
Profile Configuration Parameter, every Template-declared field, every Template-exposed parameter,
and every Pack's own contributions, all in the same pool, keyed by property name. If the same
property name shows up in that pool more than once with a different value — no matter which two
kinds of source they come from — that's a conflict, recomputed fresh every time from whatever
currently exists. Nothing is exempt because "nothing collides with it today"; today's data has no
bearing on whether the field is *subject to* the check.
"Pointer" = an id/code that leads to another entity to unravel, carries no content of its own.
"No" = administrative/structural — explicitly the "metadata" the owner said to exclude, or an
identifier with nothing to compare.

### Profile

| Field | Composed? | Why |
|---|---|---|
| `id`, `code`, `name`, `profileVersion`, `tenant_id`, `authored_by`, `created_at`, `status`, `parent_profile_id` | No | Identity/administrative |
| `description` | No | Free descriptive text, not a value another source declares |
| `category` | No | Retired (CR-091 Part 3) — no longer written or read anywhere |
| `base_template_id` | Pointer | Leads to Template — Template's own content is composed, the id itself isn't |
| `environment` | Composed | In the flat pool under the name `environment` |
| `developmentMethodology` | Composed | In the flat pool under the name `developmentMethodology` |
| `primaryProgrammingLanguage` | Composed | In the flat pool |
| `sourceControlProvider` | Composed | In the flat pool |
| `targetCloudProvider` | Composed | In the flat pool |
| `deploymentStrategy` | Composed | In the flat pool |
| `aiProviderPreference` | Composed | In the flat pool |
| `defaultRepositoryStructure` | Composed | In the flat pool |
| `documentationLevel` | Composed | In the flat pool |
| `participatingOrganisationCodes` | Composed | In the flat pool |
| `environmentConfiguration` | Composed | Free JSON, still a real value in the pool |
| `deploymentTargets` | Composed | In the flat pool |
| `additionalCapabilityCodes` | Composed | Same `capability-name` pool Pack-contributed Capabilities use — not a separate list |
| `featureFlagCodes` | Composed | In the flat pool (`feature-flag` Ontology codes) |
| `compositionOptions` | Composed | Declared-only today, still a real value in the pool |
| `optionalPackCodes`, `technologyPackCodes`, `domainPackCodes`, `compliancePackCodes`, `integrationPackCodes`, `engineeringPackCodes`, `organisationPackCodes` | Pointer | Each code leads to a Pack — the Pack's own contributions join the pool, the code list itself doesn't |
| `exposedParameterOverrides` | Composed — as the resolved value, not a raw entry | This Profile's override, paired with its base Template's own default for the same key, is a single-lineage cascade (`resolveEffectiveParameters`'s existing override-wins-else-default logic) — **not** a two-source disagreement, and never flagged as one. Only the *resolved effective value* (override if set, else the Template's default) enters the pool under that property key. |

### Template

| Field | Composed? | Why |
|---|---|---|
| `id`, `code`, `name`, `templateVersion`, `tenant_id`, `authored_by`, `created_at`, `status`, `parent_template_id` | No | Identity/administrative |
| `purpose` | No | Free descriptive text |
| `mandatoryPackCodes` + the 6 category slots (`technologyPackCodes`, `domainPackCodes`, `compliancePackCodes`, `integrationPackCodes`, `engineeringPackCodes`, `organisationPackCodes`) | Pointer | Each code leads to a Pack — composed there, not here |
| `deliverableCatalogue[]` | Composed | Real content (which deliverable-name codes this Template produces) |
| `dependencyGraph[]` edge identity (`toCode`, `fromType`, `fromCapabilityCode`/`fromCode`) | Composed | Real content — which edges exist |
| `dependencyGraph[].requiredState` | **Not a separate pool entry** — already an exposed parameter | Every edge is exactly a `sourceType: "dependency"` exposable-parameter candidate (`deriveExposableParameterCandidates`, CR-092 Part 7) — its `requiredState` is the Template's own default for that parameter, resolved through the *same* `resolveEffectiveParameters` cascade as the `exposedParameters` row below. Entering it into the pool a second time, directly off `dependencyGraph[]`, would double-count the identical value under two different lookups and manufacture a false conflict against itself. |
| `exposedParameters[]` (`sourceType`, `sourceCode`, `parameterName`, `value`, `overridable`) | Composed — as the resolved value, not the raw default | Same pairing as `exposedParameterOverrides` above — the Template's own default is one half of that single-lineage cascade, not an independent pool entry to compare it against. **The real conflict this key is exposed to**: some *other, independent Pack* — unrelated to this Template/Profile override relationship — separately declaring a value under that same property name. That's a genuine second source, and that's what the pool actually catches. |

### Pack — top level

| Field | Composed? | Why |
|---|---|---|
| `id`, `code`, `tenant_id`, `authored_by`, `created_at`, `status` | No | Identity/administrative |
| `name`, `category`, `packVersion`, `installationClassification`, `owner`, `publisher`, `description` | No | **The metadata the owner said to exclude** |
| `metadata` (CR-018 field) | No | Recorded-but-unenforced administrative metadata |
| `composition_sources` | No | Authoring-time-only (which Packs an author's own Draft was composed from) — not part of an SEU's commissioned composition |
| `dependencies[]` (`packCode`, `version`, `type`) | Pointer + structural check | Leads to another Pack (composed there); ALSO its own presence/absence check — see below — not a field-value comparison |

### Pack — `contributions.*` from all the packs coming from the profile and template. every place from wherever the pack codes come.

| Field | Composed? | Why |
|---|---|---|
| `capabilities[].code` | Composed | Grouped with Profile's own `additionalCapabilityCodes` — same code space |
| `services[].code` | Composed | Identity field |
| `services[].serviceLevel[].code`, `.target` | Composed | The actual comparable value (CR-088's "Service Level cascade") |
| `authorityRules[]` (`code`, `governedTransition`, `authorisedRole`) | Composed — new, independent check | Identity here is `governedTransition`, not `code`/`name` — two *different*-coded rules governing the same transition with a different role is the real collision. Built fresh in the new module; does not call or depend on the existing `detectGovernanceConflicts` in any way. |
| `policies[]` (codes) | Pointer | Leads to a `policy_definitions` row — see below |
| `qualityGates[]` (all fields) | Composed — new, independent check | Identity here is `(governedTransition, category)` (CR-058's "one gate per category" slot) — two gates occupying the same slot, regardless of their own `code`/`name`, is the real collision. Built fresh in the new module; does not call or depend on the existing `detectGovernanceConflicts` in any way. |
| `checklists[].name`, `.description` | No | A label for the checklist container, not verification content — same "metadata" treatment as Pack's own `name`/`description` |
| `checklists[].items[]` (`statement`, `group`, `configurableKey`, `configurableValue`) | Composed | The real content — but no identity field exists (no `code`, and `items[]` isn't identified by the checklist's own `name` either), so nothing is ever grouped/compared here in practice — a mechanical outcome, not an exemption |
| `reviewGates[]` (`code` + `governedTransition` = identity; `name`, `checklistIds`, `recommendedChecklistIds`, + VerifiableItemFields) | Composed | Real identity collision possible |
| `reviewGates[].checklistIds[]` values | Pointer | Resolved to a real `checklists.id` at publish time |
| `obligationDefinitions[]` (`code` = identity when present; `category`, `origin`, + VerifiableItemFields) | Composed | Real disagreement possible when `code` is shared |
| `engineeringCapital[]` (`type`, `url`) | Composed | Mechanism runs, but no identity field at all — nothing to group on (mechanical outcome, same as Checklists) |

### Policy Definition (what a Pack's `policies[]` code resolves to)

| Field | Composed? | Why |
|---|---|---|
| `id`, `code`, `name`, `description`, `category`, `version`, `status`, `tenant_id`, `authored_by`, `parent_policy_definition_id`, `created_at` | No | Identity/administrative — one shared canonical row per code, nothing to compare between two Packs adopting the same code |
| `constraint_type` | Composed | Different Policy codes landing on the same derived governed target with a different `constraintType` is a real conflict |
| `applicability_deliverable_names[]`, `applicability_environments[]`, `applicability_deliverable_lifecycle[]` | Composed | Same — differing/contradicting applicability across different codes on the same target |
| `conditions[]` | Composed | Same |
| (derived) `governedTransition` | Composed | Not a stored column — derived from `applicability_deliverable_lifecycle` at Pack-publish time; this derived value is what two different Policy codes are compared on |

### Pack Dependencies — the one structural (non-field-value) check

`dependencies[]` doesn't get compared field-by-field like everything above — it's a presence/absence
question against the actual composed Pack set: a `required`/`conditional` entry whose `packCode` is
NOT in the composed set is a real gap; an `incompatible` entry whose `packCode` IS in the composed
set is a real conflict. `optional` entries are composed/shown but never flagged either way.

## One uniform mechanism: a single flat, source-agnostic property pool — no per-type, no per-source exceptions

There is exactly **one pool**, not one check per contribution type and a separate one for
Profile/Template fields. Every candidate value — Profile's own Configuration Parameters, Template's
own declared fields (`deliverableCatalogue`, `dependencyGraph`), Template's `exposedParameters`, and
every composed Pack's own `contributions.*` entries (Capabilities, Services, Policies, Checklists,
Review Gates, Quality Gates, Authority Rules, Obligation Definitions, Engineering Capital) — is added
to the same pool as `{ propertyName, value, source }`. `propertyName` is whichever field (or field
combination) actually identifies "the same real thing" for that entry's own type — `code`, or `name`
where that's the only identity available, for most contribution types; `governedTransition` for
Authority Rules; `(governedTransition, category)` for Quality Gates (the two exceptions where `code`/
`name` alone would miss the real collision — see the Pack table above). This is new, independent
logic written for this module — not a call into `compositionEngine.ts`'s own `combineFields`, and not
a reason to lean on the existing `detectGovernanceConflicts` for the two types it happens to already
check. That function stays wherever it is, untouched, doing whatever it already does for the
page's existing "Conflicts" alert; this module owes it nothing and calls nothing from it.

The check itself is one pass over that one pool: group every entry by `propertyName`; for any name
held by more than one entry, compare their values — any real disagreement is a conflict, named
plainly (the property name, every disagreeing source, what each one says). This is what makes the
`environment`/`developmentMethodology`/etc. row above true without any special-casing — they're
already in the same pool as everything else, so a future Pack or Template that declared a value under
one of those same names would be caught by this exact mechanism, no code change required. A
contribution-array item with no usable identity at all (Checklists — no `code`; `name` is a label,
not a dedup key) simply never enters the pool under a meaningful key, so it can't collide with
anything — a mechanical outcome of there being no identity to key it by, not a written-in exemption.

**Pack Dependencies get one additional, structurally different check** (not a field-disagreement —
Shape doesn't apply, this is a presence/absence question): every Pack's own `dependencies[]`
(`{packCode, version, type}`, resolved transitively) is checked for `required`/`conditional` entries
whose target Pack is missing from the composed set, and `incompatible` entries whose target Pack IS
present in it.

## New module: `src/domain/engine/profileCompositionUnravel.ts`

Fully independent of `compositionEngine.ts` — no import from it, no shared state. Two pure-ish
exports:

**`unravelComposition(input: { templateIds: string[]; profileIds: string[] }, viewerTenantId: string): Promise<UnraveledComposition>`**
- Resolves the composed Pack set itself, by the same reads `compose()` uses but called
  independently (no dependency on `compositionEngine.compose()`): `templatesDB.getMandatoryPackCodes`
  per template id, `getProfilePackSelections` (`core/profiles.ts`, already unions all 7 `list_kind`s)
  per profile id, each code resolved via `packsDB.findActiveByCode`.
- Walks every resolved Pack's own `dependencies[]` transitively via `packsDB.findActiveByCode` on
  `packCode` (visited-set keyed by Pack code, cycle-safe), pulling in every referenced Pack's own
  contributions too, tagged with which dependency `type` pulled it in and from which Pack.
- Resolves every `contributions.policies` code (per Pack) against `policyDefinitionsDB` (
  `findActiveByCodeVisibleTo` or equivalent) into the real `PolicyDefinitionRow` (constraintType,
  the three applicability lists) rather than leaving it a bare code.
- Reads the Profile's own Configuration Parameters and the Template's own declared fields
  (`deliverableCatalogue`, `dependencyGraph[]`'s own edge identity — `toCode`/`fromType`/
  `fromCapabilityCode`/`fromCode`, never its `requiredState`) directly off the already-resolved
  Profile/Template rows — no extra queries beyond what's already fetched.
- For `exposedParameters`/`exposedParameterOverrides` specifically — which is also where every
  `dependencyGraph[].requiredState` value actually lives, per `deriveExposableParameterCandidates`'s
  own `sourceType: "dependency"` candidates (CR-092 Part 7) — calls the existing
  `resolveEffectiveParameters` (`core/profiles.ts`) first, and pool-builds from **its resolved
  output only** (one effective value per key — the Profile's override where set, else the
  Template's own default). The raw Template default and the raw Profile override for the same key
  are never both added to the pool as separate entries — that pairing is a single-lineage cascade,
  not a disagreement, and must never surface as one.
- Returns **one flat pool** — `Array<{ propertyName: string; value: unknown; source: { kind:
  "profile" | "template" | "pack"; id: string; code: string } }>` — built from every one of the
  above (Profile fields, Template fields, every composed/transitively-pulled-in Pack's own
  `contributions.*` entries keyed by `code`/`name`), **plus** a per-type/per-Pack breakdown of the
  same data for the view to render (grouped by contribution type, each entry tagged with its origin
  Pack) — the pool and the display grouping are two views over the same underlying data, not two
  separate resolutions.

**`detectCompositionConflicts(unraveled: UnraveledComposition): string[]`**
- No DB access — pure comparison over `unravelComposition`'s own flat pool. One generic pass: group
  every pool entry by `propertyName`; for any name held by more than one entry, compare their
  values — any real disagreement is a conflict, naming the property, every disagreeing source, and
  what each one says. This single pass covers Profile Configuration Parameters, Template's own
  fields/exposed parameters, and every Pack contribution type uniformly — the only per-type
  knowledge in this function at all is which field(s) define identity for a given entry (`code`/
  `name` by default, `governedTransition` for Authority Rules, `(governedTransition, category)` for
  Quality Gates — the table above), never whether to run the check at all. Plus the one structurally
  different Pack Dependency presence/absence check (`required`/`conditional` missing, `incompatible`
  present), which isn't a property-name comparison at all. Flat
  human-readable strings, matching the existing `compositionReport.conflicts` message style for visual
  consistency — but returned as its own array, never merged into that one.

## Wiring into the Validation flow

`previewCommissioningValidation` (`core/commissioning.ts`) calls the new module's own
`unravelComposition`/`detectCompositionConflicts` and returns two new fields: `unraveled:
UnraveledComposition` and `compositionConflicts: string[]`. This is independent of whatever else
this function already does — it isn't paired with, dependent on, or a wrapper around
`compositionEngine.compose()`; the new module resolves the Pack set itself, on its own. `web/
objectives.ts`'s `GET .../validate-commission` route passes both new fields through to the view.

`seus/validate.ejs` is rebuilt around the flat pool directly — two sections, not a generic
"unravelled contribution type" dump:

**1. The pool, no conflicts** — one table, one row per non-conflicting pool entry:

| Property | Value | Source |
|---|---|---|
| e.g. `requirements-analysis` (capability code) | (its value/shape) | Pack `development` |
| e.g. `environment` | `development` | Profile `profile-api-platform-development` |
| e.g. `deliverableCatalogue` entries | ... | Template `api-platform` |

`Source` renders as whichever of the three the entry's `source.kind` is: the Profile's own name, the
Template's own name, or the contributing Pack's own code — plainly, not a generic id.

**2. Conflicts** — one row per property the pool found more than one value for:

| Property | Source(s) & their values | Action |
|---|---|---|
| `requirements-analysis` (capability) | Pack `development`: "Requirements Analysis" · Pack `integration-jira`: "Requirements Analysis (Jira)" | **[Composition strategy ▾]** |

The Action column is a real composition-strategy picker — the same Ontology-backed
`composition-strategy` field (`override`/`merge`/`supplement`/`union`/`intersection`/`alias`,
migration 069) rendered the same way Pack's own authoring page already renders it. Choosing one and
submitting hands that conflict's disagreeing sources to the matching existing strategy function
(`compositionEngine.specialize`/`merge`/`union`/`intersection`/`supplement`) — the one piece of
existing machinery this whole feature reuses, and only for this action. This makes resolution part
of this pass, not a deferred follow-up: a conflict is resolved by picking a real strategy and
applying it, not by picking a single winning value the way `parameterConflicts`'s own radio-pick
UI works — a different, and here more appropriate, resolution shape since a conflict here is a
field-level disagreement across full contribution objects (a Capability, a Service, a Policy...),
exactly what these strategies were built to reconcile.

An existing "Conflicts" alert (governance conflicts, unrelated to this feature) stays wherever it
already is on the page, untouched.

## Explicitly out of scope this pass

- No schema/DB migration — everything here is new application code reading existing tables.
- The filter-shaped exposed-parameter mechanism (Policy applicability narrowing, Checklist
  `configurableKey` filtering — CR-088's own still-unbuilt half) stays exactly as unbuilt as it is
  today; this plan only calls the existing `resolveEffectiveParameters` for its already-built,
  value-bearing half (Service Level, Policy `constraintType`, `dependency`'s `requiredState`).

## Files touched

- New: `src/domain/engine/profileCompositionUnravel.ts` (`unravelComposition`,
  `detectCompositionConflicts`, both described above).
- `src/routes/seu/core/commissioning.ts` — `previewCommissioningValidation` calls the new module,
  return type gains `unraveled`/`compositionConflicts`; a new function (e.g. `applyConflictStrategy`)
  takes a conflict's disagreeing sources' own field maps and a chosen strategy code, and calls the
  matching `compositionEngine.specialize`/`merge`/`union`/`intersection`/`supplement` function,
  returning the resolved result to carry forward the same way `resolvedParameterOverrides` already
  is (re-submitted as hidden fields through "Re-validate" until commissioning).
- `src/routes/seu/web/objectives.ts` — `GET .../validate-commission` passes the two new fields to
  the view; a new `POST` action applies a chosen strategy to one conflict and re-renders the page
  with that conflict now resolved (same post/redirect/get shape `parameterConflicts`'s own
  "Re-validate" already uses).
- `src/views/seu/seus/validate.ejs` — the pool table (no conflicts) and the conflicts table (with
  the composition-strategy action per row), both described above.

## Verification

No migration, so no `db:clean-slate` needed. Once built: `pnpm build` (or `tsc --noEmit`) to confirm
types, then exercise the real Validation page (`/aisworg/seu/seus/new?objectiveId=<id>` → pick the
`api-platform-development` Profile, now with `integration-jira` added to its optional Packs → Queue
to Validate) to see the new unravelled sections and confirm whether Jira's own Service/Review-Gate/
Dependency content actually collides with anything in `api-platform`'s other mandatory Packs — left
for the user to run per the standing "no unsolicited verification runs" instruction.
