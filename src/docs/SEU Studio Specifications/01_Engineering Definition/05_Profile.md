# Chapter 7 – Profile Model

## 1. Purpose

A **Profile** defines the commissioning configuration for a Software Engineering Unit (SEU).

While a Template defines the structural blueprint of an SEU, a Profile specifies the variable parameters used when that blueprint is commissioned.

Profiles enable the same Template to be reused across different organisations, domains, technologies, deployment environments and engineering contexts without modifying the Template itself.

A Profile contributes configuration.

It does not contribute engineering behaviour.

---

## 2. Scope

This chapter defines:

- the Profile abstraction
- Profile responsibilities
- Profile composition
- Profile inheritance
- Profile lifecycle
- commissioning configuration

This chapter does not define:

- engineering behaviour
- Pack internals
- runtime execution
- participant capabilities

---

## 3. Architectural Position

```
Template
        │
        ├─────────────┐
        │             │
        ▼             ▼
    Profile       Pack Selection
        │             │
        └──────┬──────┘
               ▼
      Composition Engine
               ▼
Engineering Behavior Model
               ▼
             SEU
```

Profiles influence composition but are not themselves behavioural models.

---

## 4. Definition

A Profile is a reusable configuration describing **how an SEU should be commissioned** from a Template.

Profiles contain no runtime state.

Profiles contain no engineering behaviour.

Profiles are reusable across multiple SEUs.

---

## 5. Responsibilities

A Profile may define:

- development methodology
- participating organisations
- selected Packs
- technology selections
- compliance selections
- deployment targets
- environment configuration
- commissioning parameters
- feature selections
- optional capability enablement

Profiles shall not define:

- engineering practices
- governance rules
- quality rules
- participant implementations
- runtime workflows

These are provided by Packs and composed into the Engineering Behavior Model.

---

## 6. Functional Requirements

### FR-7.1

Every commissioned SEU shall reference one Profile.
 
### FR-7.2

Profiles shall be independently versioned.
 
### FR-7.3

Profiles shall support inheritance.
 
### FR-7.4

Profiles shall remain immutable after publication.
 
### FR-7.5

Profiles shall support parameter substitution.
 
### FR-7.6

Profiles shall support organisation-specific Pack selection.
 
### FR-7.7

Profiles shall support environment-specific configuration.

---

## 7. Profile Structure

Every Profile shall define:

- Identifier
- Name
- Description
- Version
- Base Template
- Selected Packs
- Selected Technologies
- Selected Domains
- Selected Compliance Packs
- Integration Packs
- Environment
- Configuration Parameters
- Feature Flags
- Composition Options

---

## 8. Profile Categories

Illustrative examples include:

### Startup
- Minimal governance
- Rapid delivery
- Default Platform Packs
 

### Enterprise
- Enterprise governance
- Multiple Organisation Packs
- Formal reviews
 

### Healthcare
- Healthcare Domain Pack
- HIPAA (or equivalent regional compliance)
- Healthcare integrations
 
### Banking
- Banking Domain Pack
- Financial compliance
- Enhanced audit requirements
 
### Prototype
- Lightweight governance
- Minimal documentation
- Rapid iteration
 
### Production
- Complete governance
- Operational monitoring
- Security validation
- Full traceability

*[Remark:Not implement categories - why?]*

---

## 9. Profile Inheritance

Profiles may inherit from other Profiles.

Example:

```
Enterprise

↓

Healthcare Enterprise

↓

Healthcare Production
```

Derived Profiles may:

- add Packs
- remove optional Packs
- override configuration values
- introduce new parameters

Derived Profiles shall not modify parent Profiles.

---

## 10. Configuration Parameters

Profiles expose parameters used during commissioning.

Examples include:

- Target cloud provider
- Primary programming language
- Source control provider
- Deployment strategy
- AI provider preferences
- Default repository structure
- Documentation level

Parameter semantics are defined by the consuming Pack.

---

## 11. Feature Selection

Profiles may enable or disable optional platform capabilities.

Examples:

- Legacy Code Analysis
- Knowledge Graph
- Multi-LLM execution
- Advanced Metrics
- Experimental Features

Feature selection shall not modify platform architecture.

---

## 12. Organisation Composition

Profiles identify the participating organisations whose Engineering Packs contribute to the Engineering Behavior Model.

