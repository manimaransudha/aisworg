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
| `authorityRules[]` (`code`, `governedTransition`, `authorisedRole`) | Composed — new, independent check | Identity here is `governedTransition`, not `code`/`name` — two *different*-coded rules governing the same transition with a different role is the real collision. **Bug found on review, fixed**: roles are aggregated *per Pack* first (matching `detectGovernanceConflicts`'s own precedent) — one Pack legitimately assigning several roles to one transition (confirmed live: `core-engineering`/`openup-development` both do this) is never a conflict; only a genuine role-*set* difference between two different Packs is. Built fresh in the new module; does not call or depend on the existing `detectGovernanceConflicts` in any way. |
| `policies[]` (codes) | Pointer | Leads to a `policy_definitions` row — see below |
| `qualityGates[]` (all fields) | Composed — new, independent check | Identity here is `(governedTransition, category)` (CR-058's "one gate per category" slot) — two gates occupying the same slot, regardless of their own `code`/`name`, is the real collision. Built fresh in the new module; does not call or depend on the existing `detectGovernanceConflicts` in any way. |
| `checklists[].name`, `.description` | No | A label for the checklist container, not verification content — same "metadata" treatment as Pack's own `name`/`description` |
| `checklists[].items[]` (`statement`, `group`, `configurableKey`, `configurableValue`) | Composed | The real content — but no identity field exists (no `code`, and `items[]` isn't identified by the checklist's own `name` either), so nothing is ever grouped/compared here in practice — a mechanical outcome, not an exemption |
| `reviewGates[]` (`code` + `governedTransition` = identity; `name`, `checklistIds`, `recommendedChecklistIds`, + VerifiableItemFields) | Composed | Real identity collision possible |
| `reviewGates[].checklistIds[]` values | Pointer | Resolved to a real `checklists.id` at publish time |
| `obligationDefinitions[]` (`code` = identity when present; `category`, `origin`, + VerifiableItemFields) | Composed | Real disagreement possible when `code` is shared |
| `engineeringCapital[]` (`type`, `url`) | Composed | Mechanism runs, but no identity field at all — nothing to group on (mechanical outcome, same as Checklists) |

### Policy Definition (what a Pack's `policies[]` code resolves to)

**Corrected on review** — the original version of this table marked `constraint_type`/applicability/
`conditions` as real conflict dimensions, grouped by derived `governedTransition`. Owner: *"two
policies do not have to agree on constraintType at all. Quality gate handles both constraint
types."* Each adopted Policy is a fully independent, coexisting rule — a transition can legitimately
carry several policies at once (some `Standard`, some `Policy`), each enforced on its own terms; there
is nothing for two of them to disagree on. (A follow-up idea — flagging two policies whose
*conditions* actively contradict each other — was also explicitly rejected: *"I do not think this is
going to happen, if this does, the problem is upstream... You cannot create meaningless
combinations."* Not built.) Policies are informational, exactly like Capabilities — keyed by their
own `code` (same code = same canonical row, trivially identical; different codes = independent,
never compared against each other).

| Field | Composed? | Why |
|---|---|---|
| `id`, `code`, `name`, `description`, `category`, `version`, `status`, `tenant_id`, `authored_by`, `parent_policy_definition_id`, `created_at` | No | Identity/administrative |
| `constraint_type`, `applicability_deliverable_names[]`, `applicability_environments[]`, `applicability_deliverable_lifecycle[]`, `conditions[]` | No | Informational only — each adopted Policy is independent; nothing to compare against another Policy |
| `governedTransition` (derived) | No | Shown for context (which transition this Policy governs), not used as a grouping/comparison key |

### Pack Dependencies

| Field | Composed? | Why |
|---|---|---|
| `dependencies[]` (`packCode`, `version`, `type`) | Composed — a pool entry like everything else, keyed by the target Pack's own code | Value carries `{type, satisfiedInComposedSet}`. Two Packs declaring conflicting relationships to the same target is caught by the same generic compare — no special case. `satisfiedInComposedSet` itself is the one real fact worth flagging: false for `required`/`conditional`, or true for `incompatible`, is a conflict (no Action column — there's no field to reconcile, the fix is "change the Pack selection"). Everything else (satisfied `required`/`conditional`, any `optional`) is a normal pool row. |

## One uniform mechanism: a single flat, source-agnostic property pool — no per-type, no per-source exceptions

There is exactly **one pool**, not one check per contribution type and a separate one for
Profile/Template fields. Every candidate value — Profile's own Configuration Parameters, Template's
own declared fields (`deliverableCatalogue`, `dependencyGraph`), Template's `exposedParameters`, and
every composed Pack's own `contributions.*` entries (Capabilities, Services, Policies, Checklists,
Review Gates, Quality Gates, Authority Rules, Obligation Definitions, Engineering Capital) — is added
to the same pool as `{ propertyName, value, source }`. `propertyName` is whichever field (or field
combination) actually identifies "the same real thing" for that entry's own type — `code`, or `name`
where that's the only identity available, for most contribution types (Policies included — keyed by
their own `code`, informational only, see the corrected Policy Definition table above); `code` is
also aggregated *per Pack* first for Authority Rules specifically, before any cross-Pack comparison
(a single Pack legitimately assigning several different roles to one `governedTransition` is real,
deliberate design, confirmed live in `core-engineering`/`openup-development` — not a disagreement;
only a genuine difference in role-*sets* between two different Packs is); `(governedTransition,
category)` for Quality Gates (the one true exception where `code`/`name` alone would miss the real
collision — see the Pack table above). This is new, independent
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

