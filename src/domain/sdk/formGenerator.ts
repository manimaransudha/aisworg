// SDK UI Layer Plan — "The grammar generates the form; dependency fields get
// a live widget on top." A field's shape in a schema_definitions row's JSON
// Schema document determines what control renders for it: string -> text
// input, enum -> select, x-widget:"json" -> a JSON textarea (used for shapes
// too deep to expand into individual controls yet, e.g. Pack's
// `contributions` — future grammar versions can expand these additively
// without a code change here), x-widget:"referential-list" -> a small
// repeatable-row widget whose item field(s) carrying x-referential resolve
// against the Registry (the one hand-built piece the plan calls for).
//
// Deliberately not a full JSON Schema implementation — just enough of the
// vocabulary this project's own grammars actually use (type/enum/pattern/
// required, plus the x-* extension keywords above) to drive both the
// generator here and the structural validator below from the same document.
export interface JsonSchemaDocument {
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchemaProperty>;
  // Full redesign (owner: "Policy UI has to be similar to Pack - Metadata tab
  // and other tabs grouped") — retires METADATA_FIELD_NAMES/
  // COMPATIBILITY_FIELD_NAMES/PACK_SELECTION_FIELD_NAMES/
  // DELIVERABLES_FIELD_NAMES/FIELD_DISPLAY_ORDER (hardcoded, name-based, one
  // shared order across every kind) in favour of the schema itself declaring
  // which simple-field-grid tabs it has, in order. Each entry becomes one
  // 'simple' tab in _generatedFieldGroups.ejs; a field joins one by its own
  // `x-group` (below). Adding a new tab (e.g. Policy's own Applicability/
  // Governance) is now a schema/data change, not a formGenerator.ts code
  // change. Exposable/Parameter-Overrides/Configuration-Parameters stay
  // their own name-detected singleton groups (below) — bespoke or
  // tenant-overridable-at-render-time enough not to fit this mechanism.
  "x-groups"?: Array<{ key: string; label: string }>;
  // Top-level counterpart to items["x-property-order"] below — same reason
  // (Postgres JSONB doesn't preserve object-key insertion order). Governs
  // order WITHIN whichever group/tab a field lands in (via x-group), not
  // across tabs, since tabs already separate fields regardless of their
  // relative position here. Fields not listed keep their (arbitrary,
  // post-JSONB-reorder) relative order, appended after every listed one.
  "x-property-order"?: string[];
  // CR-114 — an append-only log of {date, note} entries for schema AUTHORS
  // only ("why this version exists, what changed since the last one"), never
  // read by generateFields/validateAgainstSchema/parseFormBody below or by
  // any real authoring form. Same shape wherever it appears — also legal on
  // an individual JsonSchemaProperty (a note on one field) — location never
  // changes its meaning.
  "x-schema-notes"?: Array<{ date: string; note: string }>;
}

export interface JsonSchemaProperty {
  type?: string;
  enum?: string[];
  pattern?: string;
  minLength?: number;
  default?: unknown;
  // CR-088 (migration 167/207) — a schema-level annotation, not read by this
  // file at all: marks a field whose value cascades Pack -> Template ->
  // Profile and may be narrowed downstream, for whichever code owns that
  // cascade. Kept here only so the schema-registry's own compiler/editor
  // (schemaCompiler.ts) doesn't silently drop it on every field kind alike.
  "x-configurable"?: boolean;
  // "version" — CR-024, generalising Pack's originally hardcoded-by-field-name
  // `packVersion` convention (readonly, only advanced by a "Next version"
  // patch-bump button) into a real schema-driven widget, the same way
  // "textarea" generalised Template's `purpose`. Any semver-versioned kind
  // (Pack's `packVersion`, Template's `templateVersion`) marks its field this
  // way; the view dispatches on `kind === "version"`, never a field name.
  // CR-086/Ch.11 follow-on — Service Definition's own `consumers` (a flat
  // array of capability-name codes, zero-or-more, no per-row shape worth
  // wrapping into objects the way Template's Pack-code lists do): the
  // top-level counterpart to "referential-select" for a field that picks
  // several values instead of one, same x-ontology/x-referential-source
  // markers as that widget, rendered as a real <select multiple> instead of
  // a repeatable-row widget.
  "x-widget"?: "json" | "referential-list" | "referential-select" | "referential-multi-select" | "textarea" | "version" | "db-select";
  "x-referential"?: string;
  // CR-114 follow-on — reused verbatim by "db-select" (below) to name which
  // DB-sourced option list to resolve, the same way it names an
  // Ontology/registry source for "referential-select". A "db-select" field
  // is referential in the same sense as "referential-select", just sourced
  // from a plain DB query (schemaDefinitionsDB.findAllVersions today) rather
  // than Ontology/a fixed registry — one generic widget kind so any future
  // "pick a value out of some DB table" field reuses this instead of a new
  // one-off widget (owner: rename from the original "schema-version-select").
  "x-referential-source"?: string;
  // CR-060 — Review/Quality Gate's own checklistIds: a referential-list
  // ITEM field (x-referential set) that picks more than one value rather
  // than exactly one. Every referential field before this picked a single
  // value; x-multi is what tells generateFields to build a multi-select
  // (kind: "referential-multi") instead of a single <select>.
  "x-multi"?: boolean;
  // Owner (2026-08-19): "do not hard code in the schema. The schema has to
  // pick the values from the ontology" — when true, `x-referential-source`
  // is not an arbitrary registry key but the exact Ontology (Ch.18)
  // `concept_type` to resolve options from (ontologyConceptTypesIn / the
  // route's generic ontology-options loader below). Applies uniformly to
  // Pack/Template/Profile — which fields are ontology-backed is entirely a
  // schema fact, never a per-field-name branch in code.
  "x-ontology"?: boolean;
  // Owner: "I want to have a flag in the schema that will specify if an
  // Ontology Composition is allowed instead of a blanket x-referential
  // option" — a field being Ontology-backed (x-ontology) is a separate fact
  // from whether a user may propose a NEW value into that Ontology category.
  // Only meaningful alongside x-widget:"referential-multi-select" (a
  // multi-value field lets each entry be picked-existing or typed-new, same
  // shape CR-100's single-value combo box already established, just N
  // values instead of 1) and x-ontology:true. When true, the widget accepts
  // free text in addition to picking existing options, and any typed value
  // that doesn't resolve to a real concept triggers OntologyComposed (Ch.18
  // §8) instead of being rejected outright. Per-field, not automatic for
  // every x-ontology field — a closed vocabulary (e.g. Policy's own
  // `category`) stays reject-on-unregistered with no propose path.
  "x-ontology-composable"?: boolean;
  // CR-079 step (d) — this field's Ontology concept type isn't fixed; it's
  // derived from another field's CURRENT value on this same schema (Pack's
  // own `code`, driven by `category`: category "Technology" -> concept type
  // "technology-name"). x-referential-source-by names the driver field;
  // x-referential-source-suffix is appended to the driver's own value,
  // lowercased. Mutually exclusive with a fixed x-referential-source on the
  // same field — a field is either always one concept type, or driven.
  // Owner: "Category has to be the first field... From what gets chosen
  // there, code dropdown has to be generated."
  "x-referential-source-by"?: string;
  "x-referential-source-suffix"?: string;
  // A field whose valid values are a live-computed subset of some other
  // concept type, derived from OTHER data already entered earlier in this
  // same document — not a sibling's single current value (x-referential-
  // source-by) and not raw rows copied off another field (`self:` inside
  // x-referential, sdkAuthoring.ts's loadSelfReferentialOptions), but a named,
  // registered derivation function (e.g. Template's fromCapabilityCode:
  // whichever capability-name codes the currently-selected Packs actually
  // contribute — sdkAuthoring.ts's loadDerivedPackCapabilityOptions). The
  // named value is the derivation's registered key; there is no schema-level
  // way to express the computation itself, only to name which one applies.
  // Item-level only (dependencyGraph's own fromCapabilityCode is the first
  // user).
  "x-referential-source-derived-by"?: string;
  // Owner: "If the scope is Transition, the applicable deliverable names
  // will be ontology driven deliverable names. If the scope is eligibility,
  // the nouns (SEU, Ontology etc.) should be in the dropdown" — Policy's own
  // applicabilityDeliverableNames repurposed by scope's current value (CR-104
  // owner: "is an implementation detail and not in the spec explicitly," so
  // reusing rather than inventing a second field). Unlike
  // x-referential-source-by/-suffix (a computed SUFFIX on the driver's own
  // value — same concept KIND either way, e.g. Pack's code), this is a
  // discrete jump between entirely different sources — one Ontology-backed,
  // one a plain Registry list — keyed by the driver field's exact value.
  // Falls back to `default` for any value not named (including empty/unset).
  "x-referential-source-by-value"?: {
    field: string;
    values: Record<string, { source: string; ontology: boolean; composable?: boolean }>;
    default: { source: string; ontology: boolean; composable?: boolean };
  };
  "x-help"?: string;
  // Owner (Policy condition redesign): "identifier: system generated" —
  // exceptionRules[].identifier is assigned server-side on save
  // (sdkAuthoring.ts's toPolicyConditions), never author-typed. Renders
  // read-only (a hidden input carrying the existing value plus a plain-text
  // display), same reasoning packVersion's own "Editable text is not the
  // correct approach" already established for a different generated field.
  "x-generated"?: boolean;
  // CR-077 — a long-text field authored in Markdown (Checklist/Quality Gate/
  // Review Gate/Obligation Definition's own statement/prompt). Orthogonal to
  // x-widget (which picks the control SHAPE — input/textarea/referential-list);
  // this picks content semantics layered on a string-kind field, top-level or
  // nested-list item. Edit mode gets a formatting toolbar; view mode renders
  // through marked+sanitize-html (domain/sdk/markdownRender.ts) instead of a
  // plain pre-wrap div. No live preview yet — CR-078, deferred.
  "x-format"?: "markdown";
  // CR-067 — "when a composition strategy is chosen, the UI widget should
  // appear." Generic conditional-reveal: names another field on this SAME
  // schema; this field stays hidden in the authoring form until that other
  // field has a value. Entity-agnostic (keys off a field NAME, not
  // "compositionStrategy" specifically) — pointing Template's own schema at
  // the same two markers later needs no new route/view/JS code.
  "x-show-when"?: string;
  // Owner (GoverningCondition structured UI): "make the GoverningCondition
  // UI user friendly and not a json edit" — x-show-when's existing "named
  // sibling field is truthy" semantics extended with an exact-value-membership
  // form: when set alongside x-show-when, this field stays hidden until the
  // named sibling's CURRENT value is one of these (not merely non-empty) —
  // e.g. `field`/`operator`/`value`/`values` only show once `type` picks a
  // real condition type, and only the ones that type actually uses. Reuses
  // edit.ejs's existing generic [data-show-when] mechanism (extended, not
  // replaced) rather than a second widget.
  "x-show-when-values"?: string[];
  // Owner (CR-058 form redesign): "the form is very very poorly designed" —
  // per-item-field help/required/label were previously only meaningful at
  // the top level of a field (e.g. contributionQualityGates' own x-help,
  // shown once above the whole repeatable list); items.properties.someField
  // never carried its own. x-label overrides the auto-derived label
  // (labelize(fieldName)) when the field name doesn't read well as one
  // (e.g. `statement` -> "Description" for Quality Gates specifically).
  "x-label"?: string;
  // Which of the schema's own top-level x-groups (above) this field displays
  // under — e.g. Policy's `code`/`name`/`description`/`category`/
  // `constraintType` all declare "metadata", `conditions`/`scope`/
  // `governedTransition`/`governingCondition` declare "governance". A field
  // with no x-group (or one not declared in x-groups) falls into the
  // generic "other" catch-all, appended to the first declared group's tab.
  "x-group"?: string;
  // Postgres JSONB does not preserve object key insertion order — it
  // reorders keys by length then lexicographically (confirmed live: a
  // migration writing category/name/governedTransition/... came back as
  // name/prompt/category/assurance/statement/... — exactly sorted by key
  // length). schema.properties/items.properties key order was therefore
  // never actually controllable via how a migration writes the JSON, for
  // ANY referential-list field, not just this one. x-property-order is the
  // explicit fix: an ordered name list generateFields sorts itemFields by;
  // fields not listed fall back to whatever (post-JSONB-reorder) order they
  // came in, appended at the end.
  items?: JsonSchemaProperty & { properties?: Record<string, JsonSchemaProperty>; required?: string[]; "x-property-order"?: string[] };
  // A single nested sub-object (Policy condition's own `requiredEvidence`),
  // as opposed to `items` above (a repeatable sub-LIST, Checklist's own
  // `items`). `type: "object"` + `properties` set (no `items`) is what
  // buildItemFields dispatches on to tell the two apart.
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  "x-property-order"?: string[];
  // CR-114 — see JsonSchemaDocument's own "x-schema-notes" above; same shape,
  // legal on a single property too (a note on that one field).
  "x-schema-notes"?: Array<{ date: string; note: string }>;
}

