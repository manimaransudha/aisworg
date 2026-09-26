// CR-114 — widget-tree schema authoring, replacing CR-017's flat field-row
// editor (`AuthoredField`/`META_SCHEMA`), which only ever exposed 9 of
// `JsonSchemaProperty`'s 17 real `x-*` keywords and had no way to author a
// nested repeatable list at all. A widget kind here is exactly one real kind
// `formGenerator.ts` (generateFields/buildItemFields) renders and validates,
// carrying only the properties that kind's own branch actually reads — so a
// new `x-*` keyword later is "add one widget kind" to this file, not "add a
// column to a flat row and every branch that reads it."
//
// Widgets nest to unbounded depth (a "list" widget's children are themselves
// widgets, recursively) because production schemas actually need it — Pack's
// `contributionChecklists` is a list whose own item field `items` is itself
// another list. `isItem` (false only for the document's own top-level
// widgets) tracks which of two slightly different key-sets a kind emits at
// top level vs. nested — mirrors generateFields (top) vs. buildItemFields
// (nested) exactly; see each case below for the specific divergence.
//
// Deliberately excluded from Pass 1 (CR-114's own design doc): `x-referential-
// source` values using the "self:"/"derived:" resolver conventions (Template's
// dependencyGraph) — not yet round-tripped; those fields stay on the raw-JSON
// advanced path until Pass 2 locates and documents the resolver.
import type { JsonSchemaDocument, JsonSchemaProperty } from "./formGenerator.js";

export const SCHEMA_KINDS = ["Pack", "Template", "Profile", "Deliverable", "Service", "Policy", "Capability"] as const;

// Kinds selectable for a TOP-LEVEL widget (document properties). Excludes
// "boolean" (generateFields has no top-level boolean branch — would silently
// render as a text input), "generated"/"referential-dynamic"/
// "referential-by-scope" (item-only, driven-by-a-sibling concepts that only
// make sense inside a repeatable row), and "object" (no top-level fixed-
// sub-object case in generateFields).
export const TOP_LEVEL_WIDGET_KINDS = ["text", "textarea", "version", "select", "referential", "referential-multi", "json", "list"] as const;
// Kinds selectable for an ITEM-LEVEL widget (a "list" widget's children).
// Excludes "version" (no item-level version case in buildItemFields).
export const ITEM_WIDGET_KINDS = ["text", "textarea", "select", "boolean", "referential", "referential-multi", "referential-dynamic", "referential-by-scope", "generated", "json", "list", "object"] as const;

export type WidgetKind = (typeof ITEM_WIDGET_KINDS)[number] | "version";

export interface AuthoredNote {
  date: string;
  note: string;
}

// A driven referential(-multi)'s "by value" mode, and referential-by-scope's
// own variant list, share this exact shape — both compile to the same stored
// `x-referential-source-by-value` document (JsonSchemaProperty's own single
// type definition is used identically at top level and nested). matchValue
// "" is the `default` variant (shown for any driver value not otherwise
// listed).
export interface AuthoredVariant {
  matchValue: string;
  source: string;
  ontology: boolean;
  composable: boolean;
}

export interface AuthoredWidget {
  kind: WidgetKind;
  name: string;
  label: string; // x-label — only ever emitted at item level (generateFields never reads it at top level; top-level label is always derived from name)
  required: boolean;
  help: string; // x-help
  group: string; // x-group — only meaningful at top level (which x-groups tab)
  showWhen: string; // x-show-when — a sibling field's name
  showWhenValues: string; // x-show-when-values, csv
  notes: AuthoredNote[]; // x-schema-notes on this one property — author-only, never read by formGenerator

  // text / textarea
  numeric: boolean; // type: "number" instead of "string" (e.g. Service serviceLevel.target)
  pattern: string;
  minLength: string;
  defaultValue: string; // also reused by select ("" | csv match) and boolean ("true"/"false"/"")
  markdown: boolean; // x-format: "markdown"

  // select
  enumValues: string; // csv

