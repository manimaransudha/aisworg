# CR-119 — Shared version helper and the `version_hop` transition flag

**Raised:** 2026-10-15 · **Origin:** the semver pattern, the patch bump and the initial `"1.0.0"` were duplicated across Pack, Profile, Template, Capability, Policy, Service and Deliverable Definition code (Ch.41 Version Management).

**Status:** 🟡 Built, pending verification — 2026-10-15

## Fix the following

- Each module kept its own `SEMVER_RE`, error message and patch-bump function. Pack also kept its own `compareSemver`.
- The initial version `"1.0.0"` appeared as a literal in about twenty places.
- Capability, Policy and Service copy reused `source.version` and collided with the source row on `UNIQUE (code, version, tenant_id)`.
- Duplicate-version checks ran in `createDraft`, in the write validators and in `assert…CodeVersionFree`, in addition to the database constraint.
- Publish was idempotent on `(code, version, tenant)`.

## Settled design

- `src/utils/version.ts` holds the semver pattern and message (`semverError`, `isSemver`), `bumpPatch`, `nextAvailablePatchVersion`, `nextUnusedPatchVersion` and `compareSemver`. The helper manages version numbers only.
- `INITIAL_VERSION` is defined once in `src/dblayer/constants.ts`.
- A new draft starts at `INITIAL_VERSION`. A copy or a reactivation inserts a new row at the next patch. Each version stays its own immutable row (Ch.41 VM-002, FR-41.2).
- `transition_definitions.version_hop` is a nullable boolean. A null value means the transition hops. A `false` value suppresses the hop. A hop also requires `version_event` to be set.
- `transitionEngine.evaluate` accepts an optional `currentVersion` and returns `nextVersion` when the transition hops. Callers do not update the version of an existing row.
- The duplicate-version checks are removed. The database unique constraint is the only guard, and `ON CONFLICT DO NOTHING` is removed from the Capability and Service `createDraft`.
- Publish idempotency is removed from `createPackDraft`, `publishTemplate` and `publishProfile`. The `alreadyExists` and `alreadyPublished` results are removed.
- Seeds that publish an entity another seed already published find the Active row by code first: `seedCr104Demo` (Packs, Template, Profile) and `seedTestFixturePacks`.
- `seedServiceDefinitions` keys its existing-row check on the Platform tenant id.

## Built (2026-10-15)

- Helper, constant, `version_hop` column (`transition_definitions_schema_recovery.sql`, `TransitionDefinitionRow`, `replaceAll`, `seedTransitionDefinitions.ts`).
- `ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS version_hop BOOLEAN;` applied to the live database by the owner.
- `transitionDefinitions.json` carries no `versionHop` values, so every `version_event` hop is a hop.

## Test fixtures updated in the same pass

- `tests/testFixtures.ts`: the Template and Profile fixture finds the Active row by code first. `driveCommissioningToActive` grants the SEU hop badges with `grantTransitionBadge`.
- `tests/pack-sdk.test.ts`: version assertions use the versions the published rows carry. The version-sequence test takes a per-run major version.
- `tests/sdk-authoring.test.ts`: the duplicate-create assertion accepts the unique-constraint error. The branching test compares against the version read after activation.
- `tests/objective-supersession.test.ts`: restores the tester's badge list after granting.
- `tests/schema-definition-event-lifecycle-table.test.ts`: expects the SchemaDefinition verbs, the `sdk_author` role and the `schemadefinition_package` stamp.
- `tests/acceptance.e2e.test.ts`, `tests/web-flow.e2e.test.ts`: the `appConfig` import and call are removed.

## Incidental changes in the same pass

- `routes/web/demo.js` reads `DEMO_VOICE_PROVIDER` and `DEMO_EDGETTS_VOICE` from `src/dblayer/constants.ts`.
- The settings page (`GET /settings`, `POST /settings/:key`), its view, its view model and its two `route_authority` rows are removed.
- `demoSeed.ts` reads `detail` only when the result carries it.

## Still open

- Nothing consumes `nextVersion` yet. The consumer, and which transition rows get `version_hop = false`, are undecided.
- Objective (patch bump on save) and Ontology keep their own version paths.
- Deliverable Definition transitions carry no `version_event`.
- The `findByCodeAndVersion` lookups in `sdkAuthoring.ts` and `demoSimulator.ts` use a fixed version.
- Remaining test failures from the automatic commence-work rescan race: Phase 5, Phase 7, and `attestation` and `traceability` under full-suite load.