// A referential-list row's fields, generically — referentialSource set means
// "render a Registry-backed <select> sourced from this key," same as a
// top-level referential-select field, so the view never needs to know a
// specific field name like "packCode" to decide how to render it.
// CR-017 — a repeatable-list item field renders per its `kind`: a Registry-backed
// <select> (referential), a fixed <select> (enum), a checkbox (boolean), or a
// text input (string). This is what lets a repeatable list author real structured
// rows (e.g. a schema's field list), not just strings.
//
// CR-058 form redesign — required/help/label read from the item's own
// x-help/x-label/items.required (never a per-field-name branch in code,
// same discipline x-ontology already established for top-level fields).
// CR-060 — two additions, both first needed by Checklist/checklistIds:
// "referential-multi" (a referential field that picks several values, not
// one — Review/Quality Gate's own checklistIds) and "nested-list" (an item
// field that is itself its own repeatable sub-list — Checklist's own
// `items`, the first two-level referential-list in this codebase).
// nestedItemFields mirrors the parent's own itemFields shape recursively;
// only meaningful when kind === "nested-list".
export interface ReferentialListItemField {
  name: string;
  kind: "string" | "enum" | "boolean" | "referential" | "referential-multi" | "nested-list" | "nested-object" | "generated" | "json" | "referential-dynamic" | "referential-by-scope";
  referentialSource?: string;
  options?: string[];
  required?: boolean;
  help?: string;
  label?: string;
  // "referential-by-scope" only: this item field's own source switches by a
  // TOP-LEVEL (not sibling-item) field's current value — Policy's own
  // applicabilityDeliverables[].name, driven by the top-level `scope`
  // (formGenerator.ts's x-referential-source-by-value at the item level).
  // Real, live client-side toggle (scopeDrivenMulti.js), same as the
  // top-level driven multi-select.
  scopeVariants?: Array<{ matchValue: string | null; referentialSource: string; ontology: boolean }>;
  // CR-100 — "referential-dynamic" only: this field's concept type is driven
  // by a SIBLING item field's current value within the same row (Competency's
  // `value`, driven by its own row's `dimension`) — the item-level analogue
  // of a top-level referential-select's dynamicSourceField/dynamicSourceSuffix.
  // driverField names the sibling field, not a top-level schema property.
  driverField?: string;
  driverSuffix?: string;
  // CR-077 — true when this item field's schema carries x-format:"markdown"
  // (statement/prompt today). Drives the edit-mode toolbar and the view-mode
  // renderMarkdown call in _referentialListGroup.ejs; independent of `full`
  // (which only decides textarea-vs-input sizing).
  markdown?: boolean;
  // True when a "referential" item field's schema also carries x-ontology —
  // its options resolve through Ontology (code+label+description), the same
  // way a top-level referential-select does, rather than the flat
  // referentialOptions[] string list every other item-level referential
  // field (governedTransition, checklistIds, ...) still uses.
  ontology?: boolean;
  nestedItemFields?: ReferentialListItemField[];
  // GoverningCondition structured UI — a sibling field NAME within the same
  // nested-object/nested-list item (bare, unresolved to a full input name;
  // the view resolves it to this row's own full path the same way it
  // already computes nestedInputName). showWhenValues, when set, narrows
  // "sibling is truthy" to "sibling's current value is one of these."
  showWhen?: string;
  showWhenValues?: string[];
}