  // referential / referential-multi / referential-dynamic / referential-by-scope
  referentialSource: string; // x-referential-source (top) / x-referential (item) — fixed mode only
  ontology: boolean;
  ontologyComposable: boolean; // x-ontology-composable — fixed/by-suffix modes only; by-value mode carries composable per-variant instead
  drivenMode: "" | "by-suffix" | "by-value"; // referential/referential-multi (top-level) only; referential-dynamic/referential-by-scope imply their own mode
  driverField: string; // x-referential-source-by (by-suffix/dynamic) or the `field` of x-referential-source-by-value (by-value/by-scope)
  driverSuffix: string; // x-referential-source-suffix (by-suffix/dynamic)
  variants: AuthoredVariant[]; // by-value / by-scope modes

  // json
  jsonIsArray: boolean;
  // The array-shaped json widget's own `items` sub-schema, verbatim — real
  // data (Template/Profile's exposedParameterOverrides) carries a full
  // structured item shape here despite being marked x-widget:"json" (opaque
  // to generateFields/buildItemFields, which never render or validate a
  // "json" field's own item structure). Nothing today authors this through
  // a form; carried through untouched, like rawType, so editing OTHER
  // fields on the same schema never silently drops it.
  rawItems: JsonSchemaProperty["items"] | undefined;

  // CR-088's schema-level "cascades Pack -> Template -> Profile, narrowable
  // downstream" flag (x-configurable) — orthogonal to widget kind, so
  // captured/emitted generically in propertyToWidget/widgetToProperty's
  // shared code rather than per-kind.
  configurable: boolean;

  // Verbatim `type` from the source property, when this widget was built
  // from existing data (propertyToWidget) — real live schemas are NOT
  // perfectly consistent about which `type` accompanies a given `x-widget`
  // (Service's `inputs`/`outputs` are `x-widget:"referential-multi-select"`
  // with `type:"string"`; its own `consumers`, same widget, uses
  // `type:"array"`). Preferred over the kind's own sensible default on
  // compile-back so round-tripping existing data never silently changes it;
  // blank (a freshly authored widget) falls back to the kind's default.
  rawType: string;

  // list (recurses into itself; "object" reuses the same children field)
  children: AuthoredWidget[];
  // Whether the SOURCE item-level nested list explicitly carried the
  // x-widget:"referential-list" marker — real data is inconsistent here
  // (Pack's contributionObligationDefinitions[].applicabilityDeliverables
  // has it; contributionChecklists[].items and
  // contributionServices[].serviceLevel don't), and buildItemFields detects
  // a nested list purely by type:"array" + items.properties regardless of
  // this marker, so there is no "correct" convention to normalise to.
  // Always true for a top-level list (the marker is load-bearing there,
  // per generateFields); meaningless for anything but kind "list".
  listWidgetMarker: boolean;
}

export interface AuthoredDocument {
  groups: Array<{ key: string; label: string }>; // x-groups
  notes: AuthoredNote[]; // x-schema-notes at the document root
  widgets: AuthoredWidget[];
}

export function blankVariant(): AuthoredVariant {
  return { matchValue: "", source: "", ontology: false, composable: false };
}

export function blankNote(): AuthoredNote {
  return { date: "", note: "" };
}

export function blankWidget(kind: WidgetKind = "text"): AuthoredWidget {
  return {
    kind, name: "", label: "", required: false, help: "", group: "", showWhen: "", showWhenValues: "", notes: [],
    numeric: false, pattern: "", minLength: "", defaultValue: "", markdown: false,
    enumValues: "",
    referentialSource: "", ontology: false, ontologyComposable: false, drivenMode: "", driverField: "", driverSuffix: "", variants: [],
    jsonIsArray: false,
    rawItems: undefined,
    configurable: false,
    rawType: "",
    children: [],
    listWidgetMarker: true,
  };
}

export function blankDocument(): AuthoredDocument {
  return { groups: [{ key: "metadata", label: "Identity & Metadata" }], notes: [], widgets: [] };
}

function csvToArray(csv: string): string[] {
  return csv.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}
function arrayToCsv(a: string[] | undefined): string {
  return (a ?? []).join(", ");
}

function variantsToByValue(driverField: string, variants: AuthoredVariant[]): NonNullable<JsonSchemaProperty["x-referential-source-by-value"]> {
  const def = variants.find((v) => v.matchValue.trim() === "");
  const named = variants.filter((v) => v.matchValue.trim() !== "");
  const values: Record<string, { source: string; ontology: boolean; composable?: boolean }> = {};
  for (const v of named) {
    values[v.matchValue.trim()] = { source: v.source.trim(), ontology: v.ontology, ...(v.composable ? { composable: true } : {}) };
  }
  return {
    field: driverField.trim(),
    values,
    default: { source: (def?.source ?? "").trim(), ontology: def?.ontology === true, ...(def?.composable ? { composable: true } : {}) },
  };
}

