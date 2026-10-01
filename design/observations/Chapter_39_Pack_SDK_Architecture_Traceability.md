# Traceability Analysis: Chapter 39 – SEU Design Kit (SDK) Architecture

**Specification**: [`Chapter 39.md`](design/foundations/03_Book%203%20%28Refined%29/06_Part%206/Chapter%2039.md) (sections 1–18, full chapter)

**Date**: 2026-09-26

**Main code files looked at**:
- [`src/routes/seu/core/sdkAuthoring.ts`](src/routes/seu/core/sdkAuthoring.ts), [`src/routes/seu/web/sdkAuthoring.ts`](src/routes/seu/web/sdkAuthoring.ts)
- [`src/domain/sdk/formGenerator.ts`](src/domain/sdk/formGenerator.ts), [`src/domain/sdk/schemaCompiler.ts`](src/domain/sdk/schemaCompiler.ts)
- [`src/routes/seu/core/schemaRegistry.ts`](src/routes/seu/core/schemaRegistry.ts), [`src/routes/seu/web/schemaRegistry.ts`](src/routes/seu/web/schemaRegistry.ts)
- [`src/routes/seu/core/packs.ts`](src/routes/seu/core/packs.ts)
- [`src/dblayer/seed/pack-sdk-cli.ts`](src/dblayer/seed/pack-sdk-cli.ts) — the `pnpm pack:validate` / `pnpm pack:publish` commands
- [`tests/sdk-authoring.test.ts`](tests/sdk-authoring.test.ts), [`tests/pack-sdk.test.ts`](tests/pack-sdk.test.ts)

---

## 1. Summary

What was actually built: one web form engine that authors seven kinds of things — Pack, Template, Profile, Deliverable, Service, Policy, Capability — plus a small command-line tool that only works for Pack.

Two things the chapter asks for do not exist in the code at all: a plug-in system for extending the SDK (§13), and the six named SDK events (§15). This was a deliberate decision, not a mistake, but it means the chapter is not fully built as written.

Packaging (§11) and traceability (§14) are a mixed picture. There is no separate package file, no digital signature, and no stored record of past validation/test runs. But the core idea behind packaging — that a published version is locked and can't be silently changed — mostly holds at the top level. It breaks down one layer underneath, explained in §11 below.

---

## 2. Section by Section

### §1 Purpose / §4 Definition — "the SDK is the only way to create Elements"