export type GeneratedField =
  | { kind: "string"; name: string; label: string; required: boolean; value: string; help?: string; showWhen?: string; group?: string }
  // Same free-text field as "string" — multi-line box instead of a
  // single-line input (owner: Template's `purpose`, a few sentences of
  // author-written guidance, not a slug).
  | { kind: "textarea"; name: string; label: string; required: boolean; value: string; help?: string; showWhen?: string; group?: string }
  // Readonly, semver, advanced only by its own "Next version" button — never
  // hand-typed (owner: "Editable text is not the correct approach").
  | { kind: "version"; name: string; label: string; required: boolean; value: string; help?: string; showWhen?: string; group?: string }
  | { kind: "select"; name: string; label: string; required: boolean; value: string; options: string[]; help?: string; showWhen?: string; group?: string }
  // CR-079 step (d) — dynamicSourceField/dynamicSourceSuffix are set only
  // when x-referential-source-by drives this field's concept type from
  // another field's current value; the view renders a free-text-capable
  // <input list>/<datalist> instead of a fixed <select> and swaps its
  // options client-side when the named driver field changes.
  | { kind: "referential-select"; name: string; label: string; required: boolean; value: string; referentialSource: string; ontology: boolean; help?: string; showWhen?: string; dynamicSourceField?: string; dynamicSourceSuffix?: string; dynamicSourceDriverConceptType?: string; group?: string }
  // CR-114 follow-on — a value picked from a plain DB-sourced option list
  // (not Ontology/registry-backed, so no `ontology` flag). `dbSource` names
  // which loader-resolved list (web/sdkAuthoring.ts's dbSelectOptions map,
  // parallel to referentialOptions) supplies {value,label} options — value
  // and label differ here (e.g. a schema_definitions row's id vs. "v3"),
  // unlike every referentialOptions[] entry today where they're the same string.
  | { kind: "db-select"; name: string; label: string; required: boolean; value: string; dbSource: string; help?: string; showWhen?: string; group?: string }
  // CR-086/Ch.11 follow-on — Service Definition's `consumers`: same
  // referential-source/ontology shape as "referential-select", but `value`
  // is the array of every currently-selected code, not just one.
  // driverField/variants: only set when x-referential-source-by-value drives
  // this field (Policy's applicabilityDeliverableNames, by `scope`) — the
  // view renders one sub-widget per variant and swaps which is live/visible
  // client-side the instant the driver field changes, no reload needed (same
  // standard the single-value driven referential-select already meets).
  // matchValue: null is the `default` variant (shown whenever the driver's
  // current value matches no named override).
  | { kind: "referential-multi-select"; name: string; label: string; required: boolean; value: string[]; referentialSource: string; ontology: boolean; composable: boolean; help?: string; showWhen?: string; group?: string; driverField?: string; variants?: Array<{ matchValue: string | null; referentialSource: string; ontology: boolean; composable: boolean }> }
  | { kind: "json"; name: string; label: string; required: boolean; value: string; help?: string; showWhen?: string; group?: string }
  // Bug fix (UI redesign, owner: "extremely unfriendly"): `existingCount` marks
  // how many of `rows` are the content's OWN rows vs. blank ones offered so an
  // author has somewhere to add a new one — the view uses this to render
  // existing rows as filled cards and put exactly one blank "template" row
  // behind an "+ Add another" control, instead of always showing 3 blank rows
  // (of up to 12 fields each) fully expanded regardless of whether the Pack
  // uses that contribution type at all.
  // CR-060 — a row's value for a "referential-multi" item field is
  // string[] (the selected ids); for a "nested-list" item field it's
  // Array<Record<string, string>> (the sub-item rows, same shape one level
  // down). Every pre-existing item field kind still only ever produces a
  // plain string, so this is additive, not a breaking widen of every field.
  | { kind: "referential-list"; name: string; label: string; required: boolean; rows: Array<Record<string, RowValue>>; itemFields: ReferentialListItemField[]; existingCount: number; showWhen?: string; group?: string };

// Blank slots appended after however many the content already has, so the
// form always offers a place to add one more without needing client-side JS
// to insert the FIRST row. Kept to one (not several) — the authoring UI's own
// "+ Add another" control (edit.ejs) clones this one client-side rather than
// pre-rendering a pile of blanks nobody asked for.
const BLANK_ROWS_TO_OFFER = 1;