function byValueToVariants(byValue: NonNullable<JsonSchemaProperty["x-referential-source-by-value"]>): { driverField: string; variants: AuthoredVariant[] } {
  const variants: AuthoredVariant[] = [
    { matchValue: "", source: byValue.default.source, ontology: byValue.default.ontology === true, composable: byValue.default.composable === true },
    ...Object.entries(byValue.values).map(([matchValue, v]) => ({ matchValue, source: v.source, ontology: v.ontology === true, composable: v.composable === true })),
  ];
  return { driverField: byValue.field, variants };
}

// One widget -> the JsonSchemaProperty it compiles to. `isItem` is false only
// for a document's own top-level widget; true for anything nested inside a
// "list"/"object" widget's children, at any depth.
function widgetToProperty(w: AuthoredWidget, isItem: boolean): JsonSchemaProperty {
  const prop: JsonSchemaProperty = {};

  function common(): void {
    if (w.help.trim()) prop["x-help"] = w.help.trim();
    if (w.showWhen.trim()) prop["x-show-when"] = w.showWhen.trim();
    const swv = csvToArray(w.showWhenValues);
    if (swv.length) prop["x-show-when-values"] = swv;
    if (isItem && w.label.trim()) prop["x-label"] = w.label.trim();
    if (!isItem && w.group.trim()) prop["x-group"] = w.group.trim();
    if (w.notes.length) prop["x-schema-notes"] = w.notes.filter((n) => n.note.trim() || n.date.trim());
    if (w.configurable) prop["x-configurable"] = true;
  }

  switch (w.kind) {
    case "text":
    case "textarea": {
      prop.type = w.rawType || (w.numeric ? "number" : "string");
      if (w.kind === "textarea") prop["x-widget"] = "textarea";
      if (w.pattern.trim()) prop.pattern = w.pattern.trim();
      if (w.minLength.trim() && !w.numeric) prop.minLength = Number(w.minLength);
      if (w.defaultValue.trim()) prop.default = w.numeric ? Number(w.defaultValue) : w.defaultValue;
      if (w.markdown) prop["x-format"] = "markdown";
      // Capability's own `code` (migration 046) carries x-ontology/
      // x-referential-source with no x-widget at all — inert to
      // formGenerator's own dispatch (which only reads them alongside a
      // referential-select/-multi-select marker) but real, live data;
      // preserved here so it round-trips rather than silently vanishing.
      if (w.ontology) prop["x-ontology"] = true;
      if (w.referentialSource.trim()) prop["x-referential-source"] = w.referentialSource.trim();
      common();
      break;
    }
    case "version": {
      prop.type = "string";
      prop["x-widget"] = "version";
      if (w.pattern.trim()) prop.pattern = w.pattern.trim();
      common();
      break;
    }
    case "select": {
      prop.type = w.rawType || "string";
      const opts = csvToArray(w.enumValues);
      if (opts.length) prop.enum = opts;
      if (w.defaultValue.trim()) prop.default = w.defaultValue.trim();
      common();
      break;
    }
    case "boolean": {
      prop.type = w.rawType || "boolean";
      if (w.defaultValue === "true" || w.defaultValue === "false") prop.default = w.defaultValue === "true";
      common();
      break;
    }
    case "generated": {
      prop.type = w.rawType || "string";
      prop["x-generated"] = true;
      common();
      break;
    }
    case "json": {
      prop.type = w.rawType || (w.jsonIsArray ? "array" : "object");
      prop["x-widget"] = "json";
      if (w.jsonIsArray && w.rawItems !== undefined) prop.items = w.rawItems;
      common();
      break;
    }
    case "referential":
    case "referential-multi": {
      const multi = w.kind === "referential-multi";
      prop.type = w.rawType || (multi ? "array" : "string");
      if (!isItem) {
        prop["x-widget"] = multi ? "referential-multi-select" : "referential-select";
        // Service's own inputs/outputs are referential-multi-select with
        // type:"string" and no `items` at all (the same real-data
        // inconsistency rawType exists to preserve — see its own comment);
        // only an actually array-shaped multi field gets a matching
        // `items: {type:"string"}` (its own selected-values shape).
        if (multi && prop.type === "array") prop.items = { type: "string" };
        if (w.pattern.trim()) prop.pattern = w.pattern.trim();
        if (w.minLength.trim()) prop.minLength = Number(w.minLength);
        if (w.ontology) prop["x-ontology"] = true;
        if (w.drivenMode === "by-value") {
          prop["x-referential-source-by-value"] = variantsToByValue(w.driverField, w.variants);
        } else {
          if (w.drivenMode === "by-suffix") {
            if (w.driverField.trim()) prop["x-referential-source-by"] = w.driverField.trim();
            if (w.driverSuffix.trim()) prop["x-referential-source-suffix"] = w.driverSuffix.trim();
          }
          if (w.referentialSource.trim()) prop["x-referential-source"] = w.referentialSource.trim();
          if (w.ontologyComposable) prop["x-ontology-composable"] = true;
        }
      } else {
        // Author writes "derived:<name>" into the same free-text Referential
        // source box as any other item-level referential field; the prefix
        // (not a separate UI control) is what tells this apart from a plain
        // registry/Ontology key — see formGenerator.ts's own
        // x-referential-source-derived-by comment.
        const source = w.referentialSource.trim();
        if (source.startsWith("derived:")) prop["x-referential-source-derived-by"] = source.slice("derived:".length);
        else if (source) prop["x-referential"] = source;
        if (multi) prop["x-multi"] = true;
        if (w.ontology) prop["x-ontology"] = true;
        if (w.ontologyComposable) prop["x-ontology-composable"] = true;
      }
      common();
      break;
    }
    case "referential-dynamic": {
      prop.type = w.rawType || "string";
      if (w.driverField.trim()) prop["x-referential-source-by"] = w.driverField.trim();
      prop["x-referential-source-suffix"] = w.driverSuffix.trim();
      if (w.ontology) prop["x-ontology"] = true;
      common();
      break;
    }
    case "referential-by-scope": {
      prop.type = w.rawType || "string";
      prop["x-referential-source-by-value"] = variantsToByValue(w.driverField, w.variants);
      common();
      break;
    }
    case "list": {
      const itemProperties: Record<string, JsonSchemaProperty> = {};
      const itemRequired: string[] = [];
      const order: string[] = [];
      for (const c of w.children) {
        const name = c.name.trim();
        if (!name) continue;
        itemProperties[name] = widgetToProperty(c, true);
        if (c.required) itemRequired.push(name);
        order.push(name);
      }
      prop.type = "array";
      prop.items = { type: "object", properties: itemProperties };
      if (itemRequired.length) prop.items.required = itemRequired;
      if (order.length) prop.items["x-property-order"] = order;
      if (!isItem || w.listWidgetMarker) prop["x-widget"] = "referential-list";
      // Pack's own `dependencies` carries x-referential-source directly on
      // the LIST property itself (redundant with its item field packCode's
      // own x-referential, but real, live data) — only emitted if set.
      if (w.referentialSource.trim()) prop["x-referential-source"] = w.referentialSource.trim();
      common();
      break;
    }
    case "object": {
      const subProperties: Record<string, JsonSchemaProperty> = {};
      const subRequired: string[] = [];
      const order: string[] = [];
      for (const c of w.children) {
        const name = c.name.trim();
        if (!name) continue;
        subProperties[name] = widgetToProperty(c, true);
        if (c.required) subRequired.push(name);
        order.push(name);
      }
      prop.type = "object";
      prop.properties = subProperties;
      if (subRequired.length) prop.required = subRequired;
      if (order.length) prop["x-property-order"] = order;
      common();
      break;
    }
  }

  return prop;
}