| What the chapter claims | What the code actually does | Met? |
|---|---|---|
| The SDK gives a stable contract between Platform Core and the people building Elements | The contract is the `schema_definitions` table (see [`schemaRegistry.ts`](src/routes/seu/core/schemaRegistry.ts)). A schema version, once created, is never changed — a new version is always a new row. Anything authored against version 3 is always checked against version 3, forever. That's the stable contract the chapter is asking for. | Met |
| You can extend the platform without touching the Runtime Kernel | Adding a new field to a Pack/Template/etc. just means adding a row to `schema_definitions` — no code change — as long as that field uses a widget type the form engine already knows how to draw (see [`formGenerator.ts:15-283`](src/domain/sdk/formGenerator.ts#L15-L283)). If you need a brand new *kind* of widget, that does need code. | Partly met |

### §3 Where the SDK sits in the architecture

The chapter's picture: `Developer → SDK → Element Package → Element Registry → Composition Engine → Engineering Behavior Model → Runtime Kernel`.

What actually happens: `Author fills in a web form → a Draft row in that entity's own table → validated → published (a governed state change) → the entity's own table (packs, templates, profiles...) which doubles as "the Registry" → compositionEngine.ts → transitionEngine.ts`.

There is no separate "Element Package" step. The Draft row simply becomes the published row in place. Nothing gets packaged as a separate artefact (see §11).

### §5 Architectural Principles

| ID | What it asks for | What's actually true | Met? |
|---|---|---|---|
| SDK-001 | Every real Element must be created through the SDK | True for all 7 kinds registered in [`schemaRegistry.ts:17`](src/routes/seu/core/schemaRegistry.ts#L17) (Pack/Template/Profile/Deliverable/Service/Policy/Capability). TransitionDefinition is deliberately excluded — it's authored through a separate `/authority` form instead. | Met |
| SDK-002 | The SDK must not depend on how the Runtime Kernel is built | True — the validators and generators just work with plain JSON. They use `transitionEngine`/`compositionEngine` but never change them. | Met |
| SDK-003 | SDK output must be deterministic (same input → same output) | True for validation — it's pure functions over the input plus DB lookups. Doesn't apply to packaging, because there's no packaging step to be deterministic about (see §11). | Met for validation |
| SDK-004 | Must validate before publishing | True — every publish path re-runs validation right before the governed state change. | Met |
| SDK-005 | Must support automation | Only Pack has a command-line tool (`pack:validate`/`pack:publish`, see [`package.json:12-13`](package.json#L12-L13)). Template/Profile/Deliverable/Service/Policy/Capability have no CLI — web form only. | Partly met |
| SDK-006 | Must be able to evolve without touching the Runtime Kernel | Same reasoning as SDK-002. | Met |

### §6 Functional Requirements / §7 SDK Components

| ID | What it asks for | What's actually true | Met? |
|---|---|---|---|
| FR-39.1 | Widgets for building Element forms | Real, and fairly rich: `json`, `referential-list`, `referential-select`, `referential-multi-select`, `textarea`, `version`, `db-select`, plus nested-list/nested-object items inside a `referential-list` (see [`formGenerator.ts:73`](src/domain/sdk/formGenerator.ts#L73)). | Met |
| FR-39.2 | Validate Element schemas | Real. Structure is checked by `formGenerator.ts`; the meaning/references are checked by a `validate*Seed` function per kind, all called through one dispatcher, `validateAuthoredContent` ([`sdkAuthoring.ts:478-487`](src/routes/seu/core/sdkAuthoring.ts#L478-L487)). | Met |
| FR-39.3 | Validate Element dependencies | Two separate things, both real, neither complete: (a) A Pack's own `dependencies` is a flat list, not a graph — only `required` dependencies are checked to actually exist, at author time ([`packs.ts:693-701`](src/routes/seu/core/packs.ts#L693-L701)). A flat list can't have a cycle, so there's nothing to check there. (b) A Template's `dependencyGraph` (which links Deliverables to each other) *is* a real graph, and it does have a cycle check ([`templates.ts:476-484`](src/routes/seu/core/templates.ts#L476-L484), used at [`templates.ts:619`](src/routes/seu/core/templates.ts#L619)). | Partly met |
| FR-39.4 | Validate compatibility declarations | Two different things share this name, and only one is real: (a) schema-version compatibility is real — every new schema version is compared against every earlier version ([`schemaRegistry.ts:61-108`](src/routes/seu/core/schemaRegistry.ts#L61-L108)). (b) Pack has platform-version fields (`supportedPlatformVersion`, `minSupportedPlatformVersion`, `maxSupportedPlatformVersion`, `incompatiblePackVersions` — [`packs.ts:227-236`](src/routes/seu/core/packs.ts#L227-L236)) that you can fill in, but nothing ever checks them. They're stored, not enforced. | Partly met |
| FR-39.5 | Automated testing | Real but limited: [`tests/sdk-authoring.test.ts`](tests/sdk-authoring.test.ts) (829 lines) and [`tests/pack-sdk.test.ts`](tests/pack-sdk.test.ts) (509 lines) run against a real database and the real engines, not isolated fixtures — which conflicts with §10's "tests must run independently of the Runtime Kernel." | Partly met |
| FR-39.6 | Package an Element into a deployable artefact | No separate package file exists anywhere in the code. A published Pack version is locked in place (see §11), which covers part of the intent, but the contents underneath that version can still be silently rewritten — so it isn't a frozen package the way the chapter means. | Partly met |
| FR-39.7 | Publish to the Element Registries | Real for all 7 kinds. Publishing is a governed state change that writes straight into the entity's own table, and that same table doubles as "the Registry." | Met |

### §8 SDK Elements Taxonomy

The chapter describes one generic "SDK element" concept with discovery, validation, dependency management, version compatibility, composition, activation, and lifecycle. All of those things exist, but they're built separately for each of the 7 kinds — in `core/packs.ts`, `core/templates.ts`, `core/profiles.ts`, etc. — not as one shared abstraction. There's no single `SdkElement` type in the code. `sdkAuthoring.ts` ties the 7 kinds together only through a few dispatcher functions.

### §9 Validation

| What must be checked | What's actually true | Met? |
|---|---|---|
| Manifest correctness | There's no "manifest" in this codebase — the Draft's own content is checked directly against its JSON Schema. Same goal, different mechanism. | Met (different mechanism) |
| Schema compliance | Real — handled by `formGenerator.ts` plus the per-kind validators. | Met |
| Dependency graph | Partial, see FR-39.3 above: Pack dependencies aren't a graph at all; Template's dependency graph is a real graph with a real cycle check. | Partly met |
| Compatibility rules | Partial, see FR-39.4 above: schema-version compatibility is checked; platform-version compatibility is stored but never checked. | Partly met |
| Duplicate identifiers | Real — checked in `validatePackSeed` ([`packs.ts:359-405`](src/routes/seu/core/packs.ts#L359-L405)). | Met |
| Semantic integrity | Real — enforced through Ontology-backed checks. | Met |
| Required metadata | Real — enforced through the schema's `required` list plus the form engine's own required-field marking. | Met |

The chapter also says validation must fail before packaging. There's no separate packaging step to fail before, so this can't really be tested as written (see §11).

### §10 Testing

The chapter names five kinds of tests: schema, composition, compatibility, regression, example-execution. The code doesn't organize tests by those categories — it organizes them by entity kind (`sdk-authoring.test.ts`, `pack-sdk.test.ts`).

The chapter also says tests must run independently of the Runtime Kernel. That's not true here — both test files run against a real Postgres database and the real `transitionEngine`/`compositionEngine`, not fake/isolated versions.

### §11 Packaging

Not "not implemented" — partly implemented. There's no separate package file, no digital signature, and no generated documentation bundle anywhere in the code. But the underlying idea — that once something is published, its identity and content are locked — mostly holds: `createPackDraft` ([`packs.ts:732-769`](src/routes/seu/core/packs.ts#L732-L769)) will not create a second row for a `(code, version, tenant)` combination that already exists; it reuses the existing one.

But it doesn't stop there. Even when reusing that existing, already-published row, the code still calls `materializeContributions(existing, seed)` ([`packs.ts:741`](src/routes/seu/core/packs.ts#L741)), and everything that function writes — capabilities, services, authority rules, policies — is written with an **upsert**, not a "only insert if new" guard ([`packs.ts:871`](src/routes/seu/core/packs.ts#L871), [`packs.ts:897`](src/routes/seu/core/packs.ts#L897), [`packs.ts:909`](src/routes/seu/core/packs.ts#L909)). So re-publishing the exact same version can quietly overwrite what that version actually contains. The top-level row is locked; what's underneath it is not. That's a real problem against the chapter's "packaging must be deterministic" and "published schemas must be reproducible" rules — separate from whether a packaging artefact exists at all.

### §12 Publishing

| What publishing must do | What's actually true | Met? |
|---|---|---|
| Verify schema signatures | Not implemented — there are no signatures to verify. | Not met |
| Validate permissions | Real — every publish action is gated by a badge/role check tied to a `route_authority` row, per this project's standing rule. | Met |
| Enforce versioning rules | Real — version numbers are checked to be valid semver, and compared numerically to decide what supersedes what ([`packs.ts:319`](src/routes/seu/core/packs.ts#L319)). | Met |
| Update registry metadata | Real — it's a direct update to the entity's own row. | Met |
| Publish schema documentation | Not implemented as its own thing. There are inline help-text annotations on schema fields (`x-help`, `x-schema-notes` — [`formGenerator.ts:39-46`](src/domain/sdk/formGenerator.ts#L39-L46)), but nothing is generated or published as documentation. | Not met |
| Publishing must not change the schema's contents | True — the schema table has no update function at all. A new version can only be inserted, never edited in place. | Met |

### §13 SDK Extensibility

Not implemented, at all. There is no plug-in or extension-point mechanism anywhere for validators, project templates, testing modules, packaging, or publishing targets. Each of the 7 kinds is its own hand-written file. Adding an 8th kind means writing a whole new module, not registering a plug-in.

### §14 Traceability

| What must be kept | What's actually true | Met? |
|---|---|---|
| Version | Real — tracked in `schema_definitions.version` and each entity's own `*_version` column. | Met |
| Validation results | Not kept. A validation call just returns `{ok, errors}` to the caller — nothing is saved. | Not met |
| Test results | Not kept anywhere in this part of the code. | Not met |
| Publishing history | Partial — the state-transition history gives an audit trail of what happened and when, but it's the entity's general lifecycle history, not something SDK-specific. | Partly met |
| Digital signatures | Not implemented (same as §11). | Not met |
| "Every published schema must be reproducible" | Hard to test as written, since there's no packaging step to reproduce. The closest equivalent — rebuilding a form from a stored schema plus stored content — is deterministic, but that's not what the chapter means by this. | Not met |

### §15 Events

Not implemented under these names. None of `SDKElementSchemaCreated`, `SDKElementSchemaValidated`, `SDKElementSchemaTested`, `SDKElementSchemaPackaged`, `SDKElementSchemaPublished`, `SDKElementSchemaPublicationRejected` exist anywhere in the code. What's published instead is each entity's own general lifecycle events (`PackRegistered`, `PackTransitioned`, and the equivalents for the other kinds — [`packs.ts:760-767`](src/routes/seu/core/packs.ts#L760-L767), [`packs.ts:1153-1162`](src/routes/seu/core/packs.ts#L1153-L1162)). These cover similar moments but are a genuinely different set of events, not just a rename.

### §16 Non-Functional Requirements

| Requirement | What's actually true | Met? |
|---|---|---|
| Support automated pipelines | Partial — only Pack has a CLI (see SDK-005). | Partly met |
| Support offline development | Not implemented — every action needs a live database connection, even just to validate. | Not met |
| Stay platform-independent | True, same reasoning as SDK-002. | Met |
| Produce deterministic output | True for validation; doesn't apply to packaging, since there isn't one. | Met for validation |
| Support future SDK versions | Not implemented — there's no version number for the SDK itself, only for schemas and entities. | Not met |

### §17 Acceptance Criteria

| Criterion | Status |
|---|---|
| Elements can be created using an Element Schema | Met |
| Validation catches structural and semantic errors | Met |
| Packaging is deterministic | **Not met** — the top-level row is locked, but re-publishing the same version can still overwrite its contents (see §11). |
| Published schemas are reproducible | **Not met** — same reason as above. |
| Supports automated build pipelines | Partly met — Pack CLI only |
| Evolves independently of the Runtime Kernel | Met |

### §18 Deliverables

| Deliverable | Status |
|---|---|
| SDK framework | Present, but as 7 separate hand-written pipelines tied together by a thin dispatcher — not one shared framework |
| Project generator | Not implemented — no scaffolding tool to start a new Element from scratch |
| Validation framework | Present |
| Testing framework | Present, but tied to a real database — not the isolated framework the chapter implies |
| Packaging service | Not implemented as a distinct service (see §11 for what does exist) |
| Publishing service | Present |
| SDK documentation | Not found as a generated or maintained document — only inline code comments |
| Reference schemas | Present — seed rows in `schema_definitions` for all 7 kinds |

---

## 3. Overall

The authoring/validation/publishing core of this chapter (roughly §§1, 4–9, 12) is genuinely built and working, just as a web-first, database-coupled system rather than the standalone CLI/packaging-artefact system the chapter describes.

Two parts are missing outright: the plug-in extension system (§13) and the named SDK events (§15).

Packaging (§11) is the most nuanced gap: the top-level idea — a locked, versioned row — is real, but it's undermined by upsert writes to what's underneath that row, so a "published" version isn't as frozen as the chapter requires.

Testing (§10) and two of the non-functional requirements (§16 — offline development, independence from the Runtime Kernel) directly contradict how the system is actually built, since everything depends on a live database and the real engines.
