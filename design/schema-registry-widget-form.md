# Schema Registry authoring form — widget-based redesign

**Superseded — see `design/change-requests/CR-114-schema-metadata.md`, the
only live reference for this design. Left here only for history.**

Status: whiteboarding, not built. Owner directive (2026-09-26): the flat
field-row editor (`AuthoredField`/`META_SCHEMA` in `schemaCompiler.ts`) does
not scale as more `x-*` keywords get added to real schemas (Pack/Template/
Profile/Policy/Service/Deliverable/Capability). Redesign the schema-registry
"New version" form itself as a tree of composable widgets, one widget kind
per real kind `formGenerator.ts` already renders/validates, so adding a new
`x-*` keyword later is "add one widget kind," not "add a column to every row
and every branch that reads it."

## Why (context)

Prior state: `AuthoredField` (schemaCompiler.ts) exposes only 9 keywords
(name/type/required/enumValues/widget/referentialSource/ontology/help/
pattern) out of the 17 `x-*` keywords `JsonSchemaProperty` (formGenerator.ts)
actually defines. Missing: `x-ontology-composable`, `x-multi`,
`x-referential-source-by`/`-suffix`, `x-referential-source-by-value`,
`x-widget:"referential-multi-select"`, `x-format`, `x-show-when`/
`-values`, `x-label`, `x-group`/`x-groups`, `x-generated`, and
`x-widget:"referential-list"` itself (nested repeatable lists — Pack
`dependencies`, Checklist `items` — are explicitly NOT expressible in the
flat model today; the code comment calls this out as intentional, kept to
the raw-JSON advanced path).

A second, independent bug found along the way: `jsonSchemaToFieldList` /
`fieldListToJsonSchema` don't preserve any `x-*` key they don't know about,
so editing an existing field through the form today silently **drops**
whichever of the missing keywords that field already had. Not yet fixed;
folded into this redesign rather than patched twice.

## Design settled so far

Each widget kind = exactly one `GeneratedField`/`ReferentialListItemField`
kind from `formGenerator.ts`, carrying only the properties that kind's own
render/validate branch actually reads. `x-format` (markdown) is a property
of Text/Textarea widgets, not its own widget kind — it's orthogonal to
widget choice, same as it is in the real schema shape.

**Top-level (and reusable as item-level children of a Repeatable list):**

| Widget | Properties |
|---|---|
| Text | name, label, required, help, pattern, minLength, default, showWhen/showWhenValues, markdown flag |
| Textarea | same as Text |
| Version | name, label, required, help (value is system-generated, no author content) |
| Select (enum) | name, label, required, help, options (csv), default |
| Referential (single) | name, label, required, help, referentialSource, ontology, ontology-composable (shown only if ontology checked); "driven" mode nests a child list of `{matchValue → source/ontology/composable}` rows + a default row — covers both `x-referential-source-by`/`-suffix` (driver+suffix) and `x-referential-source-by-value` (full map) as nested children, not new top-level kinds |
| Referential (multi) | same as Referential (single), multi-select implied by kind — no separate `x-multi` needed here |
| JSON | name, label, required, help, array-or-object default |
| Repeatable list | name, label, required, help, x-group; children = any item-level kind below, unbounded nesting |

**Item-level only (children of a Repeatable list):**

Boolean, Generated (system-assigned, label/help only), Nested list (takes
its own children, recurses), Nested object (fixed sub-object, takes
children), Referential (dynamic) (driven by a sibling field in the same
row), Referential (by scope) (driven by a top-level field's value, nested
variants list).

**Schema-level (sibling of the field tree, not a field itself):**

Tab list (`x-groups`) — ordered `{key, label}` pairs; a widget's `x-group`
property picks one of these keys.

## Open — the real build decision

The existing field editor (`_referentialListGroup.ejs` +
`public/js/referentialListGroup.js`) renders one fixed level of rows; it has
no concept of a row containing another arbitrary-depth row-list. "Allow
nesting of widgets" needs a genuinely recursive tree editor: add a widget,
pick its kind, get that kind's property panel, and — if it's a Repeatable
list — an "add child widget" control inside it, to unbounded depth. This is
new client-side + template machinery, not a reuse of what exists today.

**Not yet decided:** build this as a new dedicated recursive editor
component (separate from `_referentialListGroup.ejs`/
`referentialListGroup.js`), given the existing generic list widget cannot do
arbitrary-depth nesting. Awaiting owner confirmation before scoping the
actual implementation (new EJS partial(s), new client-side JS, new
`AuthoredWidget` tree type replacing `AuthoredField`, and a real recursive
rewrite of `fieldListToJsonSchema`/`jsonSchemaToFieldList` as the tree ↔
`JsonSchemaProperty` compiler).

## Next step

Owner to confirm the widget-kind list above, then confirm the "new
dedicated recursive editor" build approach, before any code is written.