Example:

```
Platform

+

TCS Engineering Pack

+

Cigna Engineering Pack

+

Healthcare Domain Pack

+

HIPAA Compliance Pack

↓

Engineering Behavior Model
```

The Profile specifies **what participates**.

The Composition Engine determines **how they are combined**.

---

## 13. Versioning

Profiles shall be independently versioned.

Historical versions shall remain available.

Every commissioned SEU shall permanently reference the Profile version used during commissioning.

---

## 14. Lifecycle

```
Draft

↓

Validated

↓

Published

↓

Active

↓

Deprecated

↓

Retired

↓

Archived
```

---

## 15. Events

The Profile subsystem shall publish:

- ProfileCreated
- ProfileValidated
- ProfilePublished
- ProfileActivated
- ProfileDeprecated
- ProfileRetired

---

## 16. Non-Functional Requirements

Profiles shall:

- remain reusable
- support inheritance
- remain immutable after publication
- support deterministic commissioning
- remain independent of runtime execution

---

## 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Profiles can be created and versioned.

✓ Profiles support inheritance.

✓ Profiles configure commissioning without defining engineering behaviour.

✓ Profiles support Pack selection.

✓ Profiles support organisation composition.

✓ Multiple SEUs can be commissioned from the same Template using different Profiles.

---

## 18. Deliverables

Implementation of this chapter shall produce:

- Profile domain model
- Profile registry
- Profile inheritance model
- Configuration parameter model
- Profile versioning services
- Profile lifecycle services
- Profile APIs
- Profile events

---

## 19. Implementation Specifics

*Recorded 2026-08-19, first pass. This section documents how the Profile Model is realised in the current build, the same convention Chapter 6 §20 uses for Template/Profile's shared authoring pipeline (Profile's own authoring/lifecycle mechanics were already covered there in passing; this is Profile's dedicated pass against this chapter's own numbered requirements). It does not change the requirements above (FR-7.1–7, §§1–18); it records what is built, what is partial, and what is still open. Status markers: ✅ built · ⚠️ partial · ***open*** not built.*