// The inverse — a stored JsonSchemaProperty -> the widget that authored it
// (or that faithfully represents it, for a hand-written raw-JSON schema).
// Dispatch order mirrors generateFields (top level) / buildItemFields (item
// level) exactly, since both functions check their own markers in a specific
// priority order (e.g. a nested-list check must run before a plain enum
// check, since a field could theoretically carry both).
function propertyToWidget(name: string, def: JsonSchemaProperty, required: boolean, isItem: boolean): AuthoredWidget {
  const w = blankWidget();
  w.name = name;
  w.required = required;
  w.rawType = def.type ?? "";
  w.numeric = def.type === "number";
  w.help = def["x-help"] ?? "";
  w.showWhen = def["x-show-when"] ?? "";
  w.showWhenValues = arrayToCsv(def["x-show-when-values"]);
  w.notes = (def["x-schema-notes"] ?? []).map((n) => ({ date: n.date ?? "", note: n.note ?? "" }));
  if (isItem) w.label = def["x-label"] ?? "";
  if (!isItem) w.group = def["x-group"] ?? "";
  w.configurable = def["x-configurable"] === true;

  // Nested list (item-level: type array + items.properties) / top-level
  // referential-list (x-widget marker) — same recursive shape either way.
  if ((isItem && def.type === "array" && def.items?.properties) || (!isItem && def["x-widget"] === "referential-list")) {
    w.kind = "list";
    w.listWidgetMarker = def["x-widget"] === "referential-list";
    w.referentialSource = def["x-referential-source"] ?? "";
    const itemProps = def.items?.properties ?? {};
    const itemRequired = new Set(def.items?.required ?? []);
    let entries = Object.entries(itemProps);
    const order = def.items?.["x-property-order"];
    if (order?.length) {
      const rank = new Map(order.map((n, i) => [n, i]));
      entries = entries.map((e, i) => ({ e, i })).sort((a, b) => (rank.get(a.e[0]) ?? order.length + a.i) - (rank.get(b.e[0]) ?? order.length + b.i)).map((x) => x.e);
    }
    w.children = entries.map(([n, d]) => propertyToWidget(n, d, itemRequired.has(n), true));
    return w;
  }

  // Nested object (item-level only: type object + properties, no items).
  if (isItem && def.type === "object" && def.properties) {
    w.kind = "object";
    const required2 = new Set(def.required ?? []);
    let entries = Object.entries(def.properties);
    const order = def["x-property-order"];
    if (order?.length) {
      const rank = new Map(order.map((n, i) => [n, i]));
      entries = entries.map((e, i) => ({ e, i })).sort((a, b) => (rank.get(a.e[0]) ?? order.length + a.i) - (rank.get(b.e[0]) ?? order.length + b.i)).map((x) => x.e);
    }
    w.children = entries.map(([n, d]) => propertyToWidget(n, d, required2.has(n), true));
    return w;
  }

  if (isItem && def["x-generated"]) {
    w.kind = "generated";
    return w;
  }

  if (def["x-widget"] === "json") {
    w.kind = "json";
    w.jsonIsArray = def.type === "array";
    if (def.type === "array" && def.items !== undefined) w.rawItems = def.items;
    return w;
  }

  // referential-source-by-value: "referential-by-scope" at item level;
  // driven-mode "referential"/"referential-multi" at top level.
  if (def["x-referential-source-by-value"]) {
    const { driverField, variants } = byValueToVariants(def["x-referential-source-by-value"]);
    w.driverField = driverField;
    w.variants = variants;
    if (isItem) {
      w.kind = "referential-by-scope";
    } else {
      w.kind = def["x-widget"] === "referential-multi-select" ? "referential-multi" : "referential";
      w.drivenMode = "by-value";
      w.ontology = def["x-ontology"] === true;
    }
    return w;
  }

  if (isItem && def["x-referential-source-by"]) {
    w.kind = "referential-dynamic";
    w.driverField = def["x-referential-source-by"];
    w.driverSuffix = def["x-referential-source-suffix"] ?? "";
    w.ontology = def["x-ontology"] === true;
    return w;
  }

  if (!isItem && def["x-widget"] === "referential-select") {
    w.kind = "referential";
    w.pattern = def.pattern ?? "";
    w.minLength = def.minLength !== undefined ? String(def.minLength) : "";
    w.ontology = def["x-ontology"] === true;
    w.ontologyComposable = def["x-ontology-composable"] === true;
    if (def["x-referential-source-by"]) {
      w.drivenMode = "by-suffix";
      w.driverField = def["x-referential-source-by"];
      w.driverSuffix = def["x-referential-source-suffix"] ?? "";
    }
    w.referentialSource = def["x-referential-source"] ?? "";
    return w;
  }

  if (!isItem && def["x-widget"] === "referential-multi-select") {
    w.kind = "referential-multi";
    w.pattern = def.pattern ?? "";
    w.minLength = def.minLength !== undefined ? String(def.minLength) : "";
    w.ontology = def["x-ontology"] === true;
    w.ontologyComposable = def["x-ontology-composable"] === true;
    w.referentialSource = def["x-referential-source"] ?? "";
    return w;
  }

  // Checked before plain x-referential — mutually exclusive with it.
  if (isItem && def["x-referential-source-derived-by"]) {
    w.kind = def["x-multi"] ? "referential-multi" : "referential";
    w.referentialSource = `derived:${def["x-referential-source-derived-by"]}`;
    w.ontology = def["x-ontology"] === true;
    w.ontologyComposable = def["x-ontology-composable"] === true;
    return w;
  }

  if (isItem && def["x-referential"]) {
    w.kind = def["x-multi"] ? "referential-multi" : "referential";
    w.referentialSource = def["x-referential"];
    w.ontology = def["x-ontology"] === true;
    w.ontologyComposable = def["x-ontology-composable"] === true;
    return w;
  }

  if (!isItem && def["x-widget"] === "version") {
    w.kind = "version";
    w.pattern = def.pattern ?? "";
    return w;
  }

  if (def.enum) {
    w.kind = "select";
    w.enumValues = arrayToCsv(def.enum);
    if (def.default !== undefined) w.defaultValue = String(def.default);
    return w;
  }

  if (def.type === "boolean") {
    w.kind = "boolean";
    if (def.default === true) w.defaultValue = "true";
    else if (def.default === false) w.defaultValue = "false";
    return w;
  }

  w.kind = def["x-widget"] === "textarea" ? "textarea" : "text";
  w.numeric = def.type === "number";
  w.pattern = def.pattern ?? "";
  w.minLength = def.minLength !== undefined ? String(def.minLength) : "";
  w.defaultValue = def.default !== undefined ? String(def.default) : "";
  w.markdown = def["x-format"] === "markdown";
  // Capability's own `code` (migration 046): x-ontology/x-referential-source
  // with no x-widget marker at all, inert to formGenerator's own dispatch but
  // real, live data — see the matching emit-side comment in widgetToProperty.
  w.ontology = def["x-ontology"] === true;
  w.referentialSource = def["x-referential-source"] ?? "";
  return w;
}

