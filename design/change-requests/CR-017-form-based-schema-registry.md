# CR-017 — Form-based schema-registry authoring (author validators from a meta-schema)

**Raised:** 2026-08-13 · **Origin:** owner — `/aisworg/seu/sdk/schema-registry` authoring is a raw-JSON paste; it should be a form, with the form generated from a validator (like every other authoring surface). · **Status:** ✅ Built 2026-08-14 (constrained scope, per below)

> **Built 2026-08-14.** `tsc` clean; full suite **142 pass / 0 fail / 1 skip**. Smoke-verified (as root): the schema-registry `new` page renders a **form from the meta-schema** (per-field **type**/**widget** dropdowns, a **required** checkbox), **prefilled** from the kind's current version; authoring two fields **compiles to a correct JSON Schema** (`required=[title]`, `env.enum=[dev,prod]`) saved as a new version. Not committed (owner commits via GitHub Desktop).
>
> **Files:** [formGenerator.ts](../../src/domain/sdk/formGenerator.js) (per-item `enum`-select / `boolean`-checkbox in repeatable lists + `parseFormBody` boolean handling), [schemaCompiler.ts](../../src/domain/sdk/schemaCompiler.js) (`META_SCHEMA` + `fieldListToJsonSchema` + `jsonSchemaToFieldList`), [web/schemaRegistry.ts](../../src/routes/seu/web/schemaRegistry.js) (`GET …/new` form + form-aware `POST`), views [_generatedFields.ejs](../../src/views/seu/sdk/_generatedFields.ejs) (extracted shared field renderer, now used by authoring + schema-registry) + [schema-registry/new.ejs](../../src/views/seu/sdk/schema-registry/new.ejs), VM `seu_sdk_schema_registry_new.js`.
>
> **Deviations / decisions from the plan above:**
> - The meta-schema is a **code constant** (`META_SCHEMA`), not a seeded `schema_definitions` row — simpler, and it sidesteps the bootstrap/recursion note. (No migration needed for this CR.)
> - **Flat field list only.** Nested repeatable-list item structures (e.g. Pack `dependencies`) are **not** form-authorable; the **raw-JSON path is retained as an "Advanced" fallback** on the index for those. Constrained `widget` set: `none` / `json` / `referential-select`.
> - The schema registry **stays root-only** (`requirePlatformBadge("root")`) — it is meta-administration (a wrong grammar affects every future authoring session), the most privileged surface; not folded into the noun×verb authoring gates. Flag if you'd rather it be `transitiondefinition_*` or a dedicated noun.

### The gap
The platform's principle is now: *the versioned schema validator is the single source of truth — the form is generated from it, all input is validated against it* (Pack/Template/Profile). The **one place this doesn't hold is the schema registry itself**: `createSchemaVersion` accepts a pasted JSON string with only minimal checks (`schemaRegistry.ts` — "not a full meta-schema validator … not worth chasing for this pass"). So the tool that authors validators is the one tool that isn't form-driven or properly validated.

### What's wanted
Author a `schema_definition` through a **form**, generated from a **meta-schema** (a schema that describes what a valid `schema_definition` looks like), and validate the authored schema against that meta-schema before accepting it — making schema authoring consistent with everything else and closing the loop on "field change = validator change, form follows."

### Design
- **Introduce a meta-schema** — a seeded `schema_definition` (e.g. entity kind `Schema`) describing the shape of a schema document: `type`, `properties`, `required`, `enum`, and the platform's authoring vocabulary (`x-widget`, `x-referential`/`x-referential-source`, `x-help`).
- The schema-registry authoring **form is generated from the meta-schema** (the same `formGenerator`); `createSchemaVersion` **validates the authored JSON against the meta-schema** before creating the (immutable, additive) version.
- **Recommended scope — a *constrained* meta-schema**, covering only the field kinds the platform actually renders/validates (string / number / boolean / enum / object / array-of-objects; `x-widget: json|referential-list`; `x-referential-source`; `x-help`; `required`). **Not** a general-purpose visual JSON-Schema editor — that's open-ended and large, and unnecessary for the vocabulary the form generator supports.

### Caveats / decisions
- **Bootstrapping / recursion.** The meta-schema is itself a `schema_definition`; it is **seeded**, not authored through its own form on day one. (It *can* later be viewed/versioned like any other, but the initial one is a migration/seed.)
- **`formGenerator` coverage.** Confirm it renders nested arrays-of-objects well enough to author a schema's `properties`; extend if needed. This is the main build risk.
- Reconciles the prior "not worth chasing a full meta-schema" note — this CR deliberately builds the *constrained* version, not the full one.

### Why it matters
This is the tooling that makes CR-015 / CR-016 / CR-018 fully self-service: once validators are authored in a form (and validated), adding/changing a Pack/Template/Profile field is a governed, form-driven **data** change to the validator — no code, no raw-JSON paste.

### Not in scope
- A general arbitrary JSON-Schema visual editor.
- Authoring the meta-schema through its own form (seed it).
- Applying authored schema versions to already-published content (versions stay immutable per Ch.5 §19.2).