**Headline finding: Profile is the least-built of the three authored nouns.** Pack and Template both went through the same defect Profile still has — a bare `UNIQUE(code)` identity that let republishing overwrite a "published" row in place — and both were fixed (Pack: migration `010`, this session; Template: CR-024). Profile was deliberately left out of that fix (CR-024's own explicit decision: "Profile is unaffected... `base_template_id` stays a frozen row FK... the owner chose pinning") and has stayed untouched since. Nearly every gap below traces back to that one decision holding — versioning, inheritance, and the events that would announce a new version all depend on identity that doesn't exist yet for Profile.

### 19.1 ✅ Identity, authoring, and lifecycle — entity-direct, mirrors Pack/Template (§14; Ch.6 §20.1/§20.2)

Profile shares the exact same entity-direct authoring pipeline Pack and Template use (`core/sdkAuthoring.ts`, one generic mechanism for all three kinds) and the same full seven-state lifecycle (`Draft → Validated → Published → Active → Deprecated → Retired → Archived`, `transitionDefinitions.json`) — both built and verified as part of the 2026-08-18 six-hop lifecycle seed change (Ch.6 §20.2's own note). Authority is noun × verb (`profile_define`/`profile_validate`/.../`profile_archive`), root bypass, same as Pack/Template (Ch.6 §20.11). `advanceProfileOneStep` mirrors `advancePackOneStep`/`advanceTemplateOneStep` exactly.

**What doesn't carry over from Pack/Template**: ~~neither the terminal-reactivation edges (`Deprecated/Retired/Archived → Active`) nor a `reactivateAsNewVersion`-equivalent exist for Profile~~ **Built 2026-08-19, same day as this section was first written — see §19.2.** Both now exist, mirroring Pack/Template exactly.

### 19.2 ✅ Versioning and immutability — built (§13; FR-7.2, FR-7.4)

~~`profiles.code TEXT NOT NULL UNIQUE` (migration `002`) — no `profile_version` column, ever... This is precisely the defect Pack (migration `010`) and Template (CR-024) both had and both fixed; Profile never got the equivalent treatment.~~

**Built 2026-08-19, same day — owner: "19.2 and 19.3 has to be fixed similar to pack and template."** `profiles.tenant_id`, `profiles.profile_version`, and `profiles.parent_profile_id` all added in one migration (`064`, Profile had none of Pack's/Template's foundation to build on incrementally, unlike Template which got there in two CRs) — `profiles_code_key` replaced by `profiles_code_version_tenant_key UNIQUE(code, profile_version, tenant_id)`. `profilesDB.upsert`'s `ON CONFLICT` target moved to match; a second publish under an existing `(code, profileVersion, tenantId)` is still idempotent (VM-002), but a *different* version or tenant is a genuinely new, immutable row, never an overwrite. `core/profiles.ts` gained `reactivateAsNewVersion`/`nextAvailablePatchVersion`/a `TERMINAL_REACTIVATABLE_STATES` check in `transitionProfile`, and `advanceProfileOneStep`'s `Published → Active` hop supersedes whatever else is Active for the code *within the same tenant* — byte-for-byte mirrors of `core/templates.ts`'s own CR-024 shape. §13's sharper consequence (an EBM's `profile_id` silently reading different content after a later overwrite) no longer applies — there is no overwrite path left; `ebms.profile_id` now always resolves to an immutable row.

### 19.3 ✅ Inheritance — built (§9; FR-7.3)

~~No `parent_profile_id` column exists anywhere in `profiles`... Profile has no `tenant_id` column at all (see §19.8), so a Profile-inheritance CR would need to settle that identity question from scratch rather than reuse an existing decision.~~

**Built 2026-08-19, same day, alongside §19.2 (the `tenant_id` §19.3 originally said Profile lacked is exactly what §19.2 just added).** Same Option A identity model CR-026 gave Template: a Derived Profile keeps its parent's own `code`, disambiguated by the new Draft's own `tenant_id`, not a new identity per generation — `parent_profile_id` set once at Draft creation via an "Inherit" control (`edit.ejs`, mirroring Template's exactly) and locked for the Draft's life. §9's own rules turned out simpler for Profile than for Template: Profile has no "mandatory" concept at all (every Pack selection is optional by definition, §5), so unlike Template's mandatory-Packs-superset validator, Profile's inheritance validator is just the identity lock — "remove optional Packs" (§9) is explicitly allowed, not a violation to catch. `listInheritableProfiles`/`inheritedProfileContent` (`core/sdkAuthoring.ts`) mirror `listInheritableTemplates`/`inheritedTemplateContent` exactly, reconstructing a parent's real content (including the new category-scoped Pack-selection slots, §19.4) rather than trusting its possibly-stale `draft_content`.

### 19.4 ✅ Profile Structure — all 14 §7 fields are now real (§7)

~~The actual `profiles` row + authored grammar... is: `code`, `name`, `baseTemplateCode`, `environment`, `configParameters`, `optionalPackCodes`. Against §7's 14-item list: Built as their own real thing: 6. Missing entirely: Description, Version, Feature Flags, Composition Options. Folded into one undifferentiated list: Selected Technologies/Domains/Compliance Packs/Integration Packs.~~

**Built 2026-08-19, same day — owner: "Profiles are part of schema registry. So all missing fields have to be fixed at schema level and the form generator has to use it. Similar to pack and template implementation."** Migration `066` added every remaining field directly to Profile's `schema_definitions` grammar, using the same generic, already-existing widget mechanisms Pack/Template use — no new form-generator widget kinds, one small generalisation (below):
- **`category`** — Ontology-backed (`profile-categories`, migration `065`, seeded with §8's 6 examples), the same `referential-select` + `x-ontology` mechanism Template's `code` uses — but kept as its **own field**, not folded into `code` the way Template's is (Template's own shortcut is exactly what made *its* inheritance identity awkward, Ch.6 §20.4/§20.14 — not repeated here now that Profile is also getting inheritance in the same pass).
- **`profileVersion`**, **`description`** — the same generic `x-widget:"version"`/`"textarea"` mechanisms `packVersion`/`templateVersion`/`purpose` already use.
- **`featureFlagCodes`** (§19.6) and **`technologyPackCodes`/`domainPackCodes`/`compliancePackCodes`/`integrationPackCodes`** — all `referential-list` fields, same widget `mandatoryPackCodes`/`optionalPackCodes` already use. The one real generalisation: `_referentialListGroup.ejs`'s Pack-code picker now accepts an `x-referential` value of `"pack-code:<Category>"`, filtering the offered Packs to that Ontology `category:pack` value (Technology/Domain/Compliance/Integration — already-seeded Pack categories, not a new vocabulary) — so the four fields are genuinely category-scoped pickers, not just four renamed copies of `optionalPackCodes`. `featureFlagCodes`' item field sources a *different* concept type (`feature-flag`, migration `065`, seeded with §11's 5 examples) through the same plain-referential mechanism, resolved generically via `loadReferentialOptions`.
- **`compositionOptions`** — declared, not yet enforced, the same treatment Pack's own §8/§13 compatibility metadata already has (Ch.5 §19.9's precedent).

§8's own categorisation gap this section originally flagged (nothing distinguishing "the domain Pack" from "the compliance Pack") is closed by construction — each of the four fields can *only* offer Packs of its own category.

**Extended 2026-09-05 — [CR-091](../../change-requests/CR-091-profile-structure-completion.md), closed same day.** Auditing §5 directly against this section's own "all 14 §7 fields" claim found it was checking the wrong list: two of §5's own 9 "may define" items — **Deployment Targets** and **Optional Capability Enablement** — have no corresponding item in §7's 14-field list at all, and no field anywhere in the schema. Both built: `deploymentTargets` (`x-widget:"json"`, free-form — owner: *"Deployment targets is not the same as environment... it will be a json so there is flexibility"* — same declared-not-enforced treatment as `compositionOptions`) and `additionalCapabilityCodes` (a `referential-list` of `capability-name` Ontology codes, `x-ontology:true` — owner: *"just a list of capability-names from ontology not already there coming from the templates"* — the offered options are narrowed, Profile-authoring-side only, to exclude whatever the chosen base Template's own Pack selections already require, `web/sdkAuthoring.ts`). Both live only in `draft_content`, no real column, same treatment as `compositionOptions`/`featureFlagCodes`. Also closed: the four category-scoped Pack fields only covered 4 of Pack's real 6 categories — `engineeringPackCodes`/`organisationPackCodes` added, mirroring the existing four exactly, so Profile's own Pack-category coverage now matches Template's six-slot `PACK_SELECTION_SLOTS` precisely. Left deliberately open: **Participating Organisations** (owner: *"I think this should be in capability fulfilment. leave it open for now"*) — not part of this pass. As with `compositionOptions`/`featureFlagCodes`/`configParameters` before them, none of the three new fields are consumed by `compositionEngine`/`commissioning.ts` yet — declared only, consistent with (not a new instance of) §19.5/§19.6/§19.7's own already-logged gaps.

### 19.5 ⚠️ Configuration Parameters are stored but inert — no substitution mechanism exists (§10; FR-7.5)

`config_parameters` JSONB is real, authored, and round-trips through Draft → Active correctly. What doesn't exist: anything that reads it. `compositionEngine.ts` and `commissioning.ts` — checked directly — never reference `configParameters`/`config_parameters` anywhere; it flows only through storage, the form generator, and the read-only API, never into composition or commissioning. §10's own framing ("Parameter semantics are defined by the consuming Pack") already anticipated this would be opaque to the platform, but FR-7.5's "Profiles shall support parameter substitution" implies some resolution step turning a Profile's parameter values into something a Pack actually consumes at commissioning time — that step doesn't exist. A Profile's `configParameters` today is authored, persisted, and then never read again by anything.

*(Note, 2026-08-19: `compositionOptions`, added this same day by §19.4, is in exactly the same position — declared, stored, never consumed. Not treated as a new instance of this gap since it was never asked to be more than declarative; §7's own "Composition Options" field carries no implied substitution semantics the way §10's "Configuration Parameters" does.)*

**Updated 2026-09-05 — the CR this section said was "worth [opening]... not opened here" has now been opened and half-built: [CR-088](../../change-requests/CR-088-template-profile-configurable-parameters.md), closed 2026-09-05.** CR-088 answers *which* parameters ought to be substitutable at all — not a Pack's whole free-form shape, but specific, individually-flagged dimensions (Service Level metrics, Policy's `constraintType` and three applicability lists, Checklist's own new `configurableKey`/`configurableValue` tag) — and builds the **Template-side half** of the mechanism this section's gap implies: a Template's new "Exposable Parameters" tab, where each candidate parameter its selected Packs actually carry gets a value (for single-value parameters) plus a checkbox (default checked) saying whether a Profile may override it at all. Checked directly, same as above: `compositionEngine.ts`/`commissioning.ts` still never reference the new `exposedParameters` field either, and `core/profiles.ts` has no field or mechanism of its own to *supply* a matching override value or filter — so this section's own finding stands exactly as written for Profile's own side. What's changed is that the gap now has a name and a defined shape rather than being fully open: Profile's own consuming half (a real replacement for `configParameters`' free-form blob, one shaped to receive a value/filter per parameter Template left checked) and the `compositionEngine` resolution step that would apply any of it at commissioning are CR-088's own explicitly-deferred follow-up, to be picked up when Profile itself gets its own design pass — not a new CR still to be opened.

### 19.6 ✅ Feature Selection — built (§11)

~~No field, no column, no concept distinct from `configParameters`... Unbuilt, not merely undocumented.~~

**Built 2026-08-19, same day, as part of §19.4's schema-level fix.** `featureFlagCodes` — an Ontology-backed (`feature-flag`, migration `065`) referential-list, seeded with §11's own 5 examples (Legacy Code Analysis, Knowledge Graph, Multi-LLM execution, Advanced Metrics, Experimental Features) and open to a tenant adding its own, the same open-vocabulary treatment every other Ontology concept type gets. §11's own "Feature selection shall not modify platform architecture" is satisfied by construction — nothing reads `featureFlagCodes` to conditionally alter platform behaviour (same honest limitation as §19.5's `configParameters`: declared, not yet wired to anything that acts on it, which is a *different* gap than "doesn't exist at all").

### 19.7 ⚠️ Organisation Composition — the field is real; composing it isn't (§12; FR-7.6)

~~§12's own example composes Packs from four distinct participants (Platform + TCS + Cigna + a Healthcare Domain Pack + a Compliance Pack)... the current binary Platform-or-mine visibility scoping structurally can't reach that.~~

**Corrected 2026-08-19, same day — this finding misread §12's own model.** Owner: "TCS + Cigna + a Healthcare Domain Pack + a Compliance Pack — all of these will have tenant id. So why do you say not present. If your question is are multiple tenants allowed, it is not. Instead the third-party tenant [Cigna, in this case] has to be created as an integration pack under [the primary tenant, TCS]." §12's diagram was never asking for literal multi-tenant Pack *visibility* — a third-party organisation's contribution is onboarded as an **Integration Pack**, owned by (and authored under) the primary tenant, not browsed cross-tenant at Profile-authoring time. That's exactly §7's **Integration Packs** field, which didn't exist when this section was first written and now does (`integrationPackCodes`, §19.4) — §12's model is satisfied by a Profile author selecting from their own tenant's (+ Platform's) Integration-category Packs, the same visibility scoping every other Pack picker on this page already has. No multi-org visibility design question was ever open here.

**Downgraded 2026-09-05 — the field being real doesn't mean composing it works; checked `compositionEngine.compose()` directly and it doesn't.** Prompted by the owner's own §12-adjacent example — "a domain pack dependency should be configurable... a profile can choose a HIPAA pack" — reviewed while closing [CR-088](../../change-requests/CR-088-template-profile-configurable-parameters.md), which assumed this already worked end-to-end via `compliancePackCodes[]`. It doesn't: `compositionEngine.compose()` calls only `profilesDB.getOptionalPackCodes(profileId)` (the original, flat `list_kind = 'optional'`) to gather a Profile's own contribution — it never calls `getPackSelection(profileId, 'technology'|'domain'|'compliance'|'integration')` for the four category-scoped fields §19.4 added, and `commissioning.ts` does no merging of its own before calling `compose()`. The same is true of `technologyPackCodes`/`domainPackCodes` — every one of the four category-scoped fields is fully round-tripped through authoring (validated, stored in `profile_packs` under its own `list_kind`, correctly re-displayed and inherited, §19.3/§19.4) but **silently ignored at commissioning**. Concretely: a Profile author selects a HIPAA Compliance Pack via `compliancePackCodes`, saves and publishes it — and it never reaches the composed EBM. §12's own model (Integration Packs specifically) and FR-7.6 are therefore satisfied only at the authoring layer, not the commissioning layer that's the whole point of a Profile (§1: "Profiles specify the variable parameters used when that blueprint is commissioned"). Owner, on being told: *"Log it for now"* — not fixed; `compose()` would need to also resolve and merge all four category-scoped list_kinds (with the same later-wins Override strategy already applied to `'optional'`) to close this.

**Refined 2026-09-05, in [CR-091](../../change-requests/CR-091-profile-structure-completion.md) Part 3 — Organisation Composition maps to `organisationPackCodes`, not `integrationPackCodes`.** Owner: *"organisation composition is implemented as organisation packs. so no specific implementation for a profile."* The 2026-08-19 correction above pointed at Integration Packs because that was the closest category Profile had at the time — Profile didn't get its own Organisation-category slot until CR-091 Part 1 added `organisationPackCodes` (closing the 4-of-6-categories gap). Now that it exists, §12's model maps onto it directly by name, not onto Integration Packs (a different Pack category, for third-party system integrations, not participating organisations). Confirms — again — that §12/FR-7.6 need no Profile-specific mechanism beyond the general category-scoped Pack-selection fields already built; the still-open part is unchanged: `compositionEngine.compose()` doesn't read `organisationPackCodes` either (same gap as the other three non-`optional` list_kinds, just above).

**Same audit pass, a related but smaller finding — FR-7.7 ("environment-specific configuration") is real as a field, not as behaviour.** `profiles.environment` is a required, real column — but grepped for every consumer: `compositionEngine.ts`/`commissioning.ts` never read it at all, and its only actual reader anywhere, `findOrCreateDefaultProfile` (`core/profiles.ts`), uses it purely to *pick* which existing Profile to default to (preferring one already tagged `"development"`) — never to vary what gets composed. The one place `environment` appears as a *concept* in a condition — `policies.condition`'s own illustrative comment in the original schema (`002_seu_platform.sql`: `{"type":"field_in","field":"profile.environment","values":["production"]}`) — was always just an example of a condition shape, never an implemented evaluator (Ch.24 §19.12's own "rich per-condition evaluation" gap, not a new one). FR-7.7 is accordingly in the same position as FR-7.5 (§19.5): declared, authored, required — never actually driving environment-specific commissioning behaviour.

### 19.8 ✅ Base Template reference — frozen, pinned by design (FR-7.1)

`profiles.base_template_id UUID NOT NULL REFERENCES templates(id)` and `ebms.profile_id UUID NOT NULL REFERENCES profiles(id)` (migration `002`) — FR-7.1 ("every commissioned SEU shall reference one Profile") is structurally guaranteed, not just conventionally followed. The Template reference itself is a frozen row id, resolved once at Profile-authoring time and never re-resolved — an explicit, discussed decision (CR-024: "Profile is unaffected... the owner chose pinning" over Pack's resolve-fresh-by-code model). Worth noting precisely: this makes Profile's relationship to Template *not* analogous to how Template/Profile resolve their own Pack references (`template_packs`/`profile_packs` store Pack **codes**, resolved fresh at every commissioning — Ch.6 §20.9) — Profile's own reference to its Template is the one place in this whole graph that's still pinned-by-id rather than resolved-by-code, a deliberate asymmetry, not an inconsistency.

### 19.9 ✅ Events — built, mirroring Template/Pack (§15)

~~None of the six are published anywhere... Profile's equivalent entry points... publish no event at all.~~

**Built 2026-08-19, same day — owner: "Fix 19.9 similar to what we did for pack and template."** `core/profiles.ts` gained the same `EVENT_BY_TARGET_STATE` map Pack/Template have (`Validated`/`Published`/`Active`/`Deprecated`/`Retired`/`Archived`, all real names — `ProfileArchived` included despite §15's own text naming only six, the same oversight-not-deliberate-omission treatment Ch.6 §20.10 gave Template's identical gap), and `transitionProfile`'s event publish reads from it instead of a hardcoded generic type. `ProfileCreated` now fires from `publishProfile` — closing the sharper gap this section found (Profile previously had no "Created" event at all, unlike Pack/Template) — mirroring `PackRegistered`/`TemplateCreated`'s exact placement and asymmetry (fires from the "proper" publish entry point, not from interactive authoring's `createAuthoringDraft`).

### 19.10 ✅ Profile Registry page built; API remains thin (§18 Deliverables)

~~Mirrors Ch.6 §20.12 exactly (no Template/Profile registry page)...~~

**Built 2026-08-19, same day — owner: "Build the template and profile registry. The different categories have to be separate tabs. Page registry also should change to be a tabbed one."** `/aisworg/seu/profiles` (and `/aisworg/seu/templates`, closing the Template half of Ch.6 §20.12 too) now exist — every Version of every Profile/Template, category tabs down the side (a shared `verticalTabs.ejs` component, also used to retab Pack's own pre-existing Registry the same way), the same generic transition form Pack's Registry already had. This is also the UI trigger §19.1/§19.2's reactivation mechanism otherwise had nowhere to run from — the same gap Ch.6 §20.3/CR-024 flagged as missing for Template, closed for both nouns by the same page. **`routes/seu/api/profiles.ts` is unchanged** — still a single, thin `POST /profiles` route wired to the throwaway-code path, not `publishProfile`; §18's "Profile APIs" deliverable is still satisfied only loosely (an API surface exists, not a complete one) — the Registry page reads through the core functions directly, not through this API.

### 19.11 Summary — what's tracked vs untracked

**Updated 2026-08-19, same day as this section's first pass.** Every gap this section originally found is now built, in one continuous pass, same day:

- **§19.2 Versioning/immutability** and **§19.3 Inheritance** — built together (Profile had neither foundation Template built incrementally across two CRs, so both landed in one migration/one pass here), the same identity model CR-024/CR-026 gave Template.
- **§19.4 Profile Structure** — all 14 §7 fields now real at the schema level, including un-collapsing the four category-scoped Pack-selection fields §19.7's correction explains the actual purpose of.
- **§19.6 Feature Selection** — built, Ontology-backed, alongside §19.4.
- **§19.7 Organisation Composition** — the *authoring* half turned out not to be a gap once corrected (§19.4's Integration Packs field is what §12 was actually asking for); **downgraded again 2026-09-05** once the *composition* half was checked directly — `compositionEngine.compose()` never reads Integration Packs (or the other three category-scoped fields) at all, only the original flat `optionalPackCodes`. Authored and inherited correctly; silently dropped at commissioning.
- **§19.9 Events** — built, mirroring CR-025's Template treatment exactly.
- **§19.10** — Profile Registry (and Template Registry) built; the API surface deliberately wasn't touched.

**Still open, correctly, and not part of what was asked**: §19.5's Configuration Parameters remains stored-but-inert (no substitution mechanism) — orthogonal to everything built this pass, since nothing above required reading `configParameters` to work. Worth a CR of its own if parameter substitution is ever wanted; not opened here.

**Updated 2026-09-05 — that CR was opened and half-built: [CR-088](../../change-requests/CR-088-template-profile-configurable-parameters.md), closed 2026-09-05.** Every Pack component type that can carry a configurable dimension now has one, defined and Template-side built (Service Level metrics, Policy's `constraintType`/applicability, Checklist's own new `configurableKey`/`configurableValue` tag — Capability/Review Gate/Quality Gate/Authority Rules all confirmed to need nothing new). §19.5's finding still holds exactly as written for **Profile's own side**: `configParameters` is still stored-but-inert, `compositionEngine`/`commissioning.ts` still read none of it, and Profile still has no field to supply a value/filter against whatever Template's new "Exposable Parameters" tab left checked. That remaining half — Profile's own consuming mechanism and the `compositionEngine` resolution — is CR-088's own explicit, named follow-up for whenever Profile itself gets its own design pass, not an unopened, unnamed gap any more.

**Corrected same pass, 2026-09-05 — CR-088's own "Pack Dependency needs nothing new, Profile's fields already cover it" conclusion was too confident; see §19.7's own downgrade above.** The category-scoped Profile fields *exist* and are the right authoring surface in principle, but `compositionEngine.compose()` doesn't read four of the five list_kinds that back them — so "Profile can already choose a HIPAA Compliance Pack" is only true up to Save/Publish, not through to an actual commissioned EBM. Logged, not fixed (owner: *"Log it for now"*) — CR-088 itself should be read alongside this correction rather than as the last word on Pack Dependency.

**Extended same pass, 2026-09-05 — [CR-091](../../change-requests/CR-091-profile-structure-completion.md): §5/§7 themselves had two undeclared items.** Reviewing §5 and §7 directly (not just this section's own prior audit of them) found Deployment Targets and Optional Capability Enablement had no field at all — see §19.4's own extension above for the full build (`deploymentTargets`, `additionalCapabilityCodes`, plus `engineeringPackCodes`/`organisationPackCodes` completing Profile's Pack-category coverage to all six). Same honest limitation as everything else in this section: none of the three new fields are read by `compositionEngine`/`commissioning.ts` either.

**CR-091 closed 2026-09-05, all three parts built.** Beyond the Part 1 fields above: §10 Configuration Parameters is now ten explicit, named fields (eight Ontology-backed `referential-select`, `participatingOrganisationCodes`, `environmentConfiguration`) replacing the inert `configParameters` blob §19.5 tracked — each backed by its own `profile-configuration`-cataloged concept type, with a new tenant-overridable `is_mandatory` flag deciding required-ness per parameter (not a fixed schema list). §8's `category` is retired from use entirely (Profile is "not supposed to be restrictive," owner) — the schema field, validation, and Registry grouping are gone; the `profiles.category` column and `profile-categories` Ontology rows are deliberately left in place, untouched. The Profile Registry (§19.10) now groups by base Template's code instead, labelled by whichever Template Version is currently Active for that code. "Participating Organisations" (§5) ended up split across two places: Organisation Composition itself needs nothing beyond `organisationPackCodes` (§19.7's own refinement), while a `participating-organisations` Configuration Parameter slot exists for future use, deliberately unseeded until multi-tenancy is designed.

**Seed-data fallout, found and fixed same day, checked directly rather than assumed.** Owner: *"have profile json files been updated? have test fixtures been updated? does clean-slate need changes?"* All 11 `*.profile.json` files carried a dead `configParameters: {}` key, cleaned up. More seriously: `seedSdlcStandardTemplates()` — the one real `db:clean-slate` step that creates Profiles (`cleanSlate.ts` step 8) — publishes 9 of them through `publishProfile()`, which runs the real `validateProfileSeed`, and none of those 9 `*.profile.json` files set `developmentMethodology`/`primaryProgrammingLanguage`/`sourceControlProvider` — the three fields just made mandatory on the Platform tenant. Undetected, this would have failed `db:clean-slate` outright on its first standard Template/Profile pair. Fixed: all 9 files given real values (`scrum`/`typescript`/`github`), and `seedSdlcStandardTemplates.ts`'s own `ProfileSeed` interface and `publishProfile()` call extended to actually forward them (they were being silently dropped even before this — that call site lists fields explicitly rather than spreading the loaded JSON). One test (`commission-profile-choice.test.ts`) had the identical exposure via its own direct `publishProfile()` calls, fixed the same way. `default-development.profile.json`/`ebook-library-development.profile.json` and every other Profile-creating test needed no change — all reach `profilesDB.upsert()` directly, never through `validateProfileSeed`.

**CR-088's Profile-side, built 2026-09-05, same day — the "Profile still has no field to supply a value" gap §569 above named no longer holds for its value-bearing half.** That deferral's own reason (this was Template-focused work, "to be picked up when Profile itself gets its own design pass") stopped applying the moment CR-091 opened as exactly that Profile design pass, but wasn't picked up there — a lapse, corrected once raised rather than left for a future CR. Owner: *"the overrides have to be saved in the profile."* Built: `exposedParameterOverrides` (migration 176) — a Profile's own overriding value for each Service Level metric/Policy `constraintType` its base Template flags overridable, derived fresh against the Template's own saved `exposedParameters` (`deriveOverridableParameterCandidates`, `core/templates.ts`), sparse by design (an omitted candidate keeps the Template's own value), its own "Parameter Overrides" tab. **Deliberately still out of scope**, same as §569 already flagged and CR-088 itself now records: the list/filter-shaped candidates (Policy applicability, Checklist `configurableKey`) have no value at all for Template itself to set, so there's nothing yet for a Profile to override there either — and, unchanged from every paragraph above, `compositionEngine`/`commissioning.ts` still reads none of this; the override is stored, not yet consumed.