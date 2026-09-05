# Chapter 6 – Template Model


[Sudha: 

I also think we've now finished the **architectural backbone**.

From this point onwards, we're specifying the objects that an SEU is composed of.

The next chapter should **not** be Templates.

I changed my mind after thinking about the last four chapters.

The sequence should be:

```
Architecture Catalogue

↓

SEU

↓

Engineering Behavior Model

↓

Composition Engine

↓

Pack Model

↓

Template Model

↓

Commissioning
```

Why?

Because **Templates** are the missing abstraction between Packs and a commissioned SEU.

A Pack contributes behaviour.

A Template defines **what kind of SEU you want to create**.

For example,

```
Enterprise Web Application

↓

Template

↓

Composition Engine

↓

EBM

↓

SEU
```

Without Templates, the Composition Engine doesn't know **what** it is composing for.

--------------------


While writing this chapter, I realised we need to be careful not to overload the Template concept.

At the moment, the Template is carrying three responsibilities:

1. **Structural blueprint** (SEU shape).
2. **Initial engineering artefacts** (deliverables, capabilities, lifecycle).
3. **Commissioning defaults** (mandatory/recommended packs, parameters).

I think (1) and (2) unquestionably belong in a Template. I'm less certain about (3).

There is another concept we discussed earlier but haven't formally introduced: the **Profile**.

I now think we should redefine Profiles.

Instead of using Profiles for engineering behaviour (which the EBM now covers), Profiles should become **commissioning configurations**.

For example:

```
Template
    +
Profile
    ↓
Composition Engine
    ↓
Engineering Behavior Model
    ↓
Commission SEU
```

A Template would answer:

> **"What kind of SEU is this?"**

A Profile would answer:

> **"How do you want to commission it today?"**

Examples:

- Startup Profile
- Enterprise Profile
- Healthcare Profile
- Production Profile
- Prototype Profile

The Profile would provide the variable inputs—organisation packs, technology choices, compliance selections, deployment targets—while the Template remains a stable structural blueprint.

I think this separation would keep Templates clean and make commissioning far more flexible. It also aligns with one of our recurring architectural principles: **separate stable structure from variable configuration**. Before we write the Commissioning chapter, I'd like us to decide whether we adopt this refined interpretation of Profiles, because it will influence the commissioning workflow substantially.

]
---

# 1. Purpose

A **Template** defines the blueprint for commissioning a Software Engineering Unit (SEU).

Templates describe **what an SEU is intended to achieve**, the engineering structure required to achieve those objectives, and the default engineering assets that should be available when the SEU is commissioned.

A Template does not prescribe engineering behaviour. Behaviour is supplied through the Engineering Behavior Model (EBM).

A Template defines **structure**.

The EBM defines **behaviour**.

---

# 2. Scope

This chapter defines:

- the Template abstraction;
- Template responsibilities;
- Template composition;
- Template inheritance;
- Template lifecycle;
- Template versioning.

This chapter does not define:

- Pack internals;
- Engineering behaviour;
- participant implementations;
- runtime execution.

---

# 3. Architectural Position

```
Template

        │

        ▼

Composition Engine

        │

        ▼

Engineering Behavior Model

        │

        ▼

Software Engineering Unit
```

Templates provide the structural definition used during commissioning.

---

# 4. Definition

A Template is a reusable specification describing the structural characteristics of an SEU.

Templates shall contain no runtime state.

Templates are reusable across multiple SEUs.

---

# 5. Responsibilities

A Template defines:

- SEU purpose;
- default capabilities;
- default roles;
- default deliverable catalogue;
- default lifecycle;
- default workflows;
- recommended Packs;
- mandatory Packs;
- commissioning parameters.

Templates shall not define engineering behaviour.

---

# 6. Functional Requirements

### FR-6.1

Every commissioned SEU shall originate from exactly one Template.

---

### FR-6.2

Templates shall be independently versioned.

---

### FR-6.3

Templates shall be reusable across multiple SEUs.

---

### FR-6.4

Templates shall support inheritance.

---

### FR-6.5

Templates shall declare mandatory and recommended Packs.

---

### FR-6.6

Templates shall define default deliverables.

---

### FR-6.7

Templates shall define the initial capability catalogue.

---

### FR-6.8

Templates shall remain immutable after publication.

---

# 7. Template Structure

Every Template shall define:

