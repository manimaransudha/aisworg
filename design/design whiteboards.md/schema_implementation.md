# Schema implementation

# Findings
No Ajv or any JSON-schema validator anywhere. Confirmed for Packs too:

core/packs.ts has zero references to schema_definitions/schema validation — same hand-coded-check pattern as Service Definition.
schema_definitions rows (compiled via schemaCompiler.ts) are consumed only by formGenerator.ts/sdkAuthoring.ts — purely to render the authoring form (field widgets, groups, Ontology-composable fields, referential sources). Never to validate submitted content.
No Ajv or any JSON-Schema validator exists in the codebase at all.
So the gap is platform-wide, not Service-Definition-specific: schema_definitions is a form-generation grammar only. Every authored-entity validate*Seed/validate* function (Pack, Template, Profile, Deliverable Definition, Service Definition) hand-codes its own field checks in TS, duplicating what the schema already declares (required, type, min/max, enum-via-x-ontology) — the stored schema is never the source of truth actually enforced at write time.

# Direction 

This is what should  happen
1. The table schema has to match the schema definition. Otherwise this can diverge very quickly. 
2. Form generator has to use the schema which is already the case. (hoping). The buttons on the form follow the transition definitions
3. Everytime there is an insert/update, the validation has to be against the schema. 
Do not code. Let us start with Packs/Template/Profile(all the three use sdk)

## Deepdive on packs

Findings for Pack/Template/Profile (all "use SDK" per your framing), checked against your 3 requirements:

1. Table schema must match schema_definitions — currently diverged, in three places, not two:

packs.category CHECK constraint (migration 002): hardcoded enum ('Platform','Organisation','Domain','Compliance','Technology','Integration').
schema_definitions Pack v1 (migration 014): same enum, hardcoded again in the JSON.
validatePackSeed (actual code path run on insert): validates category against Ontology category:pack concepts instead — CR-020 moved this off the hardcoded list.
Three independent sources of truth for the same field; only the third is live. The table CHECK and the schema_definitions enum are both now stale relative to Ontology, and could silently reject or admit different values than the code path allows.
templates/profiles tables carry no such enum drift themselves (no category-like field), but both still only have status CHECK constraints — no schema_definitions row ever cross-checked against them either.
2. Form generator uses the schema — confirmed true. formGenerator.ts/sdkAuthoring.ts (generateFields, groupFieldsForDisplay, ontologyComposableFieldsIn, etc.) all read schema_definitions to render the authoring form. Buttons: possibleNextStates comes from transition_definitions via transitionEngine, not hardcoded — matches your requirement.

3. Validation on insert/update against the schema — does not happen.

A real generic validator exists: validateAgainstSchema(schema, content) in formGenerator.ts.
It's called only in the web/draft layer (sdkAuthoring.ts): on /save (non-blocking — advisory only, draft still saves) and on /import (blocking).
core/packs.ts (validatePackSeed), and by the same pattern core/templates.ts/core/profiles.ts, never call validateAgainstSchema or touch schema_definitions at all — the actual DB insert/update path (packsDB.create, presumably templatesDB.create/profilesDB.create) is validated purely by hand-written TS checks, independent of the schema.
So the schema is enforced only as a soft advisory during draft editing in the web UI, and not at all if a row is created any other way (direct core-layer call, seed script, API).
Want me to check core/templates.ts and core/profiles.ts in the same depth to confirm they mirror Pack's pattern exactly, or is this enough to proceed to design options?


## Design 

Full: single source of truth, DB constraint removed entirely, all validation funneled through validateAgainstSchema
No enum/pattern logic in SQL at all. core/packs.ts / templates.ts / profiles.ts call validateAgainstSchema(latestSchemaFor(kind), seed) as a mandatory step inside validate*Seed, replacing today's hand-written field checks (Ontology-backed checks like assertCanonicalCategory stay, since schema_definitions can't express "value must exist in Ontology concept type X" — needs a new x-ontology-driven branch in validateAgainstSchema itself, which ontologyComposableFieldsIn already partially supports).
New concept: schema_definitions becomes binding, not advisory, at every insert/update path (core layer, not just web draft save).
Files touched: core/packs.ts, core/templates.ts, core/profiles.ts, formGenerator.ts (extend validateAgainstSchema to also drive Ontology checks), migrations to drop the now-redundant table CHECKs.
Risk: largest change; touches the actual insert/update code path for all three entities, must not regress existing Ontology-specific validation.

1. Drop all table constraints. 
2. dblayer/*DB.ts create, insert, update should validate against the schema whether the data is imported from a json or comes from authoring. 
- x-ontology is checked for form dropdowns already. It is used to fetch valid options for rendering, not to check a submitted value is one of them. Same Ontology lookup, different call site: validateAgainstSchema needs to call it too, but that's reuse, not new plumbing. 
- No schema version pinning on validate — an update must validate against the row's own schema_definition_id/version, not always latest, or a schema bump breaks existing valid rows retroactively.
- no new column needed. Per Ch.5 §13/§19.9 (CR-018), compatibility is already declared in packs.metadata (JSONB): 
supportedPlatformVersion,minSupportedPlatformVersion, maxSupportedPlatformVersion, (nothing for the current implementation) 
incompatiblePackVersions, 
migrationGuidance.(nothing for the current implementation)  
And dependencies[] already has an incompatible type for pack-to-pack (not version-to-version).

## Design steps

Applies to any authored-entity kind that uses the SDK (schema_definitions + dblayer *DB.ts). Pack is the first pass; same steps repeat per entity.

1. Drop hardcoded enum/CHECK constraints from the table where the field is Ontology-governed (e.g. `packs.category`) — table keeps structural constraints only (NOT NULL, type, FK, UNIQUE).
2. Update the corresponding `schema_definitions` row: replace hardcoded `enum` with `x-ontology` (the same marker formGenerator already reads for dropdown options), so the schema stops being a second hardcoded copy.
3. Extend `validateAgainstSchema` to check `x-ontology`-marked fields against real Ontology data (reuse the same lookup formGenerator uses for options, not new plumbing).
4. Add a `schema_definition_id` column to the entity's own table (e.g. `packs`) — does not exist today, only `deliverable_authoring_content` tracks it (pre-publish draft stage). Set it on create; this is the prerequisite for the next step.
4a. Add schema-version pinning to validation: validate an update against the row's own authored `schema_definition_id`/version (from step 4), not always the latest schema version.
5. Split today's hand-written `validate*Seed` checks into two buckets:
   - Shape/Ontology-membership checks (semver pattern, category/classification/code-via-dynamic-category-suffix must be a real Ontology value — `code`'s check already expressed in schema via `x-referential-source-by`/`x-referential-source-suffix`, migration 133) — these are now covered by step 3. Delete them from `validate*Seed`.
   - DB-lookup checks that schema can't express (code+version+tenant uniqueness, dependency target must resolve to a real Active Pack) — these move into a helper module in core/ (e.g. `core/validators/<entity>.ts`).
6. `dblayer/*DB.ts` create/update calls the helper before doing the DB operation — helper imports core (e.g. `core/ontology.ts`), dblayer imports the helper. No cycle: dblayer never imports back into `core/packs.ts` etc.
7. Once (1)-(6) land for an entity, its `validate*Seed`-equivalent is schema-driven and enforced at every write path (core call, seed script, import, API), not just the web draft-save advisory.

Deferred, not part of this pass: enforcing `packs.metadata` compatibility fields (`supportedPlatformVersion`/etc.) at composition — declared but unenforced, separate gap (Ch.5 §19.9), not a schema-sync issue.