function labelize(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

// CR-060 — extracted so a "nested-list" item field (Checklist's own `items`,
// itself a repeatable sub-list) can recurse into its own sub-item schema the
// exact same way the top-level referential-list field builds itemFields —
// one function, not a second hand-copied item-field builder.
function buildItemFields(itemProps: Record<string, JsonSchemaProperty>, itemRequired: Set<string>): ReferentialListItemField[] {
  return Object.entries(itemProps).map(([fieldName, fieldDef]) => {
    const common = { required: itemRequired.has(fieldName), help: fieldDef["x-help"], label: fieldDef["x-label"] ?? labelize(fieldName), markdown: fieldDef["x-format"] === "markdown", showWhen: fieldDef["x-show-when"], showWhenValues: fieldDef["x-show-when-values"] };
    if (fieldDef.type === "array" && fieldDef.items?.properties) {
      const nestedRequired = new Set(fieldDef.items.required ?? []);
      const nestedItemFields = buildItemFields(fieldDef.items.properties, nestedRequired);
      const nestedOrder = fieldDef.items["x-property-order"];
      if (nestedOrder?.length) {
        const rank = new Map(nestedOrder.map((n, i) => [n, i]));
        nestedItemFields.sort((a, b) => (rank.get(a.name) ?? nestedOrder.length) - (rank.get(b.name) ?? nestedOrder.length));
      }
      return { name: fieldName, kind: "nested-list" as const, nestedItemFields, ...common };
    }
    // Owner (Policy condition redesign): "Required evidence will be an
    // object by itself" — a single sub-object, not a repeatable sub-list
    // (Checklist's own `items` precedent is for an ARRAY of sub-rows; this
    // is the singular counterpart, one fixed set of sub-fields, no add/
    // remove). Recurses through buildItemFields exactly like nested-list
    // does, just keyed by `type: "object"` + `properties` rather than
    // `type: "array"` + `items.properties`.
    if (fieldDef.type === "object" && fieldDef.properties) {
      const nestedRequired = new Set(fieldDef.required ?? []);
      const nestedItemFields = buildItemFields(fieldDef.properties, nestedRequired);
      const nestedOrder = fieldDef["x-property-order"];
      if (nestedOrder?.length) {
        const rank = new Map(nestedOrder.map((n, i) => [n, i]));
        nestedItemFields.sort((a, b) => (rank.get(a.name) ?? nestedOrder.length) - (rank.get(b.name) ?? nestedOrder.length));
      }
      return { name: fieldName, kind: "nested-object" as const, nestedItemFields, ...common };
    }
    if (fieldDef["x-generated"]) return { name: fieldName, kind: "generated" as const, ...common };
    // Policy condition redesign — governingCondition folded into each
    // condition row (owner: "Governing condition has to be folded into
    // condition"). Same shape/purpose as the top-level x-widget:"json"
    // field kind, just at item-field depth — a small JSON textarea, no
    // structured decomposition (the value is a variable-shaped union,
    // {"type":"always_true"} or {"type":"field_in", field, values}).
    if (fieldDef["x-widget"] === "json") return { name: fieldName, kind: "json" as const, ...common };
    // Owner: "Add only deliverable name and allow multiple transitions" —
    // Policy's own applicabilityDeliverables[].name, item-level counterpart
    // of the top-level x-referential-source-by-value (Policy's old flat
    // applicabilityDeliverableNames): switches between an Ontology source
    // and a plain Registry source by the TOP-LEVEL `scope` field's current
    // value, not a sibling item field's. Checked before x-referential-source-by
    // (a sibling-driven derivation) and the plain x-referential case below.
    if (fieldDef["x-referential-source-by-value"]) {
      const byValue = fieldDef["x-referential-source-by-value"];
      return {
        name: fieldName,
        kind: "referential-by-scope" as const,
        driverField: byValue.field,
        scopeVariants: [
          { matchValue: null, referentialSource: byValue.default.source, ontology: byValue.default.ontology },
          ...Object.entries(byValue.values).map(([matchValue, v]) => ({ matchValue, referentialSource: v.source, ontology: v.ontology })),
        ],
        ...common,
      };
    }
    // CR-100 — Competency's own `value`: driven by the sibling `dimension`
    // field's current value, not a fixed concept type. Checked before the
    // plain x-referential case below since a driven field carries no
    // x-referential of its own.
    if (fieldDef["x-referential-source-by"]) {
      return { name: fieldName, kind: "referential-dynamic" as const, driverField: fieldDef["x-referential-source-by"], driverSuffix: fieldDef["x-referential-source-suffix"] ?? "", ontology: true, ...common };
    }
    // Checked alongside the plain x-referential case below — mutually
    // exclusive with it (a field is either a fixed/named registry key or a
    // named derivation, never both). Renders through the same "referential"
    // kind/picker as plain x-referential; referentialSource carries a
    // "derived:" prefix so the existing referentialOptions[...] lookup (view
    // + sdkAuthoring.ts) resolves it with no further change.
    if (fieldDef["x-referential-source-derived-by"]) {
      return { name: fieldName, kind: "referential" as const, referentialSource: `derived:${fieldDef["x-referential-source-derived-by"]}`, ontology: false, ...common };
    }
    if (fieldDef["x-referential"] && fieldDef["x-multi"]) return { name: fieldName, kind: "referential-multi" as const, referentialSource: fieldDef["x-referential"], ...common };
    if (fieldDef["x-referential"]) return { name: fieldName, kind: "referential" as const, referentialSource: fieldDef["x-referential"], ontology: fieldDef["x-ontology"] === true, ...common };
    if (fieldDef.enum) return { name: fieldName, kind: "enum" as const, options: fieldDef.enum, ...common };
    if (fieldDef.type === "boolean") return { name: fieldName, kind: "boolean" as const, ...common };
    return { name: fieldName, kind: "string" as const, ...common };
  });
}

// CR-060 — builds one referential-list row's value map from raw content,
// dispatching per item-field kind: "nested-list" recurses (via buildRow
// itself) into an array of sub-item rows with one blank template appended
// at the end (same BLANK_ROWS_TO_OFFER=1 convention the top level already
// uses — the view treats a nested-list array's LAST element as the clone
// template, the rest as real content); "referential-multi" keeps its raw
// array of selected ids as string[]; everything else stays a plain string,
// unchanged from before this function was extracted.
type RowValue = string | string[] | RowValueMap[] | RowValueMap;
interface RowValueMap {
  [key: string]: RowValue;
}

function buildRow(
  row: Record<string, unknown>,
  itemFields: ReferentialListItemField[],
  itemProps?: Record<string, JsonSchemaProperty>
): Record<string, RowValue> {
  const out: Record<string, RowValue> = {};
  for (const field of itemFields) {
    const raw = row[field.name];
    if (field.kind === "nested-list") {
      const nestedFields = field.nestedItemFields ?? [];
      const nestedRows = Array.isArray(raw)
        ? (raw as Array<Record<string, unknown>>).map((r) => buildRow(r, nestedFields))
        : [];
      nestedRows.push(buildRow({}, nestedFields));
      out[field.name] = nestedRows;
    } else if (field.kind === "nested-object") {
      // Owner: "Required evidence will be an object by itself" — one fixed
      // sub-object, not a repeatable sub-list; no blank-template-row
      // convention needed (there's nothing to "+ Add another" of).
      const nestedFields = field.nestedItemFields ?? [];
      out[field.name] = buildRow((raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}), nestedFields);
    } else if (field.kind === "referential-multi") {
      out[field.name] = Array.isArray(raw) ? raw.map(String) : [];
    } else if (field.kind === "json") {
      out[field.name] = raw !== undefined && raw !== null ? JSON.stringify(raw, null, 2) : "{}";
    } else {
      out[field.name] = raw !== undefined ? String(raw) : String(itemProps?.[field.name]?.default ?? "");
    }
  }
  return out;
}

export function generateFields(schema: JsonSchemaDocument, content: Record<string, unknown>): GeneratedField[] {
  const required = new Set(schema.required ?? []);
  const fields: GeneratedField[] = [];

  // Full redesign — top-level x-property-order governs order WITHIN
  // whichever group a field lands in (groupFieldsForDisplay, below); fields
  // not listed keep their arbitrary post-JSONB-reorder relative order,
  // appended after every listed one (Array.sort is stable in Node).
  let entries = Object.entries(schema.properties ?? {});
  const topOrder = schema["x-property-order"];
  if (topOrder?.length) {
    const rank = new Map(topOrder.map((n, i) => [n, i]));
    entries = entries
      .map((entry, i) => ({ entry, i }))
      .sort((a, b) => {
        const ra = rank.get(a.entry[0]) ?? topOrder.length + a.i;
        const rb = rank.get(b.entry[0]) ?? topOrder.length + b.i;
        return ra - rb;
      })
      .map(({ entry }) => entry);
  }

  for (const [name, def] of entries) {
    const isRequired = required.has(name);
    const rawValue = content[name];
    const group = def["x-group"];

    if (def["x-widget"] === "json") {
      // Bug fix: default to the field's own declared shape — "[]" for an
      // array-typed field, "{}" otherwise — not always "{}". A new draft with
      // no existing value for an array-typed json field (e.g. Template's
      // deliverableCatalogue) previously rendered/submitted a literal "{}",
      // which downstream code that iterates the parsed value (`for...of`)
      // then threw on ("object is not iterable").
      const emptyDefault = def.type === "array" ? "[]" : "{}";
      fields.push({ kind: "json", name, label: labelize(name), required: isRequired, value: rawValue !== undefined ? JSON.stringify(rawValue, null, 2) : emptyDefault, help: def["x-help"], showWhen: def["x-show-when"], group });
      continue;
    }

    if (def["x-widget"] === "referential-list") {
      const itemProps = def.items?.properties ?? {};
      const itemRequired = new Set(def.items?.required ?? []);
      const itemFields = buildItemFields(itemProps, itemRequired);
      const propertyOrder = def.items?.["x-property-order"];
      if (propertyOrder?.length) {
        const rank = new Map(propertyOrder.map((n, i) => [n, i]));
        itemFields.sort((a, b) => (rank.get(a.name) ?? propertyOrder.length) - (rank.get(b.name) ?? propertyOrder.length));
      }
      const existingRows = Array.isArray(rawValue) ? (rawValue as Array<Record<string, unknown>>) : [];
      const rows = existingRows.map((row) => buildRow(row, itemFields, itemProps));
      const existingCount = rows.length;
      for (let i = 0; i < BLANK_ROWS_TO_OFFER; i++) {
        rows.push(buildRow({}, itemFields, itemProps));
      }
      fields.push({ kind: "referential-list", name, label: labelize(name), required: isRequired, rows, itemFields, existingCount, showWhen: def["x-show-when"], group });
      continue;
    }

    if (def["x-widget"] === "referential-multi-select") {
      // Owner: "If the scope is Transition, the applicable deliverable names
      // will be ontology driven deliverable names. If the scope is
      // eligibility, the nouns... should be in the dropdown" — resolved off
      // the driver field's CURRENT value on this same content, same timing
      // discipline the single-value driven referential-select already uses.
      const byValue = def["x-referential-source-by-value"];
      const resolved = byValue
        ? (byValue.values[String(content[byValue.field] ?? "")] ?? byValue.default)
        : { source: def["x-referential-source"] ?? "", ontology: def["x-ontology"] === true, composable: def["x-ontology-composable"] === true };
      fields.push({
        kind: "referential-multi-select", name, label: labelize(name), required: isRequired,
        value: Array.isArray(rawValue) ? rawValue.filter((v): v is string => typeof v === "string") : [],
        referentialSource: resolved.source,
        ontology: resolved.ontology,
        composable: resolved.ontology && resolved.composable === true,
        help: def["x-help"], showWhen: def["x-show-when"], group,
        driverField: byValue?.field,
        variants: byValue
          ? [
              { matchValue: null, referentialSource: byValue.default.source, ontology: byValue.default.ontology, composable: byValue.default.ontology && byValue.default.composable === true },
              ...Object.entries(byValue.values).map(([matchValue, v]) => ({ matchValue, referentialSource: v.source, ontology: v.ontology, composable: v.ontology && v.composable === true })),
            ]
          : undefined,
      });
      continue;
    }

    if (def["x-widget"] === "referential-select") {
      const driverField = def["x-referential-source-by"];
      const driverSuffix = def["x-referential-source-suffix"] ?? "";
      // CR-079 step (d) — a driven field's concept type is computed from the
      // driver's CURRENT value on this same content, not a fixed schema
      // string; empty (no options yet) until the driver itself has a value.
      const referentialSource = driverField
        ? (() => {
            const driverValue = String(content[driverField] ?? "").trim();
            return driverValue ? `${driverValue.toLowerCase()}${driverSuffix}` : "";
          })()
        : (def["x-referential-source"] ?? "");
      fields.push({
        kind: "referential-select", name, label: labelize(name), required: isRequired,
        value: rawValue !== undefined ? String(rawValue) : "",
        referentialSource,
        ontology: def["x-ontology"] === true,
        help: def["x-help"],
        showWhen: def["x-show-when"],
        dynamicSourceField: driverField,
        dynamicSourceSuffix: driverField ? driverSuffix : undefined,
        // The driver's OWN concept type (e.g. category:pack) — lets the view
        // enumerate every possible driver value to pre-build the client-side
        // options-by-driver-value map, without cross-referencing the
        // driver's own generated field.
        dynamicSourceDriverConceptType: driverField ? schema.properties?.[driverField]?.["x-referential-source"] : undefined,
        group,
      });
      continue;
    }

    // CR-114 follow-on — a plain DB-sourced picker (schema version today).
    // dbSource just carries x-referential-source through unresolved; the web
    // layer resolves it against its own dbSelectOptions map (parallel to
    // referentialOptions), the same division of labour "referential-select"
    // already uses for Ontology/registry sources.
    if (def["x-widget"] === "db-select") {
      fields.push({ kind: "db-select", name, label: labelize(name), required: isRequired, value: rawValue !== undefined ? String(rawValue) : "", dbSource: def["x-referential-source"] ?? "", help: def["x-help"], showWhen: def["x-show-when"], group });
      continue;
    }

    if (def["x-widget"] === "textarea") {
      fields.push({ kind: "textarea", name, label: labelize(name), required: isRequired, value: rawValue !== undefined ? String(rawValue) : "", help: def["x-help"], showWhen: def["x-show-when"], group });
      continue;
    }

    if (def["x-widget"] === "version") {
      fields.push({ kind: "version", name, label: labelize(name), required: isRequired, value: rawValue !== undefined ? String(rawValue) : "", help: def["x-help"], showWhen: def["x-show-when"], group });
      continue;
    }

    if (def.enum) {
      // Bug fix (owner: "Scope has to default to Transition") — unlike the
      // referential-list item default (buildRow, above) and parseFormBody's
      // own default fallback, this top-level enum branch never read
      // `def.default` at all, so a genuinely new draft always rendered the
      // blank "— select —" option first, even for a field with a real
      // schema-declared default — the browser then submits that blank value
      // untouched, since a native <select> always submits whichever
      // <option> is marked selected (the first, absent any other).
      fields.push({ kind: "select", name, label: labelize(name), required: isRequired, value: rawValue !== undefined ? String(rawValue) : String(def.default ?? ""), options: def.enum, help: def["x-help"], showWhen: def["x-show-when"], group });
      continue;
    }

    fields.push({ kind: "string", name, label: labelize(name), required: isRequired, value: rawValue !== undefined ? String(rawValue) : "", help: def["x-help"], showWhen: def["x-show-when"], group });
  }

  return fields;
}