- Identifier
- Name
- ~~Description~~ *(struck 2026-08-19 — same as Purpose, per the Sudha review below; redundant now that `purpose` (CR-023) exists)*
- Version
- Purpose
- ~~Objectives~~ *(struck 2026-08-19 — per the Sudha review below: baking Objectives into a Template breaks its reusability across different Objectives, contradicting §11's own Template-matching logic, which depends on one Template serving many Objectives)*
- ~~Lifecycle~~ *(struck 2026-08-19 — per the Sudha review below: as the Template's own governance state this is already §15's job, not authored content; as a default Deliverable lifecycle it's wrong too — Deliverable state machines are governed platform-wide via transition_definitions, not authored per-Template)*
- Default Roles
- Default Capabilities
- Deliverable Catalogue
- ~~Recommended Packs~~ *(struck 2026-08-19 — see §20.5: resolved by Profile's `optionalPackCodes`, not a distinct Template field, the same way §20.8 already resolved Commissioning Parameters)*
- Mandatory Packs
- Default Workflows
- Commissioning Parameters

---

# 8. Template Categories

Examples include:

### Enterprise Web Application

---

### Mobile Application

---

### API Platform

---

### Legacy Modernisation

---

### Data Platform

---

### AI Platform

---

### Embedded Software

---

### SaaS Product

---

### Package Implementation

Additional categories may be introduced through Packs.

---

# 9. Template Inheritance

Templates may inherit from other Templates.

Example:

```
Enterprise Web Application

↓

Healthcare Web Application

↓

Healthcare Claims Platform
```

Derived Templates may:

- add capabilities;
- add deliverables;
- modify structure;
- declare additional mandatory Packs.

Derived Templates shall not modify parent Templates.

---

# 10. Deliverable Catalogue

Every Template defines a default catalogue of engineering deliverables.

Typical deliverables include:

- Requirements Specification
- Solution Architecture
- API Specification
- Source Code
- Test Suite
- Deployment Package
- Operational Documentation

The catalogue may be extended during commissioning.

---

# 11. Capability Catalogue

Templates define the capabilities expected within an SEU.

Examples:

- Requirements Analysis
- Architecture
- Development
- Testing
- Security
- Documentation
- Deployment
- Knowledge Management

Capabilities are placeholders.

Participants providing those capabilities are assigned during commissioning.

---

# 12. Workflow Definitions

Templates may define reference workflows.

Examples:

- Requirements Flow
- Development Flow
- Testing Flow
- Release Flow

These are structural workflow definitions.

Their behaviour is governed by the Engineering Behavior Model.

---

# 13. Commissioning Parameters

Templates may expose configurable parameters.

Examples:

- Development methodology
- Technology stack
- Target environment
- Domain selection
- Compliance requirements
- Organisation Packs

These parameters are supplied during commissioning.

---

# 14. Versioning

Templates shall be independently versioned.

Historical Templates shall remain available.

SEUs shall permanently reference the Template version from which they were commissioned.

---

# 15. Lifecycle

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

# 16. Events

The Template subsystem shall publish:

- TemplateCreated
- TemplateValidated
- TemplatePublished
- TemplateActivated
- TemplateDeprecated
- TemplateRetired

---

# 17. Non-Functional Requirements

Templates shall:

- be reusable;
- remain immutable after publication;
- support inheritance;
- support independent versioning;
- remain independent of runtime execution.

---

# 18. Acceptance Criteria

✓ Templates can be created.

✓ Templates can inherit from other Templates.

✓ Templates define structural characteristics.

✓ Templates declare mandatory Packs.

✓ Templates define deliverable catalogues.

✓ Templates support independent versioning.

---

# 19. Deliverables

Implementation of this chapter shall produce:

- Template domain model.
- Template registry.
- Template versioning service.
- Template inheritance model.
- Deliverable catalogue model.
~~- Capability catalogue model.~~
- Template APIs.
- Template lifecycle services.

---

# 20. Implementation Specifics

*Recorded 2026-08-18, reviewed again four times on 2026-08-19. This section documents how the Template Model is realised in the current build. It does not change the requirements above (FR-6.1–8, §§4–17); it records what is built, what is partial, and what is still open — the same convention as Chapter 5 §19. It also covers **Profile**, since the two are implemented as one authoring pipeline and Profile's actual shape directly answers this chapter's own open preamble question (Sudha's note, above) about what Profile should be. Status markers: ✅ built · ⚠️ partial · ***open*** not built. Corrections are marked in place with a date, not silently rewritten — §20.1, §20.4, and §20.7 carry 2026-08-19 updates from the second pass (§20.14 is new); §20.3 and §20.10 carry further 2026-08-19 updates from a third pass; §20.4 carries a further 2026-08-19 update from a fourth pass — each now built and each tracked by its own CR (024, 025, 026); §20.5 and §20.7 carry a fifth-pass 2026-08-19 update, narrowing/resolving fields against the Sudha review (§7) rather than a CR — see §20.15.*

## 20.1 ✅ Template and Profile are entity-direct authored, sharing Pack's pipeline — (§7; mirrors Ch.5 §19.11)

Template and Profile are two of the three entity-direct-authored kinds (`schema_definitions` entity kinds `Template`/`Profile`, alongside `Pack` — the `/aisworg/seu/sdk/{template,profile}-authoring` surfaces). Authoring is entity-direct: a Draft row of the entity itself (`templatesDB.createDraft` / `profilesDB.createDraft`), edited in place, materialised and driven through a governed `Draft → Active` transition under the real session actor (`publishTemplateDraft` / `publishProfileDraft` → `transitionTemplate` / `transitionProfile`), gated on that entity's own noun × verb badge (`template_publish` / `profile_publish`). Same authoring badges, same per-verb tab machinery (`buildAuthoringTabs`, generic over `SchemaDefinitionEntityKind`), same Queue-tab fix (2026-08-18) as Pack — no Template/Profile-specific authoring code exists.

**Inconsistency vs Pack (CR-015) — *resolved 2026-08-19, but not in the direction this originally predicted.*** The original claim here (Template's and Profile's `code` were hand-typed strings, unlike Pack's minted UUID) is stale twice over. First, an earlier pass (this build, 2026-08-18) made Template's and Profile's `code` *system-minted UUIDs too* — hidden from the form entirely, mirroring Pack's CR-015 treatment exactly (migration `045`). Then CR-020/021 (Ch.18 Ontology) reversed that for **Pack and Template both**: `code` is now a required `referential-select` rooted in an Ontology concept type — Pack's in `capability-name` (CR-020 Part 2), Template's in `template-categories` (CR-021) — never hand-typed, never an opaque UUID either. **Profile is now the actual outlier**: its `code` is still a hidden, system-minted UUID (migration `045`, untouched by CR-021 — "Profile is UNCHANGED... its `code` stays a system UUID until/unless the same decision is made for it separately"). See §20.14 for what rooting `code` in Ontology actually entails for Template specifically, including a real, currently-open consequence for §9 Inheritance and multi-tenant ownership.

## 20.2 ✅ Lifecycle: the full seven-state chain is now built, mirroring Pack exactly — (§15; closes the FR-6.8 caveat this section previously raised)

*Corrected 2026-08-18 (owner caught an overstatement in the first pass of this section, recorded rather than silently fixed) — then built the same day, owner's request ("Add the required transitions for both template and profile in the seed").*

`templates.status` / `profiles.status` carry the full seven-state CHECK (`Draft, Validated, Published, Active, Deprecated, Retired, Archived`, migration `002`), same enum as Pack. `transitionDefinitions.json` and `authorityVocabulary.json` now seed the same six-hop chain Pack has for both nouns — `Draft → Validated → Published → Active → Deprecated → Retired → Archived`, verbs `validate/publish/activate/deprecate/retire/archive` — a pure data addition, exactly as this section originally argued (`transitionEngine.evaluate` needed zero new code, being already generic over `(entityType, fromState, toState)`).

**The two small pieces of calling code this section flagged as still missing were also built, not left open:**
1. `advanceTemplateOneStep` / `advanceProfileOneStep` (`core/templates.ts` / `core/profiles.ts`) — direct mirrors of Pack's `advancePackOneStep`, a hardcoded `AUTHORING_NEXT_STATE` map advancing exactly the next hop off current status. `publishAuthoringDraft` (`core/sdkAuthoring.ts`) now gates full validation + one-time content materialisation (`materialiseTemplateDraft`/`materialiseProfileDraft`, replacing the old `publishTemplateDraft`/`publishProfileDraft`'s hardcoded jump to `"Active"`) on the first hop out of Draft only, same discipline as the Pack branch beside it. Verified over real HTTP: `template-all@athens.com` now sees the full 13-tab structure (Draft + 6× Queue/History pairs + Active) identical in shape to Pack's, and walking a real Draft to Active takes exactly 3 `publish` clicks (Draft→Validated→Published→Active), landing on the Registry redirect only once truly Active.
2. Also fixed in the same pass: `listAuthoringQueue`'s Template/Profile branches (§Ch.5-adjacent "Queue tabs" feature) assumed the only queueable `fromState` was `Draft` (`templatesDB.findDrafts`, hardcoded to `status IN ('Draft','Validated')`) — true before this change, silently wrong after it (a `Published`/`Active`/`Deprecated`/`Retired` queue would always render empty). Added `templatesDB.findByStatus` / `profilesDB.findByStatus` (unscoped — neither noun has Pack's tenant-ownership model) and rewired the Queue lookup to use them.
3. The fixture users this chapter's authoring surfaces are tested through (`template-all@athens.com`, `profile-all@athens.com`, and their eight per-verb siblings each) were *also* found stale: `seedIdentityBaseline.ts`'s `AUTHORING_VERBS` was a hardcoded `["define", "publish"]` shared by all three SDK-authored nouns (Template/Profile/TransitionDefinition) — correct back when Template/Profile only had one hop, silently wrong the moment they gained six more. Fixed the same way `packVerbs()` already avoids this for Pack: a new `entityLifecycleVerbs(entityType)` derives each noun's verb list from the vocabulary live, so `template-all@`/`profile-all@` now hold all 7 badges (was 2) and each of the 5 new per-verb accounts (`template-validate@`, `template-activate@`, …) now exists. TransitionDefinition is untouched (still genuinely only `define`/`publish` — CR-019, its own authoring path).

**Still open, correctly, and not part of what was asked:** no Template/Profile equivalent of Pack's Registry page + `POST /packs/:id/transition` route exists for an *admin* (as opposed to the authoring pipeline) to drive post-Active governance directly — see §20.12. Inheritance (§20.4) was unaffected by this change and remains open. *(Versioning/immutability, §20.3, was also open at the time this was written — since built, CR-024. Inheritance itself — since built too, CR-026; see §20.4.)*

## 20.3 ✅ Versioning and immutability — built (FR-6.2, FR-6.8, §14; CR-024)

*Original gap description, kept for the record:* `templates.template_version INTEGER NOT NULL DEFAULT 1` existed as a column but no code path in `templatesDB.ts` ever read or incremented it — it was permanently `1`. Both `templatesDB.upsert` and `profilesDB.upsert` were `INSERT ... ON CONFLICT (code) DO UPDATE` — publishing again under the same `code` **overwrote the existing row in place**. This directly contradicted FR-6.8 ("Templates shall remain immutable after publication") and FR-6.2/§14 ("independently versioned... SEUs shall permanently reference the Template version from which they were commissioned"): there was no `(code, version)` identity the way Pack has (`010_pack_lifecycle.sql`, Ch.5 §12), so a Template that already had SEUs commissioned from it could be silently mutated by republishing the same code.

**Updated 2026-08-19 — CR-021 raised the stakes on this gap without closing it.** Before CR-021, `code` was a freely hand-typed slug — an author could always sidestep the missing versioning by simply picking a new `code` for what was conceptually a new version (informally, not structurally). Once `code` became rooted in the small, curated `template-categories` Ontology vocabulary (§20.1, §20.14), that escape hatch mostly disappeared: a new Template under the *same* category collided outright, so "just pick a different code" stopped being a workable substitute for real versioning.

**Built 2026-08-19 — CR-024, mirroring Pack exactly.** `template_version` is now a semver `TEXT` column (was an unused `INTEGER`); uniqueness is `(code, template_version)` (`templates_code_version_key`, mirroring `packs_code_version_key`), not `code` alone. `templatesDB` gained `findByCodeAndVersion`/`findActiveByCode`; `core/templates.ts` gained `reactivateAsNewVersion`/`nextAvailablePatchVersion` and a terminal-state-reactivation branch in `transitionTemplate` — a direct structural mirror of `core/packs.ts`'s own versioning machinery: deprecating an Active Template and transitioning it back to Active never resurrects the old row, it publishes a genuinely new Version carrying the same content, and supersedes (deprecates) whatever else was Active for that code. A real, adjacent seed-data gap surfaced and fixed along the way: `transitionDefinitions.json` never had the three reactivation edges into `Active` (`Deprecated`/`Retired`/`Archived → Active`) for Template that Pack has always had — without them the reactivation transition was refused outright by `transitionEngine`, before any of the new logic could run.

**Still open, deliberately:** no UI trigger for reactivation exists — Pack's own lives on its dedicated Registry page (§20.12), which Template doesn't have. The mechanism itself is built and directly verified; nothing on the authoring surface currently calls it with `targetState: "Active"` from a terminal row. See CR-024 for the full build record.

## 20.4 ✅ Inheritance — built, Option A: tenant-scoped same-code inheritance, not §9's literal multi-generation chain (FR-6.4, §9; CR-026)

`templates.parent_template_id UUID REFERENCES templates(id)` exists (migration `002`, comment: *"inheritance (Ch.6 §9) — column present, unused by MVP seed data"*). Nothing in the codebase reads or writes it — no authoring field exposes it, no code derives a child Template's capabilities/deliverables/mandatory-Packs from a parent, no code prevents a "derived Template" from doing what §9 forbids (there's no derivation to forbid). §9's whole model — "Enterprise Web Application → Healthcare Web Application → Healthcare Claims Platform," add-only derivation, parent immutability — is unbuilt. **No CR is open for this.**

**Updated 2026-08-19 — a design conversation (CR-021/022) worked through what §9 would actually require, without building it.** Two findings worth recording precisely, since they change what "build inheritance" would mean going forward:

1. **§9's own model is incompatible with `code` = category, as CR-021 built it, unless `parent_template_id` is real.** §9's chain — `Enterprise Web Application → Healthcare Web Application → Healthcare Claims Platform` — needs each generation to be its *own* identity, distinct from its parent's; `Healthcare Web Application` isn't a `template-categories` value and structurally never will be (the whole point of that concept type is a small set of *root* categories, not an open product-name vocabulary). §9's explicit rule ("Derived Templates shall not modify parent Templates") only makes sense if the parent stays untouched and a genuinely separate row is created — never an edit landing on the same row. Nothing about CR-021 built this; it only confirmed the identity model doesn't accidentally satisfy it either.
2. **A *lighter* form of the same intent — "start from what the platform offers, then make it your own" — is reachable today, cheaply, without `parent_template_id` at all**: since `template-categories` is an open, Ontology-CRUD-managed vocabulary (§20.14), a tenant needing a genuinely new category can add one (`healthcare-web-application`) and author a Template against it — same spirit as §8's own closing line ("additional categories may be introduced through Packs"), just via a tenant with `ontology_define` instead of a Pack. This is real *identity* provisioning, not inheritance in §9's sense (no parent link, no "add-only" constraint, no shared lineage) — worth naming as a distinct, already-open door, not a substitute for building §9 properly.
3. **A concrete blocker surfaced and *not* resolved: `templates` has no `tenant_id`.** Ontology concepts got tenant ownership in CR-022 (`ontology_concepts.tenant_id`, Platform-shared + per-tenant vocabulary) specifically so two tenants' own additions don't collide. `templates.code` itself has no equivalent — even after CR-024 gave Template real `(code, template_version)` identity (§20.3), that pair is still a single, global `UNIQUE` constraint with no tenant dimension, so two *different* tenants both wanting their own "Healthcare Web Application" Template at the same version would still collide outright. Extending Template with a `tenant_id` column, mirroring Pack's (migration `044`) and now Ontology's (CR-022), was discussed as the necessary next piece and explicitly **not built** — scoped out of both CR-022 (Ontology only) and CR-024 (versioning only). **No CR is open for this either.**

**No CR is open for any of the three items above.** *(Was true when written; all three are now closed, CR-026 — see below.)*

**Corrected 2026-08-19, CR-026 — all three items above are now built, by the route the second finding above pointed at, not the multi-generation chain the first finding said `code` = category couldn't support.** `templates.tenant_id` (item 3) is real now, mirroring `packs.tenant_id` exactly — migration `062`, `UNIQUE(code, template_version, tenant_id)` replacing CR-024's `UNIQUE(code, template_version)`. `parent_template_id` (item 1's blocker) is wired: a `new`-draft Template form shown to a real Tenant author (never Platform — "no change to the way template is created by a platform user") offers a dropdown of every Active Template visible to that tenant (Platform's + their own), and an "Inherit" button that pre-fills a fresh Draft from the chosen parent's real content. The identity model is the one item 1 flagged as unavailable without a real `parent_template_id` — and, now that one exists, the owner chose the simpler resolution over §9's literal chain: a Derived Template keeps the **same `code`** as its parent, disambiguated by `tenant_id`, not a new category value (`Healthcare Web Application` still isn't reachable, and still doesn't need to be — item 2's "lighter form," a tenant adding their own root category via Ontology CRUD, remains the way to do that instead). Only §9's mandatory-Packs rule is enforced as a real validator (superset of the parent's current mandatory set, checked at publish); the code lock is enforced server-side, not just by the UI, so an inherited Draft's identity can't drift from its parent's. See CR-026 for the full build, including the same fix applied to a byte-for-byte identical latent gap in Pack's own `(code, packVersion)` uniqueness.

## 20.5 ✅ Mandatory Packs built; Recommended Packs resolved by Profile, not a Template gap — (FR-6.5, §7)

`template_packs` (keyed by Pack **code**, not a frozen row id — §20.9) holds the Template's mandatory set, authored via a structured `mandatoryPackCodes` referential-list, and is what `compositionEngine` actually composes (Ch.5 §19.7). §7's **Recommended Packs** field has no equivalent anywhere — no column, no join table, no grammar property. (Not to be confused with Pack's own `installation_classification` enum, which includes a `Recommended` value at the *Pack* level, Ch.5 §7 — that is a different axis: "how this Pack classifies itself," not "which Packs does this Template recommend.")

**Corrected 2026-08-19 — this is the same shape of finding as §20.8's Commissioning Parameters, not a separate build gap.** Nothing in `compositionEngine`, the authoring form, or anywhere else reads a Template-level "recommended" list — Profile's `optionalPackCodes` already **is** "which Packs get added optionally," entered at the point it actually matters (per-instance commissioning), not at Template-authoring time. Mechanically, the field is redundant: there is nothing a Template-level Recommended Packs list would let a Profile author do that they can't already do by typing an optional Pack code directly. The one thing it would add that doesn't exist today is a **curated menu** — the Template author suggesting which optional Packs make sense for this kind of SEU, so a Profile author isn't choosing blind from the entire registry. That's a real, distinct idea (category-level curation vs. instance-level selection), genuinely unbuilt, and nothing currently depends on it — a Profile-authoring UX improvement to consider later, not a missing Template field. Struck from §7's field list accordingly.

## 20.6 ✅ Deliverable Catalogue and Capability Catalogue are materialised at commissioning — (FR-6.6/6.7, §10/§11)

Both are real, not just declared. At commissioning (`commissioning.ts`), `templatesDB.getRequiredCapabilities` seeds the SEU's Capability set (`seuCapabilitiesDB.createMany`), and every `deliverable_catalogue` entry becomes a real `deliverables` row, with `producingCapabilityCode` resolved to the just-created Capability and `dependsOnDeliverableCodes` / `dependsOnCapabilityServiceCodes` wired into real Dependency Graph edges (`dependencyEdgesDB.createDeliverableEdge` / `createCapabilityEdge`). §11's "Capabilities are placeholders; Participants... assigned during commissioning" is exactly what happens — the Template supplies the shape, `fulfilCapability` (Ch.12) supplies the Participant, separately.

**Caveat:** both fields are still raw-JSON on the authoring form (`x-widget: "json"` in the grammar, `015_sdk_authoring_template_profile.sql`) — unlike Pack's contributions, which CR-016 gave individual structured item fields. Authoring a Template's deliverable catalogue today means hand-writing a JSON array, not filling in rows.

## 20.7 ***open*** Default Roles, Workflow Definitions — (§7, §12)

**Narrowed 2026-08-19 — this section used to also cover Purpose, Objectives, and Template Categories; all three are now resolved, not open, and have been moved out of this section.** Purpose is built (CR-023) and Template Categories is built (CR-021) — see §20.14 for both. Objectives was resolved differently: removed from §7's Template field list entirely, per the Sudha review (§7, above) — a Template is meant to be matched against many different Objectives (§11's `findCandidateTemplates`), so a Template also declaring its own fixed Objectives would work against the reusability that matching logic depends on; this isn't a "not built yet" gap, it's a field that shouldn't exist. What's left below is genuinely still open — no field, no table, and no decision yet on whether either belongs at all.

- **Default Roles** (§7) — no field, no table. (Distinct from Capabilities, which *are* modeled — §11 already separates "placeholder ability" from "who fills it.") Uncertain, not confirmed either way: Role may be a genuinely distinct layer (Service delivered through an accountable Role, Role fulfilled by a Participant) sitting between Capability and Participant — or it may not — unconfirmed against Ch.11 (Service).
- **Workflow Definitions** (§12) — no field, no table. Reference workflows ("Requirements Flow," "Release Flow") are not represented; only the EBM's own governed lifecycle exists at runtime. Likely redundant with the Deliverable Catalogue's dependency graph (§20.6) — the same ordering information under a different name — but not yet confirmed as removable either.

## 20.8 Commissioning Parameters live on Profile, not Template — resolves this chapter's own open question (§13; the Sudha preamble)

The chapter's own preamble (top of this file) raises an explicit, unresolved design question: whether "commissioning defaults" belong on Template at all, and proposes redefining **Profile** as the answer — *"A Template would answer 'what kind of SEU is this?' A Profile would answer 'how do you want to commission it today?'"* **The implementation already made this call.** `profiles.config_parameters` (JSONB, "meaning owned by the consuming Pack — Ch.7 §10, not by Profile itself") is where configuration lives; `templates` has no commissioning-parameters field at all, and §13's own list (development methodology, technology stack, target environment, domain selection, compliance requirements, organisation Packs) maps cleanly onto Profile's `environment` + `configParameters` + `optionalPackCodes`, not onto anything Template carries. **The normative spec text (§5, §7, §13) still lists "commissioning parameters" as a Template responsibility — it has not been updated to reflect that the build already resolved the preamble's open question in Profile's favour.** This is a documentation gap, not a code gap: the fix is editorial (update §5/§7/§13, formally introduce Profile as its own numbered section), not implementation work.

Separately, real Profiles are actually reachable from commissioning, which was itself a bug: both commissioning paths used to synthesize a brand-new throwaway Profile (`profile-<timestamp>-<random>`) every time, so a hand-authored Profile (declaring real `optionalPackCodes`/`configParameters`) was created but never used. Fixed — `findOrCreateDefaultProfile` now prefers a real, already-Active Profile for the Template if one exists; `commissionFromExistingObjective`'s web route additionally offers a live picker (`listRealProfilesForTemplate`) when more than one exists, rather than a heuristic silently choosing. `commissionFromForm`'s one-shot path still has no picker seam and falls through to the default-or-synthesize behaviour.

## 20.9 ✅ Pack references resolve by code, not a frozen row id — bug fix (migration `013`)

`template_packs` / `profile_packs` originally stored a specific Pack **row id** (`pack_id`), resolved once at authoring time. Once that pinned row became terminal (Archived) and a newer Version of the same code was published Active, the Template/Profile kept pointing at the dead row — the Pack silently vanished from every future commissioning with no newer Version substituted. Migration `013` changed both join tables to store the Pack's **`code`** instead; `compositionEngine` resolves the code to whichever Version is Active *at commissioning time* (`packsDB.findActiveByCode`), so a newly Active Version is picked up automatically, with zero action from the Template/Profile author. Already-commissioned SEUs are unaffected either way — an EBM's `composedPacks` is a permanent snapshot, never re-resolved after the fact.

## 20.10 ✅ ⚠️ Events — built for Template (§16; CR-025) · Profile still generic-only

*Original gap description, kept for the record:* §16 specifies `TemplateCreated / TemplateValidated / TemplatePublished / TemplateActivated / TemplateDeprecated / TemplateRetired`. The build published exactly one generic event per hop instead: `TemplateTransitioned` (`transitionTemplate`) / `ProfileTransitioned` (`transitionProfile`), payload `{ fromState, toState, code }`. Contrast with Pack, which has always published real per-state-named events via an explicit `EVENT_BY_TARGET_STATE` lookup (`PackRegistered`/`PackValidated`/`PackPublished`/.../`PackArchived`, Ch.5 §19.9) — Template/Profile never got the equivalent map. Functionally the generic event carried the same information (any consumer can switch on `toState`), so this was a naming/enumeration gap, not a missing capability.

**Built 2026-08-19 — CR-025, mirroring Pack exactly, Template only.** `core/templates.ts` gained the same `EVENT_BY_TARGET_STATE` shape Pack has (`Validated`/`Published`/`Active`/`Deprecated`/`Retired`/`Archived`, all real names), and `transitionTemplate`'s event publish reads from it instead of hardcoding `"TemplateTransitioned"`. `TemplateCreated` was added to `publishTemplate` (the seed/CLI entry point), mirroring `PackRegistered`'s placement in `createPackDraft` — including the same asymmetry: it does not fire from interactive authoring's `createAuthoringDraft`, because `PackRegistered` doesn't either. `TemplateArchived` was included even though §16's own text names only six events, not seven — treated as an oversight in the original spec text (Ch.5 §16 names all seven of Pack's), not a deliberate omission to preserve; see CR-025 for the full reasoning.

**Profile is unaffected** — `ProfileTransitioned` stays generic. The owner's CR-025 ask was Template-specific ("similar to what is on pack," addressing §20.10 as it applies to Template); Profile's own equivalent gap remains open, untracked by any CR.

## 20.11 ✅ Template/Profile authority — badge-based (noun × verb), no entity-specific code — (mirrors Ch.5 §19.13)

Same model as Pack, zero Template/Profile-specific authorisation code: `transitionTemplate`/`transitionProfile` call `transitionEngine.evaluate({ entityType: "Template" | "Profile", ... })`, which derives `requiredBadge = template_<verb>` / `profile_<verb>` and asks `badgeAuthorityEngine.authorise` — root bypass, or the actor holds that Active badge, actor + badge captured on the published event. Because each noun only has the one `publish` hop (§20.2), there is no separation-of-duties ladder to speak of yet the way Pack has seven — a `template_define` holder and a `template_publish` holder are the only two roles that can exist for a Template today.

## 20.12 No Template/Profile registry page — minor asymmetry vs Pack

Pack has a dedicated, unauthenticated-within-session Registry page (`/aisworg/seu/packs`, Ch.5 §19) listing every Version of every Pack. Template and Profile have no equivalent — the only way to browse them is the SDK authoring surface's own per-verb tabs (`/aisworg/seu/sdk/template-authoring`, `/aisworg/seu/sdk/profile-authoring`), which (per this chapter's own Queue-tab fix) show "what I authored/queued/published," not "the full catalogue." Not a stated requirement of this chapter, but worth naming as an inconsistency in what's browsable platform-wide.

## 20.14 ✅ Template identity rooted in Ontology (Ch.18) — partial (CR-020 Part 2 / CR-021 / CR-022)

*Added 2026-08-19.* Not part of this chapter's original build; recorded here because it directly changes §20.1 and §20.7 and reopens §20.4 in a specific way.

Chapter 18's Ontology Model — a canonical, tenant-extensible vocabulary registry, built independently of this chapter — has become the mechanism this chapter's own gaps (§8 categories, §20.1's identity inconsistency) get closed through, rather than bespoke Template fields:
- **`template-categories`** (CR-021) is a real Ontology concept type, seeded with §8's 9 examples, and it *is* Template's `code` (§20.1, §20.7) — a `referential-select` schema field marked `x-ontology: true`, resolved generically by the same mechanism Pack's `code`/`category`/`installationClassification` use (CR-020 Part 2's `ontologyConceptTypesIn`/`loadOntologyOptions` — one schema-driven resolver for any kind, not per-field code).
- **The vocabulary is open**, not fixed at 9 forever: a new category is an Ontology Management data change (`/aisworg/seu/sdk/ontology`), never a schema or code change — consistent with §8's own closing line, "additional categories may be introduced through Packs," just generalised to "or through Ontology Management."
- **As of CR-022, that vocabulary is tenant-scoped**: Platform's 9 categories are canonical and visible to every tenant; a tenant holding the `ontology_define` badge can add their own (their own tenant's vocabulary only, never Platform's). This is what makes a tenant genuinely able to introduce, say, `healthcare-web-application` without asking a root admin.
- ~~**What this does *not* give Template**: the vocabulary concept can be tenant-owned; the `templates` table itself still cannot be (§20.4) — no `tenant_id` column exists on `templates`, so two tenants each wanting their own Template under the *same* category (theirs or Platform's) still collide on the single global `templates.code UNIQUE` constraint. Ontology solved this exact problem for concepts (CR-022); Template rows themselves don't have it yet.~~ **Corrected 2026-08-19, CR-026 — `templates.tenant_id` now exists**, mirroring `packs.tenant_id`; the collision this described no longer happens (`UNIQUE(code, template_version, tenant_id)`, migration `062`). See §20.4.

Net: §8 (Template Categories) is built. The identity/versioning/inheritance/ownership gaps this surfaced (§20.3, §20.4) are sharper and better-understood than before, not resolved by it. *(§20.3 specifically — versioning — was resolved later the same day, CR-024; see §20.3 and §20.15. Inheritance and the `tenant_id` ownership gap — also resolved the same day, CR-026; see §20.4.)*

**Extended 2026-08-19 (CR-023) — the same Ontology concepts now carry a `description` (generic column, any concept type), and Template's `purpose` field (§20.7) is where it surfaces**, closing the loop the chapter's own §8 gestures at ("Template for creating software for a web application that has enterprise wide impact; use this when...", one real sentence per category, not just a name). Concretely: `code`'s selected `template-categories` option supplies the *default* `purpose` text at Draft creation (never overwriting an author's own edit, on create or later save); the same description shows live under the category dropdown as the author picks (`.ontology-select` / `data-description`, `_generatedFieldGroups.ejs` + `edit.ejs`'s script) — generic over any future `x-ontology` field the same way, not special-cased to Template. This is descriptive guidance only, not enforcement: an author can still pick a category and write an unrelated `purpose`; nothing checks the two agree.

## 20.15 Summary — what's tracked vs untracked

§20.2 (lifecycle) was built 2026-08-18 (owner's request), so it's no longer a gap. §8 (Template Categories, §20.7) is now built, via CR-021/CR-022 (Ch.18 Ontology), and §20.1's original code-identity inconsistency is resolved — differently than either original section predicted: Template converged *with* Pack (both now Ontology-rooted `code`), not with Profile (still a hidden UUID), which is now the actual outlier. Purpose (§5, §7) is now built too, via CR-023 — a required free-text field, pre-filled from the chosen category's Ontology guidance and shown as a title subtext. Objectives (the other half of that same original open item) was resolved differently, the same day — removed from §7's Template field list entirely, not built, per the Sudha review (§7) — see §20.7's narrowed scope. **§20.3 Versioning/immutability and §20.10 Events (Template's half) are now both built too, via CR-024 and CR-025 — the two gaps this section itself flagged as "no CR is open for this," closed the same day, both by mirroring Pack directly. §20.4 Inheritance is now built too, via CR-026 (same day again) — not §9's literal multi-generation chain, but the tenant-scoped same-code model the owner chose once `parent_template_id` and `tenant_id` were both real; the same CR also closed a byte-for-byte identical latent gap in Pack's own `(code, packVersion)` uniqueness, found while building Template's.**

**§20.5 Recommended Packs is resolved too, editorially — corrected 2026-08-19 alongside the fourth pass above.** Not a build gap at all: Profile's `optionalPackCodes` already covers it (the same resolution §20.8 already gave Commissioning Parameters), so the field was struck from §7 rather than left as something to eventually build.

Every remaining gap is still **not tracked by any Change Request**:
- **§20.7 — Default Roles and Workflow Definitions** — unchanged, still genuinely open, unaffected by the Ontology or versioning work. (Purpose and Template Categories are built; Objectives was removed from §7 entirely rather than built — none of the three are "remaining" any more, and §20.7 was narrowed to just the two still-open items.)
- **§20.10 Events, Profile's half** — `ProfileTransitioned` stays generic; CR-025 was scoped to Template only, per the owner's own framing of the ask.
- **A new, small gap CR-024 itself surfaced**: no UI trigger exists anywhere for Template reactivation (the mechanism is built and directly verified; nothing on the authoring surface calls it) — the same underlying asymmetry §20.12 already names (no Template Registry page, unlike Pack's, which is where *its* reactivation trigger lives).

Contrast Pack, which has CR-015/016/017/018/020/021 covering its own equivalent gaps in detail. If any of Template's remaining gaps are worth scheduling, the next step is opening one or more CRs against this chapter, per the working convention (`design/Change Requests.md`) — not done here, since none was asked for.


[Sudha: Going through all fourteen fields in Section 7 against everything we've established:

Remove — Objectives. Already confirmed: Ch.1 has the Objective exist independently and drive Template selection, not the reverse. Baking objectives into the Template breaks its reusability across different objectives.

Remove — Description. Same as Purpose

Remove — Lifecycle. This one's ambiguous between two readings, and both are wrong for a Template-content field. If it means the Template's own governance state (Draft→Published→Active…), that's already §15's job, not something the Template "defines" as content. If it means a default lifecycle for the Deliverables it produces, that's wrong on a deeper level — Deliverable state machines are governed platform-wide via transition_definitions, not authored per-Template. Either reading, it doesn't belong in §7.

Flag as likely redundant — Default Workflows. §12's own examples ("Requirements Flow," "Development Flow," "Testing Flow," "Release Flow") look like the same information as the Deliverable Catalogue's dependency graph, just named differently. We already established the dependency graph is what creates ordering — a separate "Workflow" concept saying the same thing under another name is a real candidate for the same kind of duplication we caught with code/name and mapping/Ontology. Worth checking whether it says anything the dependency edges don't before keeping it.

Uncertain — Default Roles. I don't have enough grounding to call this one confidently. Role may be a genuinely distinct layer (Service delivered through an accountable Role, Role fulfilled by a Participant) sitting between Capability and Participant, not simply a duplicate of Capabilities — but I haven't read Ch.11 (Service) in this conversation to confirm that chain holds here. I'd rather flag this honestly than guess.

Keep, no issue: Identifier, Name, Version, Default Capabilities, Deliverable Catalogue, Mandatory Packs, Commissioning Parameters — all consistent with everything we've built.

So the confident cut is three: Objectives, Description, Lifecycle. Default Workflows is a strong "probably," Default Roles needs Ch.11 before I'd commit either way. Want me to check Ch.11 before you decide on Roles, or record the three confirmed removals now?]

**Resolved 2026-08-19.** Objectives, Description, and Lifecycle are confirmed removed and struck from §7 above (the closing line just above originally read "Objectives, Purpose, Lifecycle" — a slip; Purpose stays, Description is the third). A fourth field, **Recommended Packs**, is removed too — not part of this note's original fourteen-field review, but settled the same day via §20.5: resolved by Profile's `optionalPackCodes`, the same way §20.8 already resolved Commissioning Parameters, not a Template gap to eventually fill. Workflow Definitions and Default Roles are unchanged — still "likely redundant" and "uncertain, needs Ch.11" respectively, neither confirmed either way yet.