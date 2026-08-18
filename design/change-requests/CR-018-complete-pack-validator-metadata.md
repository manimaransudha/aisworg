# CR-018 — Complete the Pack validator: §8 metadata, §10 dependency types, §13 compatibility fields

**Raised:** 2026-08-13 · **Origin:** owner — "define the Pack validator/schema based on the field gaps identified." · **Status:** ✅ Built 2026-08-14

> **Built 2026-08-14.** `tsc` clean; full suite **142 pass / 0 fail / 1 skip**. Smoke-verified: the Pack form now carries the **§8** fields (`description`/`owner`/`publisher`/`compositionStrategy`/`supportedPlatformVersion`) and **§13** fields (`min`/`max SupportedPlatformVersion`, `incompatiblePackVersions`, `migrationGuidance`), `dependencies.type` offers the full **§10** set (`required`/`optional`/`conditional`/`incompatible`), and authored metadata **persists** in `packs.metadata`. Not committed.
>
> **Files:** migration [039_pack_metadata.sql](../../src/dblayer/migrations/039_pack_metadata.sql) (`packs.metadata` JSONB + grammar update), [core/packs.ts](../../src/routes/seu/core/packs.js) (`PackSeedInput` metadata + `PackDependencyType`; `packMetadataFromSeed`; `validatePackSeed` resolves only `required` deps + checks the type value), [packsDB.ts](../../src/dblayer/packsDB.js) + [seuTypes.ts](../../src/dblayer/seuTypes.js) (store/type metadata).
>
> **Decisions:** recorded-but-unenforced metadata lives in **one `metadata` JSONB column** (not nine columns nothing queries). Declaration-only held: `optional`/`conditional`/`incompatible` deps are **not** resolved and compatibility/`compositionStrategy` are **not** acted on — those stay the §19.9 engine follow-ups. `incompatiblePackVersions` is a comma-separated string for now (list semantics deferred). Grammar updated in place at v1 (as CR-015).

### Scope
Add to the Pack `schema_definition` (the validator) the fields identified as gaps in Ch.5 §19 that **CR-015** (code/category/validate) and **CR-016** (contributions/§20) do **not** cover — so the generated form and validation include them. All additive; a new immutable schema version (Ch.5 §19.2).

**1. §8 metadata (gap §19.5)** — add: `description`, `owner`, `publisher`, `compositionStrategy`, `supportedPlatformVersion`.

**2. §10 dependency types (gap §19.9)** — widen `dependencies[].type` from `"required"` only to the full §10 set: `required` / `optional` / `conditional` / `incompatible`.

**3. §13 compatibility (gap §19.9)** — add: `minSupportedPlatformVersion`, `maxSupportedPlatformVersion` (optional), `incompatiblePackVersions[]`, `migrationGuidance`.

The form and validation follow automatically from the schema (schema-registry architecture); no bespoke form code.

### Boundary — declaration, not enforcement
This CR makes the fields **exist, be authored on the form, and be validated for shape**. It does **not** make the platform *act* on them — that is engine work already tracked in §19.9 and stays as **separate follow-up CRs**:
- resolving `optional`/`conditional`/`incompatible` dependencies at composition (today only the Template/Profile pack sets drive composition);
- validating `min/max`/`incompatible` compatibility at composition;
- honouring a per-Pack `compositionStrategy` (composition still applies the fixed "later-overrides-earlier" Override strategy — §19.8).

Recording these fields is the prerequisite; acting on them is downstream.

### Relationship to the other Pack CRs
Together these define the complete Pack validator:
- **CR-015** — UUID `code`, `category` from `pack_category` (data), validate on import/save.
- **CR-016** — structured `contributions` + the §20 verifiable-item fields.
- **CR-018** (this) — the remaining §8 / §10 / §13 top-level metadata fields.

Best authored **after CR-017** (form-based schema authoring) so the new Pack validator version is itself created through a form + meta-schema validation rather than a raw-JSON paste — though it can be done via the current registry if sequencing demands.

### Notes
- `owner`/`publisher` are free text for now (no Identity linkage) unless a later CR ties them to real users/tenants.
- `supportedPlatformVersion` / the §13 fields assume a platform-version concept exists to compare against; if none is defined yet, they are recorded-but-unenforced (consistent with the declaration-only boundary above).