export function widgetTreeToJsonSchema(doc: AuthoredDocument): JsonSchemaDocument {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];
  const order: string[] = [];
  for (const w of doc.widgets) {
    const name = w.name.trim();
    if (!name) continue;
    properties[name] = widgetToProperty(w, false);
    if (w.required) required.push(name);
    order.push(name);
  }
  const schema: JsonSchemaDocument = { type: "object", required, properties };
  if (order.length) schema["x-property-order"] = order;
  const groups = doc.groups.filter((g) => g.key.trim());
  if (groups.length) schema["x-groups"] = groups.map((g) => ({ key: g.key.trim(), label: g.label.trim() || g.key.trim() }));
  const notes = doc.notes.filter((n) => n.note.trim() || n.date.trim());
  if (notes.length) schema["x-schema-notes"] = notes;
  return schema;
}

// Posted form data (express's extended-qs urlencoded parser) turns
// `widgets[0][children][2][name]` into real nested objects/arrays, but a
// removed-then-not-reindexed row (the client only removes DOM nodes, it
// never renumbers sibling indices) can leave gaps — qs may hand back either
// a genuine sparse Array (with holes) or a plain object keyed by numeric
// strings depending on the gap size. Normalise both to a dense, ordered
// array so neither shape needs handling twice.
function normalizeIndexed<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw.filter((v): v is T => v !== undefined && v !== null);
  if (raw && typeof raw === "object") {
    return Object.keys(raw as object)
      .map(Number)
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b)
      .map((i) => (raw as Record<string, unknown>)[i]) as T[];
  }
  return [];
}

