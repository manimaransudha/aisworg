# SDK / Authoring UI Layer — Plan

*Which authoring surfaces currently have no UI, what Book 3 says each one's fields should be, and what's actually implemented today. Scoped deliberately to "build the UI for what is present as-is" per Sudha's instruction — every field list below is split into **Implemented now** (build UI for this) and **Chapter-specified, not yet implemented** (reference only, do not build UI for these until the underlying schema/logic exists). Sudha has more questions on this before it's final.*

## Why more than just Pack SDK

Pack SDK was the explicit ask, but it's not the only authoring surface with no UI — and it's arguably not the most urgent one. Ordered by how much tooling already exists (least first, since that's the biggest gap):

1. **Template** — no CLI, no UI. Nothing but hand-edited JSON consumed by a seed script.
2. **Profile** — same: no CLI, no UI.
3. **Transition Definition** — same: no CLI, no UI, and it's the lowest-level of the four (declares the Authority/Policy/Quality-Gate wiring every other transition depends on).
4. **Pack** — has a CLI (`pnpm pack:validate` / `pnpm pack:publish`), just no UI or JSON-import affordance yet. The most-built of the four.

## 1. Pack

**Book 3 grounding:** Ch.5 (Pack Model), §8 Pack Metadata, §9 Pack Contributions, §10 Pack Dependencies, §11 Pack Lifecycle.

**Implemented now** (`PackSeedInput`, `src/routes/seu/core/packs.ts`):
- `code`, `name`, `category` (`Platform | Organisation | Domain | Compliance | Technology | Integration`), `packVersion` (semver), `installationClassification` (`Mandatory | Recommended | Optional | Conditional`)
- `dependencies[]`: `packCode`, `version`, `type` (`required` only, currently)
- `contributions.capabilities[]`: `code`, `name`, `description`, `category`
- `contributions.services[]`: `code`, `capabilityCode`, `name`, `contractDescription`, `serviceLevel`
- `contributions.authorityRules[]`: `code`, `governedTransition`, `authorisedRole`
- `contributions.policies[]`: `code`, `name`, `category`, `constraintType` (`Policy | Standard`), `governedTransition`, `condition`, `severity`
- `contributions.qualityGates[]`: `code`, `name`, `category`, `entityType`, `fromState`, `toState`, `criteria`
- Lifecycle (system-managed, not authored): `Draft → Validated → Published → Active → Deprecated → Retired → Archived`

**Chapter-specified, not yet implemented** (§8): Description, Owner, Publisher, Composition Strategy, Supported Platform Version. (§9, contribution types not yet real): Behaviour, Decision Rules, Ontology, Knowledge Assets, User Interface Components, Templates-as-contributions, Checklists, Review Gates, Obligation Definitions, Metrics. (§10): dependency types `Optional`/`Conditional`/`Incompatible` — only `required` exists today.

**UI shape:**
- **Registry** (exists, `/aisworg/seu/packs`) — keep, it's already real.
- **New: Create/Publish screen.** Two entry points into the same `validatePackSeed`/`publishPack` pipeline the CLI already uses:
  - **Form path**: one section per contribution type (Capabilities, Services, Authority Rules, Policies, Quality Gates), add/remove rows, client-side mirrors the same validation rules as `validatePackSeed` (duplicate-code detection, service→capability cross-reference, dependency resolution against the Registry) before submit.
  - **JSON import path**: paste or upload a file in exactly the CLI's `PackSeedInput` shape, run it through `validatePackSeed` server-side, show errors inline, publish on confirm. This is the one Sudha named explicitly — cheapest to build first, since it needs no new form logic, just a textarea/file-upload wired to the existing validate/publish functions.
  - Both paths end at the same `Draft → Validated → Published → (Active)` flow already on the Registry's per-row transition control — no new lifecycle UI needed, just a new entry point into it.

## 2. Template

**Book 3 grounding:** Ch.6 (Template Model), §7 Template Structure, §10 Deliverable Catalogue, §11 Capability Catalogue, §13 Commissioning Parameters.

**Implemented now** (`seedTemplate`, `src/dblayer/seed/seedEbookLibraryPilot.ts` / `seedSeu.ts`):
- `code`, `name`
- `requiredCapabilityCodes[]` (§11 Capability Catalogue)
- `mandatoryPackCodes[]` (§7's "Mandatory Packs")
- `deliverableCatalogue[]` (§10): `code`, `name`, `category`, `producingCapabilityCode`, `dependsOnDeliverableCodes[]`, `dependsOnCapabilityServiceCodes[]`
- No lifecycle of its own currently — a Template row exists or doesn't; `findAllActive` implies a `status` column but nothing transitions it.

**Chapter-specified, not yet implemented** (§7): Description, Version, Purpose, Objectives, Lifecycle (a governed one, distinct from the untouched `status` column), Default Roles, Recommended Packs (only *Mandatory* exists), Default Workflows, Commissioning Parameters (§13 — methodology/stack/environment/domain/compliance selection at commissioning time). (§9): Template Inheritance — none exists; every Template is authored from scratch. (§12): Workflow Definitions.

**UI shape:**
- **New: Registry/list screen** — doesn't exist at all today, unlike Pack.
- **New: Create screen** — form for the six implemented fields above, plus the same JSON-import path as Pack (this pilot's own `ebook-library.template.json` is exactly the shape a JSON-import box would accept). The Deliverable Catalogue section is the one genuinely complex part of the form — needs a graph-aware builder (each Deliverable row picks its producing Capability, then multi-selects which already-added Deliverables/Capability-Services it depends on) since order matters and forward references should be caught before submit, not at commissioning time.
- No transition control needed yet — there's no governed lifecycle to expose until one is built.

## 3. Profile

**Book 3 grounding:** Ch.7 (Profile Model), §7 Profile Structure, §10 Configuration Parameters, §11 Feature Selection, §12 Organisation Composition.

**Implemented now** (`seedProfile`):
- `code`, `name`, `baseTemplateCode`, `environment`, `configParameters` (free-form object, not yet schema-validated per-Pack), `optionalPackCodes[]`

**Chapter-specified, not yet implemented** (§7): Description, Version, Selected Technologies / Selected Domains / Selected Compliance Packs / Integration Packs as *distinct* categories — today they're all flattened into one undifferentiated `optionalPackCodes[]` list, Feature Flags, Composition Options. (§9): Profile Inheritance. (§11): Feature Selection as its own concept, separate from Pack selection.

**UI shape:**
- **New: Registry/list screen** — doesn't exist, same gap as Template.
- **New: Create screen** — Base Template picker (populated from the Template registry above), Environment field, an Optional-Packs multi-select (populated from the Pack Registry, filtered to Packs whose `dependencies` are satisfiable given the chosen Template's mandatory set), and a raw `configParameters` JSON editor until/unless it's ever schema-driven per-Pack. Same JSON-import path as the other two.

## 4. Transition Definition

**Book 3 grounding:** Ch.29 (State Management), §9 State Transitions, §10 Transition Definitions.

**Implemented now** (`transitionDefinitionsDB`, seeded from `transitionDefinitions.json`):
- `entityType` (one of the 11 governed types), `fromState`, `toState`, `requiredAuthorityRuleCode` (nullable), `requiredPolicyCodes[]`

**Chapter-specified, not yet implemented** (§10 — this is the same gap already flagged in the bug list, item 4): "applicable Quality Gates," "required Reviews," "mandatory Evidence," "blocking Obligations," "applicable Engineering Behavior Model rules" are all stated as things every Transition Definition **shall** specify — none of these are fields on `transition_definitions` today; Quality Gate applicability is inferred only by coincidentally matching `(entityType, fromState, toState)`, and nothing routes Reviews/Evidence/Obligations through the Transition Definition at all except Deliverable's two hand-seeded Quality Gates.

**UI shape:** Lowest priority of the four to build UI for right now — precisely because the fields the chapter says it should carry (Quality Gates, Evidence, Obligations, Reviews) mostly don't exist as real relationships yet (bug list item 4). Building a UI for today's narrow shape (Authority + Policy only) risks looking finished when the underlying model isn't. Worth deferring until item 4's design decision is made, so the UI is built once, for the real shape, not twice.

## Not a fifth surface: Telemetry's sustained-pattern threshold

Raised 2026-08-05 — a concrete case that should exercise Pack's own Policy-contribution section (§1), not a new authoring surface of its own.

**Current state, worse than "JSON or seeded":** `SUSTAINED_BLOCK_THRESHOLD = 3` (`core/telemetry.ts`) is a hardcoded TypeScript constant — changing it needs a code change and redeploy, not even a data-file edit. Phase 7's own build notes already flagged this as a deliberate, documented cut, citing the chapter directly: Ch.35 §11 — *"What counts as 'sustained' ... is a Pack-contributed policy, not fixed by this chapter."*

**The fix is not a new UI.** The chapter already names where this belongs: an ordinary Policy, reusing the `condition` JSON field Policy already has for exactly this kind of parameterized rule, contributed by a Pack the same way `policy-nodejs-lint-standard` and the two Ch.24 baseline Policies already are. Once §1's Pack Create/Publish screen exists — its Policies section, specifically — authoring this threshold is already covered; no separate Telemetry-settings screen is needed.

**What's still needed, separately, in code:** `core/telemetry.ts`'s `checkSustainedQualityGateBlocking` needs to read the threshold from the resolved Policy's `condition` instead of the hardcoded constant. Small and contained, but only worth doing once the Pack UI's Policy-authoring section actually exists to author it through — sequence this after §1, not before.

## Suggested build order

1. **Pack — JSON import path only**, into the existing `validatePackSeed`/`publishPack` functions. Smallest change, reuses everything, directly what was asked for.
2. **Template create screen** (JSON import + basic form) — closes the biggest actual gap (no tooling at all today), and unblocks dry runs like this one from needing a one-off script next time.
3. **Profile create screen** — same reasoning, smaller than Template since it has fewer/simpler fields.
4. **Transition Definition** — hold until the item-4 design decision (Quality Gate/Evidence/Obligation/Review generalisation) is made, then build the UI for the real shape once.
