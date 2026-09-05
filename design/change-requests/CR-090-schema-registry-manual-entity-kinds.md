# CR-090 — Schema Registry: allow manual definition for any entity kind

**Raised:** 2026-09-05 · **Origin:** owner — "Schema registry should allow manual definition for the schema. Open this as a CR." Raised directly out of the CR-089 (Policy) migration work, where the owner asked where the SQL was for registering the new `Policy` schema kind and it turned out the Schema Registry's own authoring form couldn't have done it. · **Status:** 🟡 Proposed (not designed — logged to not lose the finding, design deferred)

## The gap, as found

`schema_definitions` is a real table (`entity_kind`, `version`, `schema` JSONB) — the actual store for every entity kind's JSON Schema. Separately, there is a **Schema Registry meta-form**: a UI page that lets someone author a *new* schema version for an entity kind by filling out a form, instead of hand-writing a migration's `INSERT INTO schema_definitions`.

That meta-form restricts which entity kinds it will offer via two hardcoded TS constants:

- `SCHEMA_ENTITY_KINDS` — `src/routes/seu/core/schemaRegistry.ts:14`
- `SCHEMA_KINDS` — `src/domain/sdk/schemaCompiler.ts:16`

Both are currently `["Pack", "Template", "Profile"]`. `schema_definitions` itself has grown to 7 real entity kinds over time (`Pack`, `Template`, `Profile`, `TransitionDefinition`, `Deliverable`, `Service`, and now `Policy` — CR-089, migration 167) — every kind added after the original three was authored by hand-writing a migration, because the meta-form never learned about it. `Deliverable` and `Service`, both real and in active use today, hit the exact same wall Policy just did.

## What's being asked

Widen the Schema Registry so any entity kind's schema can be authored (new kind, or new version of an existing kind) through the meta-form, not just the original three. Concretely, at minimum: `SCHEMA_ENTITY_KINDS`/`SCHEMA_KINDS` need to stop being a fixed allow-list of three — either grown to the current 7 and kept manually in sync going forward, or made to reflect whatever's real (e.g. sourced from `SchemaDefinitionEntityKind`, `seuTypes.ts`, or from `schema_definitions` itself) so a new kind doesn't require touching two separate TS files by hand on top of writing the migration.

## Not yet designed

- Whether the fix is "widen the two arrays to match `SchemaDefinitionEntityKind` and keep them in sync by convention," or a deeper change (derive the allowed-kinds list from a single source of truth instead of two independent constants).
- Whether the meta-form's own field-authoring UI (`formGenerator.ts`'s item-field kinds) needs anything to support entity kinds with schema shapes the original three never needed — e.g. Policy's own `x-widget: "json"` `conditions` field, which the meta-form would need to let someone construct, not just consume.
- Whether "manual definition" means only unlocking the existing meta-form for more kinds, or also means something else the owner has in mind (raised in passing, not yet unpacked).

## Next step

Owner: "let us get back to Policy" — this CR is logged so the finding isn't lost; no further work until picked up separately.