// Every distinct Ontology concept_type a schema needs option values for —
// purely a scan of the schema's own `x-ontology`/`x-referential-source`
// markers (owner: "the schema has to pick the values from the ontology...
// use a generic function so this is still driven by the schema"). One
// function for Pack, Template, and Profile alike — a new ontology-backed
// field on any of them is a schema change only, never a new loader.
// 2026-09-05 (CR-088 prerequisite) — walks item properties to unbounded
// depth, not just one level down. Checklist's own new configurableKey/
// configurableValue (contributionChecklists[].items[].configurableKey) sit
// TWO levels below schema.properties — contributionChecklists is itself a
// referential-list whose own item field `items` is ANOTHER referential-list
// (CR-060's "first two-level referential-list") — so the single-level scan
// this replaces would silently never find them, leaving their dropdown
// empty despite buildItemFields (which already recurses fully) rendering
// the field itself correctly.
function collectOntologyTypesFromItemProps(itemProps: Record<string, JsonSchemaProperty>, types: Set<string>): void {
  for (const itemDef of Object.values(itemProps)) {
    if (itemDef["x-referential"] && itemDef["x-ontology"] === true) {
      types.add(itemDef["x-referential"].trim());
    }
    if (itemDef.type === "array" && itemDef.items?.properties) {
      collectOntologyTypesFromItemProps(itemDef.items.properties, types);
    }
  }
}

// Owner: "flag in the schema that will specify if an Ontology Composition
// is allowed" — every field a draft-save should check for unregistered
// entries and propose (rather than reject) via OntologyComposed, generic
// over kind. Covers both widget shapes: "referential-multi-select" (multi:
// true — a draft-save call site loops the current content's own array
// value) and single-value "referential-select" (multi: false — e.g. Pack's
// own `code`, owner: "Pack's code also has to be marked
// x-ontology-composable and reuse what is built"). `resolveConceptType`
// handles both a fixed x-referential-source and a DRIVEN one
// (x-referential-source-by — Pack's own `code`, driven by `category`),
// mirroring generateFields' own referential-select resolution above so the
// two never drift apart.
export function ontologyComposableFieldsIn(schema: JsonSchemaDocument): Array<{ fieldName: string; multi: boolean; resolveConceptType: (content: Record<string, unknown>) => string }> {
  const result: Array<{ fieldName: string; multi: boolean; resolveConceptType: (content: Record<string, unknown>) => string }> = [];
  for (const [name, def] of Object.entries(schema.properties ?? {})) {
    const multi = def["x-widget"] === "referential-multi-select";
    if (!multi && def["x-widget"] !== "referential-select") continue;
    const byValue = def["x-referential-source-by-value"];
    if (byValue) {
      // Owner: "the applicable deliverable names will be ontology driven...
      // If the scope is eligibility, the nouns... should be in the
      // dropdown" — a field whose Ontology-ness itself switches by a driver
      // field's value (Policy's applicabilityDeliverableNames: Ontology
      // deliverable-name for scope=Transition, a plain non-Ontology noun
      // list for scope=Eligibility) must resolve PER SUBMISSION, never
      // proposing a noun code as an unregistered deliverable-name.
      result.push({
        fieldName: name,
        multi,
        resolveConceptType: (content) => {
          const resolved = byValue.values[String(content[byValue.field] ?? "")] ?? byValue.default;
          return resolved.ontology && resolved.composable ? resolved.source : "";
        },
      });
      continue;
    }
    if (def["x-ontology"] !== true || def["x-ontology-composable"] !== true) continue;
    const driverField = def["x-referential-source-by"];
    const driverSuffix = def["x-referential-source-suffix"] ?? "";
    const fixedSource = (def["x-referential-source"] ?? "").trim();
    if (!driverField && !fixedSource) continue;
    result.push({
      fieldName: name,
      multi,
      resolveConceptType: (content) => {
        if (!driverField) return fixedSource;
        const driverValue = String(content[driverField] ?? "").trim();
        return driverValue ? `${driverValue.toLowerCase()}${driverSuffix}` : "";
      },
    });
  }
  return result;
}