function toBool(v: unknown): boolean {
  return v === "on" || v === "true" || v === true;
}

function parseWidgetFromBody(raw: Record<string, unknown>): AuthoredWidget {
  const w = blankWidget();
  const kind = String(raw.kind ?? "text");
  w.kind = (TOP_LEVEL_WIDGET_KINDS as readonly string[]).includes(kind) || (ITEM_WIDGET_KINDS as readonly string[]).includes(kind) ? (kind as WidgetKind) : "text";
  w.name = String(raw.name ?? "").trim();
  w.label = String(raw.label ?? "");
  w.required = toBool(raw.required);
  w.configurable = toBool(raw.configurable);
  w.help = String(raw.help ?? "");
  w.group = String(raw.group ?? "");
  w.showWhen = String(raw.showWhen ?? "");
  w.showWhenValues = String(raw.showWhenValues ?? "");
  w.numeric = toBool(raw.numeric);
  w.pattern = String(raw.pattern ?? "");
  w.minLength = String(raw.minLength ?? "");
  // select/boolean post their own default under a differently-named field
  // (selectDefault/booleanDefault) — the row's Text/Select/Boolean panels are
  // all present in the DOM at once (see _widgetRow.ejs), so a shared
  // `defaultValue` name across them would submit multiple values for one key.
  w.defaultValue = w.kind === "select" ? String(raw.selectDefault ?? "") : w.kind === "boolean" ? String(raw.booleanDefault ?? "") : String(raw.defaultValue ?? "");
  w.markdown = toBool(raw.markdown);
  w.enumValues = String(raw.enumValues ?? "");
  w.referentialSource = String(raw.referentialSource ?? "");
  w.ontology = toBool(raw.ontology);
  w.ontologyComposable = toBool(raw.ontologyComposable);
  w.drivenMode = raw.drivenMode === "by-suffix" || raw.drivenMode === "by-value" ? raw.drivenMode : "";
  w.driverField = String(raw.driverField ?? "");
  w.driverSuffix = String(raw.driverSuffix ?? "");
  w.jsonIsArray = toBool(raw.jsonIsArray);
  const rawItemsJson = String(raw.rawItemsJson ?? "").trim();
  if (rawItemsJson) {
    try {
      w.rawItems = JSON.parse(rawItemsJson);
    } catch {
      w.rawItems = undefined;
    }
  }
  w.rawType = String(raw.rawType ?? "");
  w.listWidgetMarker = String(raw.listWidgetMarker ?? "") === "1";
  w.notes = normalizeIndexed<Record<string, unknown>>(raw.notes)
    .map((n) => ({ date: String(n.date ?? ""), note: String(n.note ?? "") }))
    .filter((n) => n.date.trim() || n.note.trim());
  w.variants = normalizeIndexed<Record<string, unknown>>(raw.variants).map((v) => ({
    matchValue: String(v.matchValue ?? ""), source: String(v.source ?? ""), ontology: toBool(v.ontology), composable: toBool(v.composable),
  }));
  w.children = normalizeIndexed<Record<string, unknown>>(raw.children)
    .map((c) => parseWidgetFromBody(c))
    .filter((c) => c.name.trim());
  return w;
}

