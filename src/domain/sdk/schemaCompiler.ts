import type { JsonSchemaDocument, JsonSchemaProperty } from "./formGenerator.js";

export const SCHEMA_KINDS = ["Pack", "Template", "Profile", "Deliverable", "Service", "Policy", "Capability"] as const;

export const TOP_LEVEL_WIDGET_KINDS = ["text", "textarea", "version", "select", "referential", "referential-multi", "json", "list"] as const;
export const ITEM_WIDGET_KINDS = ["text", "textarea", "select", "boolean", "referential", "referential-multi", "referential-dynamic", "referential-by-scope", "generated", "json", "list", "object"] as const;

export type WidgetKind = (typeof ITEM_WIDGET_KINDS)[number] | "version";

export interface AuthoredNote {
  date: string;
  note: string;
}

export interface AuthoredVariant {
  matchValue: string;
  source: string;
  ontology: boolean;
  composable: boolean;
}

export interface AuthoredWidget {
  kind: WidgetKind;
  name: string;
  label: string;
  required: boolean;
  help: string;
  group: string;
  showWhen: string;
  showWhenValues: string;
  notes: AuthoredNote[];

  numeric: boolean;
  pattern: string;
  minLength: string;
  defaultValue: string;
  markdown: boolean;

  enumValues: string;

  referentialSource: string;
  ontology: boolean;
  ontologyComposable: boolean;
  drivenMode: "" | "by-suffix" | "by-value";
  driverField: string;
  driverSuffix: string;
  variants: AuthoredVariant[];

  jsonIsArray: boolean;
  rawItems: JsonSchemaProperty["items"] | undefined;

  configurable: boolean;

  rawType: string;

  children: AuthoredWidget[];
  listWidgetMarker: boolean;
}

export interface AuthoredDocument {
  groups: Array<{ key: string; label: string }>;
  notes: AuthoredNote[];
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
    if (!before || !after) continue;

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

    if (before.properties || after.properties) {
      diffProperties(before.properties, after.properties, new Set(before.required ?? []), new Set(after.required ?? []), path, out);
    }
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