export function ontologyConceptTypesIn(schema: JsonSchemaDocument): string[] {
  const types = new Set<string>();
  for (const def of Object.values(schema.properties ?? {})) {
    if ((def["x-widget"] === "referential-select" || def["x-widget"] === "referential-multi-select") && def["x-ontology"] === true && (def["x-referential-source"] ?? "").trim()) {
      types.add(def["x-referential-source"]!.trim());
    }
    // Owner: "capability code is from a dropdown of capability-name" (Pack's
    // own contributionCapabilities) — a referential-list ITEM field can be
    // Ontology-backed too (x-referential + x-ontology, mirrored one level
    // down from the top-level marker pair above), needed so its options
    // carry a real label/description instead of the bare code every other
    // item-level referential field (governedTransition, checklistIds, ...)
    // still shows.
    if (def["x-widget"] === "referential-list" && def.items?.properties) {
      collectOntologyTypesFromItemProps(def.items.properties, types);
    }
  }
  return [...types];
}

// CR-079 step (d) — every field whose concept type is DRIVEN by another
// field's value (x-referential-source-by), rather than fixed. The route's
// loader (web/sdkAuthoring.ts's loadOntologyOptions) uses this to pre-fetch
// every POSSIBLE concept type — not just whichever matches today's saved
// value — since the author can change the driver field in the browser
// before saving, and the client-side swap has no server round trip.
export function dynamicReferentialSourceFieldsIn(schema: JsonSchemaDocument): Array<{ driverField: string; suffix: string }> {
  const result: Array<{ driverField: string; suffix: string }> = [];
  for (const def of Object.values(schema.properties ?? {})) {
    const driverField = def["x-referential-source-by"];
    if (def["x-widget"] === "referential-select" && def["x-ontology"] === true && driverField) {
      result.push({ driverField, suffix: def["x-referential-source-suffix"] ?? "" });
    }
  }
  return result;
}

// CR-100 — the item-level analogue of dynamicReferentialSourceFieldsIn above,
// for a referential-list ROW field driven by a SIBLING item field (Competency's
// `value`, driven by its own row's `dimension`) rather than a top-level schema
// property. Unlike the top-level case, the driver's own concept type is
// resolved right here — from the driver sibling's plain `x-referential` in
// the SAME item props — not a second schema.properties lookup, since an
// item-level driver is never itself a top-level field. Same unbounded-depth
// recursion as collectOntologyTypesFromItemProps, for the same reason
// (CR-088's nested-list precedent).
function collectDynamicItemFieldsFromItemProps(itemProps: Record<string, JsonSchemaProperty>, result: Array<{ driverConceptType: string; suffix: string }>): void {
  for (const itemDef of Object.values(itemProps)) {
    const driverField = itemDef["x-referential-source-by"];
    if (driverField) {
      const driverConceptType = itemProps[driverField]?.["x-referential"];
      if (driverConceptType) result.push({ driverConceptType, suffix: itemDef["x-referential-source-suffix"] ?? "" });
    }
    if (itemDef.type === "array" && itemDef.items?.properties) {
      collectDynamicItemFieldsFromItemProps(itemDef.items.properties, result);
    }
  }
}

export function dynamicReferentialSourceItemFieldsIn(schema: JsonSchemaDocument): Array<{ driverConceptType: string; suffix: string }> {
  const result: Array<{ driverConceptType: string; suffix: string }> = [];
  for (const def of Object.values(schema.properties ?? {})) {
    if (def["x-widget"] === "referential-list" && def.items?.properties) {
      collectDynamicItemFieldsFromItemProps(def.items.properties, result);
    }
  }
  return result;
}

// --- Display grouping ------------------------------------------------------
// Full redesign (owner: "Policy UI has to be similar to Pack - Metadata tab
// and other tabs grouped") — generateFields() returns one flat list; this
// groups the SAME fields into the tabs the authoring page renders as
// separate panes. Which simple-field-grid tabs a kind has, in what order,
// and which field belongs to which, is now entirely schema data (a kind's
// own x-groups/x-group — see JsonSchemaDocument/JsonSchemaProperty above),
// not a hardcoded per-field-name Set here. Adding a new tab (e.g. Policy's
// own Applicability/Governance) is a schema/migration change only.
// Dependencies (a single named field), Contributions (any `contribution(s)X`
// field, one tab each), and Exposable/Configuration Parameters' two
// candidate-driven singletons stay name-detected below — they aren't plain
// field grids to begin with (bespoke widgets or per-field-name-pattern tab
// fan-out), so schema-driven grouping doesn't apply to them.
export interface FieldGroup { key: string; label: string; field: GeneratedField }
export interface SimpleFieldGroup { key: string; label: string; fields: GeneratedField[] }
export interface FieldGroups {
  // One entry per schema-declared x-groups entry, in declared order, each
  // rendered as its own 'simple' tab (_generatedFieldGroups.ejs).
  groups: SimpleFieldGroup[];
  dependencies: GeneratedField | null;
  exposableParameters: GeneratedField[];
  configurationParameters: GeneratedField[];
  parameterOverrides: GeneratedField[];
  contributions: FieldGroup[];
  // A field with no x-group, or one naming a key the schema never declared
  // in x-groups — appended to the first declared group's tab (or its own
  // fallback tab, if a kind somehow declares no groups at all), so nothing
  // silently disappears from the form the way it could before this had a
  // dedicated place to land.
  other: GeneratedField[];
}

const EXPOSABLE_PARAMETERS_FIELD_NAMES = new Set(["exposedParameters"]);
const PARAMETER_OVERRIDES_FIELD_NAMES = new Set(["exposedParameterOverrides"]);
// CR-091 Part 2 — Profile's own Ch.7 §10 Configuration Parameters: candidate-
// driven-adjacent enough (tenant-overridable required-ness, CR-091 Part 2)
// that it stays its own name-detected singleton group rather than folding
// into the generic schema-driven mechanism above.
const CONFIGURATION_PARAMETER_FIELD_NAMES = new Set([
  "targetCloudProvider", "primaryProgrammingLanguage", "sourceControlProvider", "deploymentStrategy",
  "aiProviderPreference", "defaultRepositoryStructure", "documentationLevel", "developmentMethodology",
  "domain", "participatingOrganisationCodes", "environmentConfiguration",
]);

// "contributionQualityGates" -> "Quality Gates"; "contributionsCompliance" ->
// "Compliance" (the one field using the "contributions" — plural — prefix).
function labelizeContribution(name: string): string {
  return labelize(name.replace(/^contributions?/, ""));
}

export function groupFieldsForDisplay(schema: JsonSchemaDocument, fields: GeneratedField[]): FieldGroups {
  const declared = schema["x-groups"] ?? [];
  const byKey = new Map<string, SimpleFieldGroup>(declared.map((g) => [g.key, { key: g.key, label: g.label, fields: [] }]));
  const groups: FieldGroups = { groups: declared.map((g) => byKey.get(g.key)!), dependencies: null, exposableParameters: [], configurationParameters: [], parameterOverrides: [], contributions: [], other: [] };
  for (const f of fields) {
    if (f.name === "dependencies") { groups.dependencies = f; continue; }
    if (/^contributions?[A-Z]/.test(f.name)) { groups.contributions.push({ key: f.name, label: labelizeContribution(f.name), field: f }); continue; }
    if (CONFIGURATION_PARAMETER_FIELD_NAMES.has(f.name)) { groups.configurationParameters.push(f); continue; }
    if (EXPOSABLE_PARAMETERS_FIELD_NAMES.has(f.name)) { groups.exposableParameters.push(f); continue; }
    if (PARAMETER_OVERRIDES_FIELD_NAMES.has(f.name)) { groups.parameterOverrides.push(f); continue; }
    const bucket = f.group ? byKey.get(f.group) : undefined;
    if (bucket) { bucket.fields.push(f); continue; }
    groups.other.push(f);
  }
  // Nothing left ungrouped that a viewer would otherwise never see — append
  // to the first declared tab (or make a fallback "Other" tab, for the
  // unlikely case a kind declares no x-groups at all).
  if (groups.other.length) {
    if (groups.groups.length) groups.groups[0].fields = groups.groups[0].fields.concat(groups.other);
    else groups.groups.push({ key: "other", label: "Other", fields: groups.other });
  }
  return groups;
}