// Posted body -> AuthoredDocument, the inverse of what the tree editor's
// field names encode. Rows with a blank name are dropped (an offered-but-
// untouched "New widget" row, or a row emptied out and left rather than
// removed) — same "blank means not real content" discipline the rest of the
// SDK's authoring forms already use.
export function parseAuthoredDocumentFromBody(body: Record<string, unknown>): AuthoredDocument {
  return {
    groups: normalizeIndexed<Record<string, unknown>>(body.groups)
      .map((g) => ({ key: String(g.key ?? "").trim(), label: String(g.label ?? "").trim() }))
      .filter((g) => g.key),
    notes: normalizeIndexed<Record<string, unknown>>(body.notes)
      .map((n) => ({ date: String(n.date ?? ""), note: String(n.note ?? "") }))
      .filter((n) => n.date.trim() || n.note.trim()),
    widgets: normalizeIndexed<Record<string, unknown>>(body.widgets)
      .map((w) => parseWidgetFromBody(w))
      .filter((w) => w.name.trim()),
  };
}

export function jsonSchemaToWidgetTree(schema: JsonSchemaDocument): AuthoredDocument {
  const required = new Set(schema.required ?? []);
  let entries = Object.entries(schema.properties ?? {});
  const order = schema["x-property-order"];
  if (order?.length) {
    const rank = new Map(order.map((n, i) => [n, i]));
    entries = entries.map((e, i) => ({ e, i })).sort((a, b) => (rank.get(a.e[0]) ?? order.length + a.i) - (rank.get(b.e[0]) ?? order.length + b.i)).map((x) => x.e);
  }
  return {
    groups: (schema["x-groups"] ?? []).map((g) => ({ key: g.key, label: g.label })),
    notes: (schema["x-schema-notes"] ?? []).map((n) => ({ date: n.date ?? "", note: n.note ?? "" })),
    widgets: entries.map(([n, d]) => propertyToWidget(n, d, required.has(n), false)),
  };
}