**The comparison itself recurses to full depth — owner: "EVERYTHING. Go as deep as you have to."**
Two pool entries sharing a `propertyName` are never just `===`-compared at the top: walk every key of
both values; a nested object recurses key-by-key the same way; a nested array (e.g. a Service's own
`serviceLevel[]`) is matched by whichever identity field its own items carry (`code` first, then
`name`, the same fallback order used at the top level) and recurses into each matched pair, down to
the leaf values, however many levels that takes. Independent logic, written fresh for this module —
structurally similar in shape to what `combineFields` already does in `compositionEngine.ts` (there
was never a reason to invent a worse algorithm), but a separate implementation, not a call into it.
A disagreement is reported at the deepest point it's real — e.g.
`services[code=code-review-service].serviceLevel[code=coverage].target` — not the whole containing
object flagged wholesale.

**Pack Dependencies are pool entries too — no separate section, no special casing.** Owner: "when you
create the flat pool create everything." Every Pack's own `dependencies[]` entry (`{packCode,
version, type}`, resolved transitively) becomes a pool entry keyed by the target Pack's own code,
value `{type, satisfiedInComposedSet: <target Pack code present in the composed set>}`, source the
declaring Pack. This falls under the exact same generic mechanism as everything else: two different
Packs declaring conflicting relationships to the same target (one `required`, another
`incompatible`) is a real disagreement the group-by-propertyName-compare-values pass already catches
on its own — nothing dependency-specific needed there. The one genuinely different fact is
`satisfiedInComposedSet` itself: a `required`/`conditional` entry where it's `false`, or an
`incompatible` entry where it's `true`, is a conflict — reported in the same conflicts table as
everything else, just with **no Action column populated** for that row (there is no disagreeing
sub-field for a composition strategy to reconcile — the fix is "select the target Pack," not a
merge/union/etc. decision). A satisfied `required`/`conditional` entry, or any `optional` one, is a
perfectly normal pool entry and renders in the plain pool table like anything else.

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
  contributions too, tagged with which dependency `type` pulled it in and from which Pack. Separately
  from this traversal, every `dependencies[]` entry (from every Pack in the composed set, not just
  the ones that resolved) also becomes its own pool entry — keyed by the target Pack's own code,
  value `{type, satisfiedInComposedSet}` (whether that target code ended up in the final composed
  set at all) — same as everything else in the pool, no separate section.
- Resolves Policies via `policiesDB.findByPackCode(pack.code)` — the same two-step lookup
  `deriveExposableParameterCandidates` already proved out (CR-088) — not the bare
  `pack.contributions.policies` code list: this gives the real, already-materialised per-Pack
  adoption row, including its own `governed_transition` (derived once already, at Pack-publish time;
  never re-derived here). Each adoption's own `code` is then resolved against `policyDefinitionsDB`
  (`findActiveByCodeVisibleTo`) into the real `PolicyDefinitionRow` (`constraint_type`, the three
  applicability lists, `conditions`) for comparison content.
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
- For the filter-shaped candidates `resolveEffectiveParameters` skips (Policy applicability,
  Checklist `configurableKey` — `!valueBearing`, CR-088's own other half, closed after this plan was
  drafted): call `deriveOverridableParameterCandidates` and `extractExposedParameterOverrides`
  directly, and pool-build one entry per candidate the Profile actually set a value for (a
  filter-shaped candidate has no Template-side default to fall back to, unlike the value-bearing
  case above — no override means no pool entry at all for that key).
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
  fields/exposed parameters, every Pack contribution type, and Pack Dependencies uniformly — the only
  per-type knowledge in this function at all is which field(s) define identity for a given entry
  (`code`/`name` by default, `governedTransition` for Authority Rules and Policies,
  `(governedTransition, category)` for Quality Gates, the target Pack's own code for Dependencies —
  the tables above), never whether to run the check at all. A Pack Dependency entry additionally
  carries its own `satisfiedInComposedSet` fact, checked the same pass: false on `required`/
  `conditional`, or true on `incompatible`, is reported the same way any other conflict is, just with
  no Action attached (no field to reconcile via a strategy). Flat
  human-readable strings, matching the existing `compositionReport.conflicts` message style for visual
  consistency — but returned as its own array, never merged into that one.

## Wiring into the Validation flow

**Corrected — a real mistake, not a design point.** An earlier version of this plan (and the code
built from it) had `previewCommissioningValidation` call the new module *alongside* the existing
`compositionEngine.compose()` — on the reasoning that `compose()` was still needed for
`composedPacks`/warnings/the old governance "Conflicts" alert, which this feature wasn't asked to
touch. That was never actually agreed — it was an unstated implementation choice, later
mis-described as "the design from the very start" when it demonstrably wasn't. Owner, on discovering
the consequence (the old, unresolvable `detectGovernanceConflicts` output for Authority Rules/Quality
Gates blocking `isReady` forever, even after the new mechanism resolves the exact same disagreement):
*"why is [it] taking that route when it was specifically told we are building everything new?... First
- none of the existing functions should be called. IS THIS CLEAR."*

Corrected design: `previewCommissioningValidation` (`core/commissioning.ts`) calls **only** the new
module — `compositionEngine.compose()` is not called anywhere in this flow, for any purpose.
Everything the page needs comes from `unravelComposition`/`detectCompositionConflicts` alone:
- `composedPacks` (Pack id/code/version) — `unravelComposition` already resolves every Pack in the
  composed set (`resolveComposedPacksTransitively`); its return value is extended to also expose this
  list directly, rather than recomputing it via `compose()`.
- Warnings (a named Pack code that doesn't resolve to any Active Version) — the same resolution loop
  already discovers this (`resolveActivePack` returning `null`); captured and returned directly
  instead of via `compose()`'s own warning generation.
- Conflicts — `compositionConflicts`, from `detectCompositionConflicts`, supersedes the old
  governance-conflict alert entirely for Authority Rules and Quality Gates (the two categories both
  mechanisms covered) — there is no second, parallel "Conflicts" alert anymore; the old one is
  removed from `validate.ejs`, not left in place.
- `parameterConflicts` (the CR-092 Part 6 cross-*Profile* mechanism) — structurally dead since the
  single-profile reversal (it can only ever fire with 2+ profiles, and only one may be selected now)
  regardless of this change; its own UI section in `validate.ejs` is removed too, since it was only
  ever reachable through the now-removed `compose()` call and can never fire under current policy.

`web/objectives.ts`'s `GET .../validate-commission` route passes `unraveled`/`compositionConflicts`/
`composedPacks`/`warnings` through to the view — all four now sourced from the one new module.

`seus/validate.ejs` is rebuilt around the flat pool directly — two sections, not a generic
"unravelled contribution type" dump:

**1. The pool, no conflicts** — one table, one row per non-conflicting pool entry:

| Property | Value | Source |
|---|---|---|
| e.g. `requirements-analysis` (capability code) | `{code: "requirements-analysis"}` | Pack `development` |
| e.g. `environment` | `development` | Profile `profile-api-platform-development` |
| e.g. `deliverableCatalogue` entries | (the array/object, shown as-is) | Template `api-platform` |

`Source` renders as whichever of the three the entry's `source.kind` is: the Profile's own name, the
Template's own name, or the contributing Pack's own code — plainly, not a generic id. `Value` renders
whatever the field actually is — a string prints as a string, an object prints as an object (no
special-casing per type; the owner's own answer to whether this needed a formatting rule: "whatever
is the field. If it is an object show the object").

**2. Conflicts** — one row per property the pool found more than one value for:

| Property | Source(s) & their values | Action |
|---|---|---|
| `services[code=code-review-service].serviceLevel[code=coverage].target` | Pack `development`: `80` · Pack `technology-python`: `90` | **[Composition strategy ▾]** |

The Action column is a real composition-strategy picker — the same Ontology-backed
`composition-strategy` field (`override`/`merge`/`supplement`/`union`/`intersection`/`alias`,
migration 069) rendered the same way Pack's own authoring page already renders it. Choosing one and
submitting hands **just the disagreeing sub-field itself** (owner: "for now just the disagreeing
subfield") — not the whole containing Service/Capability/whatever object — to the matching existing
strategy function (`compositionEngine.specialize`/`merge`/`union`/`intersection`/`supplement`), one
`CompositionSource` per disagreeing side (`{id: <Pack id>, code: <Pack code>, fields: {<the one
sub-field>: <that side's value>}}`) — the one piece of existing machinery this whole feature reuses,
and only for this action. Each side's own source stays visible next to its value regardless (owner:
"the source of the field has to be shown"), not folded away once a strategy is picked. This makes
resolution part of this pass, not a deferred follow-up: a conflict is resolved by picking a real
strategy and applying it, not by picking a single winning value the way `parameterConflicts`'s own
radio-pick UI works — a different, and here more appropriate, resolution shape since a conflict here
is a field-level disagreement, exactly what these strategies were built to reconcile.

**Removed, not left in place**: the old governance "Conflicts" alert (`compositionReport.conflicts`,
fed by `compositionEngine.compose()` → `detectGovernanceConflicts`) and the old "Parameter conflicts"
UI section (`compositionReport.parameterConflicts`) both depended entirely on the now-removed
`compose()` call — see "Wiring into the Validation flow" above. Neither survives on the page.

## Event-driven Commissioning — aligning with Chapter 3 (EBM) and Chapter 8 (Commissioning) events

**This section only concerns what happens after the human clicks the final "Commission" button** on
the Validation page — everything above ("Wiring into the Validation flow") describes the read-only
"Queue to Validate" preview, which stays exactly as described: no SEU row, no event, nothing
persisted, purely `unravelComposition`/`detectCompositionConflicts` run against whatever the human
has resolved so far.

Owner, on discovering that `commissionSeu` (the real commit function) independently re-ran
`compositionEngine.compose()` and could therefore re-discover — and hard-block on — a conflict the
human had already resolved on the Validation page: *"If we previewed and validated something, then
what is the point in doing something totally opposite. Whatever we validated is what should go into
the SEU."* The fix is not "have `commissionSeu` call the new module instead of the old one" (still two
independent computations, just both new) — it's that this is exactly where the platform's own
already-designed, never-built event vocabulary belongs: Chapter 8 §18 (`CommissionRequested`,
`CommissionValidated`, `CompositionStarted`, `CompositionCompleted`, `RuntimeAllocated`,
`KnowledgeInitialised`, `ParticipantsRecruited`, `SEUActivated`, `CommissionCompleted`,
`CommissionFailed`) and Chapter 3 §15 (`EBMCreated`, `EBMValidated`, `EBMVersioned`, `EBMActivated`,
`EBMRetired`, `BehaviourConflictDetected`, `BehaviourConflictResolved`) — confirmed by direct
code-verified audit (Chapter 3 §19.12 / Chapter 4 §21.13) to be **0 of 7 and 0 of 11 real today**; the
only events `commissionSeu` currently publishes are its own ad hoc `SEUCommissionRequested`/
`SEUCommissionRejected`/`SEUCommissioned`/`SEUConfigured`/`SEUActivated`/`SEUOperational`, matching
neither chapter's own vocabulary. Building this properly, instead of another bespoke pass-through
parameter, is what the owner meant by *"this will also give clear traceability."*