// A contribution accordion section should open by default only if the Pack
// actually has content there — collapsed-but-populated is worse than always
// expanded. "Real" content is identified by whichever field a row is actually
// keyed by (a referential field — e.g. dependencies' packCode — or `code`/
// `checklist`/`statement`, in that preference order, whichever the item shape
// has); everything else on an offered blank row can carry a schema default
// (e.g. dependency `type` defaulting to "required") without counting as content.
export function rowHasContent(row: Record<string, string>, itemFields: ReferentialListItemField[]): boolean {
  const referentialField = itemFields.find((f) => f.kind === "referential");
  // CR-060 — "name" added for Checklist's own container row (name/description/
  // items — no code/checklist/statement/referential field at all); harmless
  // for every other referential-list kind, which either doesn't have a `name`
  // field or already has a more specific identifying field checked first.
  const identifyingNames = [referentialField?.name, "code", "checklist", "statement", "name"].filter((n): n is string => !!n);
  return identifyingNames.some((n) => (row[n] ?? "").trim() !== "");
}

// Contextual help (owner: "structure + layout + contextual help") — shown
// once per contribution section, not repeated per row/field, since these are
// the same handful of §20 verifiable-item fields reused across four
// contribution types (Checklists/Review Gates/Quality Gates/Obligations).
export const CONTRIBUTION_SECTION_HELP: Record<string, string> = {
  contributionCapabilities: "Abilities this Pack introduces (e.g. \"testing\", \"architecture\") — what a Participant needs to fulfil in order to do this kind of work.",
  contributionServices: "Work products this Pack's Capabilities produce, each tied to the Capability that provides it (must be declared in this same Pack, above).",
  contributionAuthorityRules: "Legacy per-transition role authorisations (pre-noun×verb). New Packs should generally rely on the platform's noun×verb badges instead.",
  // CR-089 follow-on — dead for contributionPolicies specifically since its
  // own x-help (schema_definitions Pack, 168_pack_contribution_policies_from_definitions.sql)
  // now carries the real explanation via the generic simple-field path
  // (_generatedFieldGroups.ejs's own 'simple'-type tab dispatch, not this
  // fallback banner) — left here only because CONTRIBUTION_SECTION_HELP is
  // still consulted for other, still-referential-list contribution types.
  contributionPolicies: "Which canonical Policy Definitions (Ch.24) this Pack adopts — check/uncheck, scoped to whichever ones govern a deliverable-name this Pack's own declared Capabilities produce.",
  contributionQualityGates: "Pass/fail criteria a specific transition (entity + from-state + to-state) must satisfy before it's allowed to proceed.",
  contributionChecklists: "Reusable Checklists (Ch.47) — a Name/Description plus its own ordered list of Items (a Statement, optionally tagged with a Configurable Dimension/Value pair — CR-088 — so a Template can expose that dimension for a Profile to filter by). A Checklist carries no scope, participant, or required/advisory status of its own; Review Gates and Quality Gates reference it by id (checklistIds/recommendedChecklistIds) to say when it applies and whether it's required.",
  contributionReviewGates: "Verifiable review requirements — typically \"judgment\" or \"human-attested\" items that gate a review outcome.",
  contributionObligationDefinitions: "Verifiable obligations this Pack can raise — a commitment that must be resolved, of the Category given.",
  contributionEngineeringCapital: "Engineering Behaviour, Engineering Metrics, Reusable Components, or Engineering Templates this Pack contributes — a Type and a URL to where it actually lives.",
};
export const VERIFIABLE_ITEM_FIELD_HELP: Record<string, string> = {
  statement: "The claim being verified, in plain language — this is the core content; everything else describes how it gets checked.",
  classification: "machine-verifiable = an AI/tool checks it and records Evidence · judgment = an AI assessment a human accepts as a Review · human-attested = a human directly attests to it.",
  prompt: "What to actually ask/run to check the Statement — the instruction handed to the assigned Participant.",
  participant: "Who checks this: AI, AI+human (AI proposes, human accepts), or human only.",
  outputContract: "The shape of the result: passed-failed-notes (a check) or assessment-acceptance (a review outcome).",
  externalEvidence: "Check this if verification comes from an external system (e.g. a CI run) rather than analysing an artifact directly.",
  assurance: "Optional: a confidence threshold below which an AI result should escalate to a human (declared only — not yet enforced).",
  // CR-060, revised same day — Review/Quality Gate's own reference to a
  // Checklist. Mandatory/Recommended is NOT a Checklist Item field (owner:
  // "you cannot determine a checklist item to be mandatory. Checklist is
  // generic. Pack has the specifics.") — it lives here, on the gate's own
  // two reference lists, instead.
  checklistIds: "Which of this Pack's own Checklists (any version/tenant sharing this Pack's code) must complete for this gate. All listed Checklists are required (AND); a Checklist shared by more than one gate only runs once.",
  recommendedChecklistIds: "Advisory Checklists (this Pack's own code only) — completing them does not block this gate, unlike Checklist Ids.",
};

// Structural (grammar) validation — required fields, types, enums, pattern —
// the part a schema can express directly (SDK UI Layer Plan's "Structural vs
// Referential validation" split). Referential checks (does a packCode
// actually resolve) stay the hand-built widget's/entity-specific validator's
// job (validatePackSeed etc.), not this generic function's.
export function validateAgainstSchema(schema: JsonSchemaDocument, content: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const name of schema.required ?? []) {
    const value = content[name];
    if (value === undefined || value === null || value === "") errors.push(`"${name}" is required`);
  }
  for (const [name, def] of Object.entries(schema.properties ?? {})) {
    const value = content[name];
    if (value === undefined || value === null) continue;
    if (def.enum && typeof value === "string" && !def.enum.includes(value)) {
      errors.push(`"${name}" must be one of ${def.enum.join(", ")}, got: "${value}"`);
    }
    if (def.pattern && typeof value === "string" && value !== "" && !new RegExp(def.pattern).test(value)) {
      errors.push(`"${name}" does not match the required pattern (${def.pattern})`);
    }
    if (def.minLength && typeof value === "string" && value.length < def.minLength) {
      errors.push(`"${name}" must be at least ${def.minLength} character(s)`);
    }
    // CR-058 form redesign — per-row required fields on a referential-list
    // (e.g. Quality Gate's Category/Name/Governed Transition/Criteria Type).
    // Blank "offered" rows (rowHasContent's own identifying-field check)
    // are skipped, same discipline parseFormBody already uses, so an
    // untouched blank template row is never flagged as missing its
    // required fields.
    if (def["x-widget"] === "referential-list" && def.items?.required?.length && Array.isArray(value)) {
      const itemFields: ReferentialListItemField[] = Object.entries(def.items.properties ?? {}).map(([fieldName, fieldDef]) => {
        if (fieldDef["x-referential"]) return { name: fieldName, kind: "referential", referentialSource: fieldDef["x-referential"] };
        if (fieldDef.enum) return { name: fieldName, kind: "enum", options: fieldDef.enum };
        if (fieldDef.type === "boolean") return { name: fieldName, kind: "boolean" };
        return { name: fieldName, kind: "string" };
      });
      for (const [i, row] of (value as Array<Record<string, string>>).entries()) {
        if (!rowHasContent(row, itemFields)) continue;
        for (const requiredField of def.items.required) {
          if (!(row[requiredField] ?? "").toString().trim()) {
            errors.push(`"${name}" row ${i + 1}: "${requiredField}" is required`);
          }
        }
      }
    }
  }
  return errors;
}