// CR-114 Compatibility feature — design/change-requests/CR-114-schema-
// metadata.md's "Compatibility semantics (agreed)" section. B (newSchema) is
// compatible with A (oldSchema) iff every document valid under A stays valid
// under B: nothing breaking below. Differences are collected recursively
// (nested `properties` sub-objects and array `items` sub-shapes), same
// traversal formGenerator.ts's generateFields/buildItemFields already use.
export type SchemaDifferenceKind = "added" | "removed" | "type-changed" | "newly-required" | "now-optional" | "enum-changed" | "pattern-changed" | "default-changed";

export interface SchemaDifference {
  path: string;
  kind: SchemaDifferenceKind;
  breaking: boolean;
}

function sameArray(a: string[] | undefined, b: string[] | undefined): boolean {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((v) => y.includes(v));
}

function diffProperties(
  oldProps: Record<string, JsonSchemaProperty> | undefined,
  newProps: Record<string, JsonSchemaProperty> | undefined,
  oldRequired: Set<string>,
  newRequired: Set<string>,
  pathPrefix: string,
  out: SchemaDifference[]
): void {
  const oldP = oldProps ?? {};
  const newP = newProps ?? {};
  const names = new Set([...Object.keys(oldP), ...Object.keys(newP)]);
  for (const name of names) {
    const path = pathPrefix ? `${pathPrefix}.${name}` : name;
    const before = oldP[name];
    const after = newP[name];
    if (before && !after) {
      out.push({ path, kind: "removed", breaking: true });
      continue;
    }
    if (!before && after) {
      const bare = newRequired.has(name) && after.default === undefined;
      out.push({ path, kind: "added", breaking: bare });
      continue;
    }
    if (!before || !after) continue; // both branches above already handled either side being absent

    if (before.type !== after.type) {
      out.push({ path, kind: "type-changed", breaking: true });
    }
    const wasRequired = oldRequired.has(name);
    const isRequired = newRequired.has(name);
    if (!wasRequired && isRequired && after.default === undefined) {
      out.push({ path, kind: "newly-required", breaking: true });
    } else if (wasRequired && !isRequired) {
      out.push({ path, kind: "now-optional", breaking: false });
    }
    if (!sameArray(before.enum, after.enum)) {
      out.push({ path, kind: "enum-changed", breaking: false });
    }
    if ((before.pattern ?? "") !== (after.pattern ?? "")) {
      out.push({ path, kind: "pattern-changed", breaking: false });
    }
    if (before.default !== after.default) {
      out.push({ path, kind: "default-changed", breaking: false });
    }

    // Nested fixed sub-object (`type: "object"` + `properties`, no `items`).
    if (before.properties || after.properties) {
      diffProperties(before.properties, after.properties, new Set(before.required ?? []), new Set(after.required ?? []), path, out);
    }
    // Nested repeatable list (`items.properties`) — recurse the same way.
    if (before.items?.properties || after.items?.properties) {
      diffProperties(before.items?.properties, after.items?.properties, new Set(before.items?.required ?? []), new Set(after.items?.required ?? []), `${path}[]`, out);
    }
  }
}

export function diffSchemaVersions(oldSchema: JsonSchemaDocument, newSchema: JsonSchemaDocument): { compatible: boolean; differences: SchemaDifference[] } {
  const differences: SchemaDifference[] = [];
  diffProperties(oldSchema.properties, newSchema.properties, new Set(oldSchema.required ?? []), new Set(newSchema.required ?? []), "", differences);
  const compatible = differences.every((d) => !d.breaking);
  return { compatible, differences };
}