**Corrected against Chapter 8 §8's own canonical workflow, read directly rather than paraphrased.**
§8's own diagram is explicit and names two *separate* steps I had collapsed into one:

```
Commission Request → Validate Request → Resolve Template → Resolve Profile → Resolve Packs
  → Compose EBM → Validate Engineering Model → Allocate Runtime → Create Engineering Assets
  → Recruit Participants → Activate SEU → Ready for Execution
```

§9 names "Validate Request" as a **shallow** check: "Template existence; Profile existence; user
authorisation; Pack availability; version compatibility; commissioning parameters; mandatory
configuration." §10 names "Compose EBM" as the **deep** one: "discover Packs; resolve dependencies;
compose behaviour; validate behaviour; produce the Engineering Behavior Model." Chapter 8's own
implementation audit (§22.6/§22.7) confirms existence/authorisation/Profile↔Template-match are
*already real* (`commissioning.ts`'s existing pre-`compose()` checks) — that already-built code IS
"Validate Request," nothing new needed there beyond publishing the right event around it — and flags
"Validate Engineering Model ⚠️ folded into composition — only a conflict-count check, no separate
'model validation'" as the exact gap this work closes.

Owner, correcting my first draft of this section, which had wrongly placed `CommissionValidated` *after*
the deep Pack-level conflict work (i.e. treated `unravelComposition`/`detectCompositionConflicts` as
what makes commissioning "Validated"): *"EBM composition does what we have built now. We could break it
that way to stay consistent. What we have built now is the EBM composition and build a shallow
validation for SEU validation."* So the whole `unravelComposition`/`detectCompositionConflicts`/
`applyConflictStrategy` mechanism (everything above this section) **is "Compose EBM," not "Validate
Request."** `CommissionValidated` fires off the *shallow* gate — before any Pack-level conflict
detection runs at all — and `CompositionStarted` is what kicks off the deep work this plan already
built:

```
CommissionRequested                    (SEU Pending row created — "Commission Request")
        │
        ▼
[shallow] Validate Request             (existence + Authority/Policy gate — already real,
        │                               commissioning.ts's existing pre-compose() checks)
        ▼
CommissionValidated
        │
        ▼
CompositionStarted                     ("Compose EBM" begins)
        │
        ▼
[deep] unravelComposition /            (discover Packs, resolve dependencies, compose+validate
       detectCompositionConflicts /     behaviour — everything this plan already built, run here,
       applyConflictStrategy            not before CommissionValidated)
        │
        ▼
EBMCreated                             (ebms row persisted, status Composed)
        │
        ▼
Validate Engineering Model             (owner: "manual eyeballing for now. Later this could mean
        │                               an AI agent running some tests" — no new detection logic
        │                               for this pass, a human confirms the composed EBM directly)
        ▼
EBMValidated + EBMVersioned            (EbmStatus → Validated)
        │
        ⋮      ← a real, independently-triggered second human action, not a cascade (owner: "Validate
        │        and Activate are 2 separate events. I can validate an EBM and not yet activate it —
        │        I can have a project plan ready but not yet start it.") An EBM can sit at `Validated`
        │        indefinitely with no SEU-side consequence at all.
        ▼
Activate (EbmStatus → Active)          ("indirectly the SEU" — only NOW does the SEU's own progress
        │                               move; Validated alone has no effect on the SEU)
        ▼
CompositionCompleted
```

Either gate failing (shallow Validate Request, or unresolved Pack-level conflicts during Compose EBM)
publishes `CommissionFailed` — Ch.8 names no separate "rejected," replacing today's
`SEUCommissionRejected` for both cases — and transitions the SEU row itself `Pending → Failed` (see
"Retry after a failed commission" below; the row is never deleted, `seu_id` + this `CommissionFailed`
event is the permanent audit record of what happened).

**`BehaviourConflictDetected`/`BehaviourConflictResolved` and re-versioning are deferred, not part of
finishing commissioning.** Owner: *"Versioning is associated with behavioral-conflict resolution that
may happen during execution. We have not reached there yet."* The loop this originally implied
(review finds a conflict → resolve it → recompose a new EBM version → review again) is a *runtime*
concern — a later recomposition, potentially long after the SEU is Operational — not something the
initial commissioning path needs to handle. For this pass, "Validate Engineering Model" is a single
manual confirm with no automated re-check and no loop-back designed yet.

**No new persistence mechanism — reusing exactly what already exists (owner: "use the SEU row in
combination with the event emitted to resolve the state of the SEU. That is always how the app
functioned").** `CommissionValidated`'s own `payload` (the existing `events.payload` JSONB column,
already how `SEUCommissionRequested` carries `{objectiveId, templateIds, profileIds}` today) carries
the validated `composedPacks`/`warnings` directly — the exact output `unravelComposition` already
computed once, resolved against the human's picks. No dedicated new table. The event is tagged with
the real SEU id (`seu_id`/`originatingObjectId`, the row `commissionSeu` already created for
`CommissionRequested`) — the SEU row's own `lifecycle_state` plus this event's payload together are
the full state; nothing else is needed to resolve "what was validated for this SEU."

**The manual EBM-verification step is not a new mechanism — it's the same shape `AUTOMATIC_STEPS`
already uses, minus the "automatic" part (owner: "That is how the transitions work today. We have
already marked the events transitions for SEU as manual, haven't we?").** Every `AUTOMATIC_STEPS`
step is already routed through `transitionEngine.evaluate` with a real `actorRole`/`actorId` — real,
attributed, but "no Authority/Policy declared on them in the seed data" (`commissioning.ts`'s own
comment), so the gate passes trivially. `EBMValidated`/Activate is the same: routed through
`transitionEngine.evaluate` for a real actor+badge record, no Authority Rule required to gate it —
the only difference is a human has to actually submit the request rather than it firing inline, which
is what breaks the single-HTTP-request assumption below (not governance).

**Resolved: this lives on `EbmStatus`, not `SeuLifecycleState`.** The SEU/EBM relationship (above)
settles it — "awaiting validation" is a fact about a specific *EBM version*, not about the SEU's own
operational progress, and a future recomposition will need this identical cycle for a brand-new EBM
version while the SEU itself could already be sitting at Configured/Activated/Operational.
`SeuLifecycleState` gets no new value; the SEU simply stays wherever it currently is until its EBM
reaches `Active`. `EbmStatus` grows from `'Composed' | 'Active' | 'Superseded'` to `'Composed' |
'Validated' | 'Active' | 'Superseded'` — `Superseded` covers both a later deliberate recomposition
*and* a version abandoned after `BehaviourConflictDetected` in review (no separate "Rejected" value
needed — an abandoned version is superseded by whichever version the loop produces next).

**This is a real migration, not just a TS-type change — checked directly, not assumed.** `ebms.status`
carries a real Postgres constraint (`002_seu_platform.sql`): `CHECK (status IN ('Composed', 'Active',
'Superseded'))`. Adding `'Validated'` needs an actual migration (drop and recreate the constraint with
the fourth value) before any code can write it.

**The manual transition needs `entityType: "EBM"`, which doesn't exist as a `transitionEngine` caller
anywhere today** — every real call site (`commissioning.ts`'s own gate and `AUTOMATIC_STEPS`) evaluates
`entityType: "SEU"`. Authority Rules/Quality Gates are keyed by `governedTransition` codes already
Ontology-driven (e.g. `seu.pending_commissioned`-shaped) — an EBM-scoped transition needs its own real
`governedTransition` code minted the same way, even though (per the point above) nothing will actually
gate on it yet.

**Structural consequence worth confirming before building this:** today `commissionSeu` runs
synchronously start-to-finish inside one HTTP `POST /commission` request, returning `CommissionResult`
directly. A genuine human-in-the-loop manual gate (`EBMValidated`) between `CompositionStarted` and
`CompositionCompleted` means the SEU can no longer reach its finished state inside that one request —
`eventBus.publish`'s own dispatch is fire-and-forget (`eventBus.ts`: "publish never blocks on any
handler's work"), so the EBM Composer runs after the request has already returned, and the manual
verification is a separate action on its own later request entirely. `POST /commission` then
necessarily returns something short of "commissioned" — e.g. "SEU created, composition in progress" —
and the SEU's own detail page needs to show its current stage (awaiting composition / awaiting manual
EBM validation / commissioned) rather than assuming success is known synchronously. This is a real
change to what the web layer's success path looks like, not an implementation detail to paper over.

**Scope for this pass**, per the same question put back to the owner and confirmed: only
`CommissionRequested` → `CommissionValidated` → `CompositionStarted` → `EBMCreated` → `EBMValidated`
(manual) → `CompositionCompleted` become real, event-driven stages now. Everything Chapter 8 names
after `CompositionCompleted` (`RuntimeAllocated`, `KnowledgeInitialised`, `ParticipantsRecruited`,
`SEUActivated`, `CommissionCompleted`, `CommissionFailed`-on-later-failure) stays exactly as today's
existing inline code in `commissionSeu` (Capability/Deliverable creation, the `AUTOMATIC_STEPS`
cascade) — just now triggered off `CompositionCompleted` rather than falling straight through in the
same function body, not renamed/re-evented itself in this pass.

**New module: `src/domain/engine/ebmComposer.ts`** — a real event-bus consumer, registered by name in
`HANDLER_REGISTRY` (`eventHandlerRegistry.ts`) and wired to `CommissionValidated` the same real way
every existing subscription is: a row in `src/dblayer/seed/data/eventSubscriptions.json`
(`{eventType: "CommissionValidated", handlerName: "..."}`, plus a `CommissionValidated` entry in that
file's own `eventTypes[]` for `event_registry`), applied via `seedEventSubscriptions.ts` through
`db:clean-slate` — checked directly against `seedEventSubscriptions.ts`/the `event_registry`/
`event_subscriptions` schema (migration 089), not assumed. On consuming `CommissionValidated`: publish
`CompositionStarted`; run `unravelComposition`/`detectCompositionConflicts` (this plan's whole existing
mechanism — the deep "Compose EBM" work, not run any earlier); on remaining conflicts, publish
`CommissionFailed`; on success, build the `ebms` row (`ebmsDB.create`), status `Composed`, publish
`EBMCreated`, and wait for the manual "Validate Engineering Model" transition. On that transition,
publish `EBMValidated`, set status `Active` (marking any prior `Active` version `Superseded`), publish
`CompositionCompleted`, and hand off to the existing post-composition code (Capability/Deliverable
creation, `AUTOMATIC_STEPS`).

`commissionSeu` itself is correspondingly trimmed to just the shallow gate: it still creates the
Pending SEU row, publishes `CommissionRequested`, runs today's existing existence/Authority/Policy
checks unchanged, and publishes `CommissionValidated` on success or `CommissionFailed` on failure — and
returns there. It no longer calls `compositionEngine.compose()`, no longer runs any Pack-level
conflict detection itself, and no longer builds the `ebms` row; all of that is the EBM Composer's job
now, off the event `commissionSeu` just published.

## Resolved since last draft

- **"Review the composed EBM" is manual eyeballing, no new detection logic this pass** (owner: "Later
  this could mean an AI agent running some tests" — explicitly future work, not now).
- **Re-versioning/`BehaviourConflictDetected` loop is deferred** — an execution-time recomposition
  concern, not part of finishing initial commissioning (owner: "we have not reached there yet").
- **Validate Engineering Model is mandatory, not optional** — §8's own "shall progress through the
  following lifecycle" applies to every named step, this one included.
- **The SEU's own detail page shows the EBM directly** (owner: "SEU's detail page will show the EBM")
  — no separate "EBM review" screen; the manual transition action lives wherever the EBM is already
  rendered on that existing page.
- **No live "default Profile, no optional Packs" commissioning path exists** — checked directly, not
  assumed: `commissionFromForm` (the freeform-statement/auto-Template/`findOrCreateDefaultProfile` path)
  has no live route calling it (`web/seus.ts`'s own comment: "commissionFromForm is retired from this
  screen entirely... commissionFromForm itself is untouched — it's still" used only as a test fixture,
  ~35 test files). Nothing to special-case for it.

- **Validate and Activate are 2 separate, independently human-triggered events, not a cascade**
  (owner: *"I can validate an EBM and not yet activate it — I can have a project plan ready but not yet
  start it."*). `EbmStatus` carries the distinction: `Composed` → `Validated` (via `EBMValidated`,
  no SEU-side effect at all) → `Active` (via a *separate* later `Activate` action — this is the one
  that actually moves the SEU forward). An EBM can sit at `Validated` indefinitely.
- **The SEU detail page needs no new design** — it shows whatever it shows today; the EBM (once wired
  in, per the point above) renders there the same way everything else on that page does. Owner: *"Whatever
  it is showing today except that it is not automatic. What is the issue?"* There isn't one — the only
  actual change is that progression through these states is no longer automatic, so the page will
  naturally sit displaying an earlier state for longer (Composed, then Validated, then Active) instead
  of jumping straight to fully-commissioned inside one request. No new screen, no new rendering design.
- **`compositionEngine.compose()` is never called anywhere in this flow, full stop — including the
  shallow "Validate Request" step** (owner, again: *"For the 100th time do not use compose()."*). If a
  shallow pre-check of Pack availability is built for "Validate Request" at all, it's a fresh, minimal
  check of its own (e.g. `packsDB.findActiveByCode` per root code) — never routed through `compose()`
  or anything that calls it, at any stage, for any reason.

**"Validate Request" does need real new logic — it's not pure event-wrapping around existing code.**
Corrected after actually thinking through *why* validation is required, not just what it checks. A
Profile's own `status = 'Active'` says nothing about whether what it *references* is still current —
Pack codes, and Ontology-backed field values (`developmentMethodology`, `targetCloudProvider`, etc.)
can be retired independently, long after the Profile was authored, with nothing re-checking the
Profile when that happens. Confirmed directly, not assumed: `assertCanonicalCategory` (`ontology.ts:50`)
— the mechanism that checks whether a code is a valid, active concept — is explicitly write-path only
("retirement means 'no longer valid for new writes'"); nothing calls the equivalent check again later,
at read/use time. So a Profile can sit `Active` indefinitely while silently holding a reference to
something now retired, and nothing today catches that until deep inside composition tries to use it —
or, for Ontology-backed scalar values that aren't Pack codes, possibly never. "Validate Request"'s real
job, per owner: confirm *"am I working off a current live abstraction"* — re-check, at commissioning
time, that every Pack code the Template/Profile selects and every Ontology-backed value the Profile
carries is still active right now, not just trust the row's own `status` column. Pack-code liveness is
already effectively checked (just currently buried inside `unravelComposition`'s own resolution loop,
not as a shallow pre-check); Ontology-backed *value* liveness isn't checked anywhere today, at any
point after authoring, and that's the real gap this step closes.

**Mechanics, settled** (owner: "you show what is not live. What does it iterate over? whatever profile
points to which is abstracted as template id, pack code, capability code, service code"). Iterate over
exactly those four reference kinds the Profile (and its Template) carry — the Template id itself, every
selected Pack code, every capability code, every service code — checking each against its own live
catalog (`templatesDB`/`packsDB.findActiveByCode`/the Capability and Service Ontology). Output is just
the plain list of whichever of those codes are not currently live; that list is what `CommissionFailed`
reports.

## Retry after a failed commission — Objective-level uniqueness needs to change too

Owner, connecting `CommissionFailed` back to the Objective's own screen: *"The Objective status should
say Commission a new SEU button again."* Makes sense (a failed attempt shouldn't permanently strand the
Objective) — but it collides with a real constraint, checked directly rather than assumed:

- **Chapter 1 §18.2**: "At most one SEU per Objective" is enforced by a real, *unconditional* `UNIQUE`
  index on `seus.objective_id` (migration `034`, no partial/`WHERE` clause) — a second `INSERT` for the
  same Objective fails at the database regardless of what any application-level check decides.
- **Chapter 1 §18.9** ("Open: SEU decommissioning semantics") already flags this exact class of
  question — what happens to the Objective↔SEU relationship once an SEU's life ends one way or another
  — as *"open — to be detailed separately before it is relied upon."* This is that detailing.

Resolved, in order:

1. **Don't delete the failed SEU row** (owner: "delete a row will remove audit/traceability"). It stays
   forever, exactly like every other SEU row.
2. **The authoritative record of what happened is the event trail, not a new column** (owner: "seu_id +
   CommissionFailed is what should be used"). The `lifecycle_state` value this needs carries no
   explanation of its own — it's a structural marker only, purely so the uniqueness check (and the index
   enforcing it) can exclude this row. The real "why" is always `seu_id`'s own `CommissionFailed` event.
3. **`Retired` cannot be reused for this — checked against Chapter 2, not assumed.** §19.5's own audit
   of the real, governed state graph (`transition_definitions WHERE entity_type='SEU'`):
   `Pending → Commissioned → Configured → Activated → Operational → {Suspended ⇄ Operational, Retired}
   → Archived`. `Retired` is reached only *from* `Operational`, after a full successful run (it maps to
   the chapter's own "Knowledge Preservation" stage) — using it for "died before ever being
   Commissioned" would be a real semantic misuse. A genuinely new terminal value is needed — proposed
   name `Failed`, held loosely — plus a new governed transition-definition row (`Pending → Failed`) in
   that same real graph, fired with the same `actorRole`/`actorId` the original `CommissionRequested`
   ran under (same pattern `AUTOMATIC_STEPS` already uses — no bespoke "system actor").
4. **Uniqueness is reframed as "at most one *active* SEU," not "at most one ever"** (owner: "so
   uniqueness has to be on an active seu... not on any other previous state"). Over the real 8-state
   graph: **active** (blocks a new commission) = `Pending, Commissioned, Configured, Activated,
   Operational, Suspended`; **terminal** (doesn't block) = `Failed` (new), `Retired`, `Archived`. This
   incidentally fixes a wider, pre-existing gap the same way: today's unconditional index also permanently
   blocks re-commissioning an Objective whose SEU fully completed its life and reached `Archived` —
   folding that into "active vs. terminal" fixes both cases with one rule instead of special-casing just
   the new failure state.
5. **Migration**: drop the existing unconditional `idx_seus_objective_id_unique` and recreate it as a
   partial index: `CREATE UNIQUE INDEX ... ON seus (objective_id) WHERE lifecycle_state IN ('Pending',
   'Commissioned','Configured','Activated','Operational','Suspended')`.

## Resolved — no open questions left this pass

- **Validate/Activate need no new UI design.** The SEU detail page (`detail.ejs`) already has this
  exact generic shape repeated six times (Deliverables, Obligations, Evidence, Knowledge, Decisions,
  External Interactions) — a `POST .../transition` route per sub-entity calling
  `transitionEngine.evaluate`, with a plain form/button. Validate and Activate on the EBM are two more
  instances of that same established pattern, not a new one to invent.
- **The new terminal `lifecycle_state` value is `Failed`** — the direct nominalization of Chapter 8's
  own `CommissionFailed` event, not something invented here. Its governing transition-definition row
  (`Pending → Failed`) is the same mechanical shape as every other row already in
  `transition_definitions` — no new pattern needed there either.
- **"Validate Request" liveness check mechanics** — settled above (iterates over template id / Pack
  codes / capability codes / service codes; reports whichever aren't currently live).

## Implementation steps, in build order

Checked against real state before writing this, not assumed: `profileCompositionUnravel.ts` already
has `composedPacks`/`warnings` on `UnraveledComposition` (done earlier). `commissioning.ts` still calls
`compositionEngine.compose()` in both `commissionSeu` and `previewCommissioningValidation` (not done).
`validate.ejs` still has the old governance "Conflicts" alert and "Parameter conflicts" section (not
removed). No migration, `ebmComposer.ts`, or new event/transition rows exist yet. Also confirmed:
`transition_definitions.entity_type` had its own `CHECK` constraint dropped entirely (migration `036`)
— adding `entity_type = 'EBM'` rows needs no migration, just new rows, same as anything else there.

**1. Migrations** (3 new files):
   - Add `'Failed'` to `seus.lifecycle_state`'s `CHECK` constraint.
   - Add `'Validated'` to `ebms.status`'s `CHECK` constraint (`Composed`/`Validated`/`Active`/`Superseded`).
   - Drop the unconditional `idx_seus_objective_id_unique` and recreate as a partial index:
     `... WHERE lifecycle_state IN ('Pending','Commissioned','Configured','Activated','Operational','Suspended')`.

**2. Seed data**:
   - `transition_definitions`: one new SEU row (`Pending → Failed`); two new `EBM`-entity rows
     (`Composed → Validated`, `Validated → Active`) — real `governedTransition` codes minted the same
     way every other one is, no Authority Rule required on any of the three (same "manual, ungoverned"
     shape as `AUTOMATIC_STEPS`).
   - `eventSubscriptions.json`: register the 7 new event types (`CommissionRequested`,
     `CommissionValidated`, `CommissionFailed`, `CompositionStarted`, `EBMCreated`, `EBMValidated`,
     `CompositionCompleted`) in `event_registry`, and one subscription — `CommissionValidated` → the
     new EBM Composer's handler name.

**3. `src/domain/engine/ebmComposer.ts`** (new file) — the `CommissionValidated` consumer: publish
   `CompositionStarted`; run `unravelComposition`/`detectCompositionConflicts`; on remaining conflicts,
   publish `CommissionFailed` and transition the SEU `Pending → Failed`; on success, `ebmsDB.create`
   (status `Composed`), publish `EBMCreated`. Register it in `HANDLER_REGISTRY`.

**4. Trim `commissionSeu`** (`core/commissioning.ts`) — keep SEU-row creation + `CommissionRequested`
   + existing existence/Authority-Policy checks; add the new Ontology/Pack-liveness "Validate Request"
   check (template id / Pack codes / capability codes / service codes; report which aren't live);
   publish `CommissionValidated`/`CommissionFailed` and stop there. Remove the `compose()` call and all
   EBM-building code — that's `ebmComposer.ts`'s job now, off the event this function just published.

**5. Fix `previewCommissioningValidation`** — same removal of `compose()`, sourcing `composedPacks`/
   `warnings`/`compositionConflicts` purely from `unravelComposition`/`detectCompositionConflicts`
   (the original, still-pending fix from before this event-driven detour).

**6. Validate/Activate on the SEU detail page** — one new `POST .../seus/:id/ebm/transition` route
   (identical shape to the existing Deliverable/Obligation/Evidence/Knowledge/Decision/External-
   Interaction ones), plus the matching form/button in `detail.ejs`: Validate when the active EBM is
   `Composed` (publishes `EBMValidated`, sets `Validated`); Activate when it's `Validated` (sets
   `Active`, supersedes any prior `Active` version, publishes `CompositionCompleted`, hands off to the
   existing post-composition code — Capability/Deliverable creation, `AUTOMATIC_STEPS`).

**7. Clean up `validate.ejs`** — remove the old governance "Conflicts" alert and "Parameter conflicts"
   section entirely (still pending from the original plan correction).

**8. Objective retry** — the Objective detail page's "Commission a new SEU" visibility check needs to
   use the same active-vs-terminal distinction as the new partial index, so it re-offers commissioning
   once the prior SEU is `Failed` (or `Retired`/`Archived`).

**9. Tests** — extend `tests/profile-composition-unravel.test.ts` coverage as needed for the liveness
   check; new tests for `ebmComposer.ts`'s own event handling, the `Failed`-state retry/uniqueness
   behaviour, and the two new SEU-detail-page transitions.

## Explicitly out of scope this pass

- `RuntimeAllocated`, `KnowledgeInitialised`, `ParticipantsRecruited`, `SEUActivated`,
  `CommissionCompleted` — stay exactly as today's existing inline code in `commissionSeu`
  (Capability/Deliverable creation, the `AUTOMATIC_STEPS` cascade), just triggered off
  `CompositionCompleted` rather than falling straight through the same function body.
- `BehaviourConflictDetected`/`BehaviourConflictResolved` and EBM re-versioning — deferred to a later,
  execution-time recomposition pass (see "Resolved since last draft" above).
- The `ebms.status` migration (`Composed`/`Active`/`Superseded` → adding `Validated`) is real and
  needed, not out of scope — noted here only so it isn't missed among the application-code changes.

## Filter-shaped overrides go in the pool too (updated since this plan was first written)

CR-088's filter-shaped authoring/storage side closed after this plan was drafted: a Profile can now
store a real override for Policy applicability and Checklist `configurableKey`
(`deriveOverridableParameterCandidates` no longer excludes them). `resolveEffectiveParameters` itself
still only resolves *value-bearing* parameters (Service Level, Policy `constraintType`, `dependency`'s
`requiredState`) — its own filter (`e.value !== undefined`) skips every filter-shaped entry, since a
Template never sets a `value` for those, only `overridable`. So `unravelComposition` reads filter-shaped
overrides on its own, directly: for every candidate `deriveOverridableParameterCandidates` returns
where `!valueBearing`, look up whether this Profile's own `extractExposedParameterOverrides` sets a
value for that same key; if so, that's the pool entry's value (no Template default to fall back to —
a filter-shaped candidate never has one). Same pool, same identity key
(`sourceType::sourceCode::parameterName`), same conflict check as everything else — no special case
in `detectCompositionConflicts` itself, only in how `unravelComposition` gathers this one shape's
value.

## Files touched

- New: `src/domain/engine/profileCompositionUnravel.ts` (`unravelComposition` — now also returning
  `composedPacks`/`warnings` directly, not via `compose()` — and `detectCompositionConflicts`, both
  described above).
- `src/routes/seu/core/commissioning.ts` — `previewCommissioningValidation` no longer calls
  `compositionEngine.compose()` at all; calls only the new module, sourcing `composedPacks`/
  `warnings`/`compositionConflicts`/`unraveled` from it. `applyConflictStrategy` takes a conflict's
  disagreeing sources' own field maps and a chosen strategy code, and calls the matching
  `compositionEngine.specialize`/`merge`/`union`/`intersection`/`supplement` function (the one
  deliberate, owner-approved exception — "Only resolution will use the composestrategy mechanism
  already built for packs"), returning the resolved result to carry forward the same way
  `resolvedParameterOverrides` already does (re-submitted as hidden fields through "Re-validate"
  until commissioning).
- `src/routes/seu/web/objectives.ts` — `GET .../validate-commission` passes `unraveled`/
  `compositionConflicts`/`composedPacks`/`warnings` to the view; a `POST` action applies a chosen
  strategy to one conflict and re-renders the page with that conflict now resolved (same
  post/redirect/get shape the old `parameterConflicts` "Re-validate" used, kept for that same UX
  pattern — not because `parameterConflicts` itself still runs).
- `src/views/seu/seus/validate.ejs` — the old governance "Conflicts" alert and the old "Parameter
  conflicts" section are both removed (see "Wiring into the Validation flow" above). The pool table
  (no conflicts) and the conflicts table (with
  the composition-strategy action per row), both described above.

## Test cases (new test file, real DB, no mocking)

Checked directly (not assumed): no real seed Pack overrides `serviceLevel`, and none declares an
`incompatible` dependency — real data can exercise the *display* side (`api-platform` +
`integration-jira`, already wired) but not every conflict shape. Owner: *"Seed test data as required.
if i say test case, obviously you have to add data."* Same discipline as the CR-088 test file — a
dedicated, uniquely-coded fixture Pack/Template/Profile built directly off the DB layer
(`packsDB.create`, `templatesDB.upsert`, `profilesDB.upsert`), not the production seed pipeline
(`db:clean-slate` stays untouched):
- Two fixture Packs both adopting the same Service code with different `serviceLevel` targets →
  `detectCompositionConflicts` reports the conflict at the precise nested path
  (`services[code=...].serviceLevel[code=...].target`), naming both Packs and both values.
- Two fixture Packs both declaring a Review Gate on the same `(code, governedTransition)` with
  different `checklistIds` → reported, naming both Packs.
- Two fixture Policies (different codes) landing on the same derived governed target with different
  `constraintType` → reported.
- A fixture Pack declaring a `required` dependency on a Pack code NOT in the composed set → reported
  as a gap; the same Pack code present → no report.
- A fixture Pack declaring an `incompatible` dependency on a Pack that IS in the composed set →
  reported as a conflict.
- A clean case (no fixture disagreement) → `compositionConflicts` is empty and the pool contains the
  expected non-conflicting entries.
- A filter-shaped Profile override (Checklist `configurableKey`, per the CR-088 fixture pattern)
  appears in the pool under its own key.

## Verification

No migration, so no `db:clean-slate` needed. `tsc --noEmit` for types, then run the new test file
directly — left for the user to run per the standing "no unsolicited verification runs" instruction.
Separately, exercise the real Validation page (`/aisworg/seu/seus/new?objectiveId=<id>` → pick the
`api-platform-development` Profile, now with `integration-jira` added to its optional Packs → Queue
to Validate) to see the new pool/conflicts tables render against real data.