// Parses one referential-list field's posted rows back into real objects.
// Recursive — Checklist's own `items` is a genuinely nested referential-list
// (CR-060: contributionChecklists[].items[].statement/group, an item field
// whose OWN type is "array", not a scalar), so a single-level version of
// this needs to recurse into any item field shaped the same way, not just
// the top-level field parseFormBody calls this for.
//
// Bug fix (owner: the row generateFields offers beyond the existing ones,
// BLANK_ROWS_TO_OFFER "for convenience", pre-fills each item field's own
// schema `default` — e.g. Pack dependencies' `type` defaults to "required"
// — so an untouched offered row's <select> renders (and submits) "required"
// even though the user never touched it. Detecting "blank" by "every field
// empty" then treats that default as real content: the row survives, gets
// saved with an empty identifying field (packCode), and validatePackSeed
// reports a phantom "required dependency ... Pack "" not found". Worse, it
// COMPOUNDS — the saved phantom row becomes an "existing" row next render,
// on top of 3 MORE freshly offered blanks, so the count grows by 3 on every
// Save. Fix: blank-ness is decided by the item's IDENTIFYING field(s) —
// those marked `x-referential` (what the row is actually a row *of*) — not
// by every field including ones that carry a schema default. Falls back to
// "every field empty" only for item shapes with no identifying field.
//
// Bug fix (owner: flash error "cl.items.forEach is not a function" on
// Validate) — before this function existed, an item field whose own type was
// "array" fell through to the generic `String(raw ?? ...)` branch below,
// silently stringifying the real nested array the form body parser (qs)
// already built for Checklist's own items rows into "[object Object]" — a
// string with a truthy .length, so it survived the blank-row filter below,
// got saved as corrupt content, and crashed validatePackSeed's own
// `cl.items.forEach` the moment anyone actually used a Checklist through the
// real authoring form (JSON import parses real JSON directly and never went
// through this path, which is why this had never surfaced before). The
// "every field empty" fallback filter also needed to stop treating an EMPTY
// array as "non-blank" the way `[] !== ""` naively would — a leftover blank
// Checklist row with no name/description/asset AND zero items is still
// blank, not a phantom row to keep.
// A value counts as "filled" if it's a non-empty array, or a non-blank,
// non-false scalar — shared by both blank-row filters below so an array-
// typed field (a nested row-list OR a flat x-multi value-list) is judged the
// same way in either position, identifying field or fallback.
function isFieldFilled(v: unknown): boolean {
  return Array.isArray(v) ? v.length > 0 : v !== "" && v !== false;
}

// Singular counterpart of parseReferentialListField, for a `type: "object"`
// item field (Policy condition's own `requiredEvidence`) — one fixed
// sub-object posted as `...[requiredEvidence][category]` etc., not a
// repeatable, indexed sub-list.
// Policy condition redesign — governingCondition, an item field posted as a
// raw JSON string (a small textarea, same as the top-level x-widget:"json"
// field kind) rather than individual controls. Shared by both nested-object
// and nested-list item parsing below.
function parseJsonItemField(raw: unknown): unknown {
  if (typeof raw !== "string" || raw.trim() === "") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function parseNestedObjectField(def: JsonSchemaProperty, rawValue: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const row = (rawValue && typeof rawValue === "object" ? rawValue : {}) as Record<string, unknown>;
  for (const [fieldName, fieldDef] of Object.entries(def.properties ?? {})) {
    const raw = row[fieldName];
    if (fieldDef["x-widget"] === "json") out[fieldName] = parseJsonItemField(raw);
    else if (fieldDef.type === "array" && fieldDef.items?.properties) out[fieldName] = parseReferentialListField(fieldDef, raw);
    else if (fieldDef.type === "array") out[fieldName] = Array.isArray(raw) ? raw.filter((v) => v !== "") : raw ? [raw] : [];
    else if (fieldDef.type === "object" && fieldDef.properties) out[fieldName] = parseNestedObjectField(fieldDef, raw);
    else if (fieldDef.type === "boolean") out[fieldName] = raw === true || raw === "true" || raw === "on";
    else out[fieldName] = String(raw ?? fieldDef.default ?? "");
  }
  return out;
}

function parseReferentialListField(def: JsonSchemaProperty, rawValue: unknown): Record<string, unknown>[] {
  const itemFieldNames = Object.keys(def.items?.properties ?? {});
  // 2026-09-05 (CR-088 prerequisite) — also require `required`, not
  // x-referential alone. Checklist's own items[] just gained an OPTIONAL
  // x-referential pair (configurableKey/configurableValue) sitting alongside
  // its actual identifying field, `statement` (required, but freeform text,
  // never x-referential) — without this, identifyingFieldNames would become
  // [configurableKey, configurableValue] instead of falling through to the
  // "every field empty" fallback below, so every ordinary item (the
  // overwhelming majority, which tag neither) would look blank and vanish on
  // save despite having a real statement. Every existing identifying field
  // (packCode, category, code, ...) is already both x-referential AND
  // required, so this narrows nothing for them.
  const identifyingFieldNames = itemFieldNames.filter((fn) => def.items?.properties?.[fn]?.["x-referential"] && def.items?.required?.includes(fn));
  const rowsArray = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
  return rowsArray
    .map((row) => {
      const out: Record<string, unknown> = {};
      for (const fieldName of itemFieldNames) {
        const fieldDef = def.items?.properties?.[fieldName];
        const raw = (row as Record<string, unknown>)?.[fieldName];
        // Bug fix (owner: Validate threw "" is not a canonical category:evidence
        // concept / quality gate "" has an invalid governedTransition / review
        // gate is missing a code — on a Draft branched from a Pack with NO
        // Quality/Review Gates at all) — a genuinely nested row-list (an item
        // field with its OWN `.items.properties`, like Checklist's own `items`)
        // needs the recursive treatment just below; checklistIds/
        // requiredPolicyCodes/recommendedChecklistIds are `type: "array"` too,
        // but are a FLAT x-multi value list (a <select multiple> submitting
        // raw id strings) with no `.items.properties` at all — recursing into
        // those the same way silently turned every submitted id string into
        // an empty `{}` (the recursive call's own itemFieldNames came back
        // empty, so its per-row loop never ran), which then made this row's
        // OWN blank-row check below always see a non-empty ARRAY for that
        // field — `[] !== ""` is true no matter what an array holds — so the
        // untouched blank "New item" row Quality/Review Gates always offer
        // could never be recognised as blank and correctly dropped.
        // Policy condition redesign — governingCondition, posted as a raw
        // JSON string; checked first since it's also `type: "object"`
        // (would otherwise wrongly match the nested-object case below).
        if (fieldDef?.["x-widget"] === "json") out[fieldName] = parseJsonItemField(raw);
        else if (fieldDef?.type === "array" && fieldDef.items?.properties) out[fieldName] = parseReferentialListField(fieldDef, raw);
        else if (fieldDef?.type === "array") out[fieldName] = Array.isArray(raw) ? raw.filter((v) => v !== "") : raw ? [raw] : [];
        // Policy condition redesign — a single nested sub-object
        // (requiredEvidence), the singular counterpart of the nested-list
        // recursion just above.
        else if (fieldDef?.type === "object" && fieldDef.properties) out[fieldName] = parseNestedObjectField(fieldDef, raw);
        // CR-017: a boolean item field is a checkbox — present/"true" -> true.
        else if (fieldDef?.type === "boolean") out[fieldName] = raw === true || raw === "true" || raw === "on";
        else out[fieldName] = String(raw ?? fieldDef?.default ?? "");
      }
      return out;
    })
    .filter((row) => identifyingFieldNames.length > 0
      ? identifyingFieldNames.some((fn) => isFieldFilled(row[fn]))
      : Object.values(row).some(isFieldFilled));
}

// Reassembles posted form fields (flat body values + the referential-list's
// indexed rows) back into the JSON document shape the schema describes —
// the inverse of generateFields, so the web route doesn't need its own
// per-entity parsing logic.
export function parseFormBody(schema: JsonSchemaDocument, body: Record<string, unknown>): Record<string, unknown> {
  const content: Record<string, unknown> = {};

  for (const [name, def] of Object.entries(schema.properties ?? {})) {
    if (def["x-widget"] === "json") {
      // Same bug fix as generateFields: an array-typed field parses/defaults
      // to [], not {} — code downstream that iterates the parsed value must
      // get an iterable regardless of whether the textarea was left blank,
      // submitted as literal "{}", or failed to parse.
      const emptyDefault: unknown = def.type === "array" ? [] : {};
      const raw = body[name];
      if (typeof raw === "string" && raw.trim() !== "") {
        try {
          const parsed = JSON.parse(raw);
          content[name] = def.type === "array" && !Array.isArray(parsed) ? emptyDefault : parsed;
        } catch {
          content[name] = emptyDefault;
        }
      } else {
        content[name] = emptyDefault;
      }
      continue;
    }

    if (def["x-widget"] === "referential-list") {
      content[name] = parseReferentialListField(def, body[name]);
      continue;
    }

    if (body[name] !== undefined) content[name] = body[name];
  }

  return content;
}
