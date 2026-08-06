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
}

export interface JsonSchemaProperty {
  type?: string;
  enum?: string[];
  pattern?: string;
  minLength?: number;
  default?: unknown;
  "x-widget"?: "json" | "referential-list" | "referential-select";
  "x-referential"?: string;
  "x-referential-source"?: string;
  "x-help"?: string;
  items?: JsonSchemaProperty & { properties?: Record<string, JsonSchemaProperty> };
}

// A referential-list row's fields, generically — referentialSource set means
// "render a Registry-backed <select> sourced from this key," same as a
// top-level referential-select field, so the view never needs to know a
// specific field name like "packCode" to decide how to render it.
export interface ReferentialListItemField {
  name: string;
  referentialSource?: string;
}

export type GeneratedField =
  | { kind: "string"; name: string; label: string; required: boolean; value: string; help?: string }
  | { kind: "select"; name: string; label: string; required: boolean; value: string; options: string[]; help?: string }
  | { kind: "referential-select"; name: string; label: string; required: boolean; value: string; referentialSource: string; help?: string }
  | { kind: "json"; name: string; label: string; required: boolean; value: string; help?: string }
  | { kind: "referential-list"; name: string; label: string; required: boolean; rows: Array<Record<string, string>>; itemFields: ReferentialListItemField[] };

// One row of blank slots appended after however many the content already
// has, so the form always offers a place to add one more without needing
// client-side JS to insert rows.
const BLANK_ROWS_TO_OFFER = 3;

function labelize(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

export function generateFields(schema: JsonSchemaDocument, content: Record<string, unknown>): GeneratedField[] {
  const required = new Set(schema.required ?? []);
  const fields: GeneratedField[] = [];

  for (const [name, def] of Object.entries(schema.properties ?? {})) {
    const isRequired = required.has(name);
    const rawValue = content[name];

    if (def["x-widget"] === "json") {
      fields.push({ kind: "json", name, label: labelize(name), required: isRequired, value: rawValue !== undefined ? JSON.stringify(rawValue, null, 2) : "{}", help: def["x-help"] });
      continue;
    }

    if (def["x-widget"] === "referential-list") {
      const itemProps = def.items?.properties ?? {};
      const itemFields: ReferentialListItemField[] = Object.entries(itemProps).map(([fieldName, fieldDef]) => ({
        name: fieldName,
        referentialSource: fieldDef["x-referential"],
      }));
      const existingRows = Array.isArray(rawValue) ? (rawValue as Array<Record<string, unknown>>) : [];
      const rows: Array<Record<string, string>> = existingRows.map((row) => {
        const out: Record<string, string> = {};
        for (const field of itemFields) out[field.name] = String(row[field.name] ?? "");
        return out;
      });
      for (let i = 0; i < BLANK_ROWS_TO_OFFER; i++) {
        const blank: Record<string, string> = {};
        for (const field of itemFields) blank[field.name] = String(itemProps[field.name]?.default ?? "");
        rows.push(blank);
      }
      fields.push({ kind: "referential-list", name, label: labelize(name), required: isRequired, rows, itemFields });
      continue;
    }

    if (def["x-widget"] === "referential-select") {
      fields.push({ kind: "referential-select", name, label: labelize(name), required: isRequired, value: rawValue !== undefined ? String(rawValue) : "", referentialSource: def["x-referential-source"] ?? "", help: def["x-help"] });
      continue;
    }

    if (def.enum) {
      fields.push({ kind: "select", name, label: labelize(name), required: isRequired, value: String(rawValue ?? ""), options: def.enum, help: def["x-help"] });
      continue;
    }

    fields.push({ kind: "string", name, label: labelize(name), required: isRequired, value: rawValue !== undefined ? String(rawValue) : "", help: def["x-help"] });
  }

  return fields;
}

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
  }
  return errors;
}

// Reassembles posted form fields (flat body values + the referential-list's
// indexed rows) back into the JSON document shape the schema describes —
// the inverse of generateFields, so the web route doesn't need its own
// per-entity parsing logic.
export function parseFormBody(schema: JsonSchemaDocument, body: Record<string, unknown>): Record<string, unknown> {
  const content: Record<string, unknown> = {};

  for (const [name, def] of Object.entries(schema.properties ?? {})) {
    if (def["x-widget"] === "json") {
      const raw = body[name];
      if (typeof raw === "string" && raw.trim() !== "") {
        try {
          content[name] = JSON.parse(raw);
        } catch {
          content[name] = {};
        }
      } else {
        content[name] = {};
      }
      continue;
    }

    if (def["x-widget"] === "referential-list") {
      const itemFieldNames = Object.keys(def.items?.properties ?? {});
      const rowsInput = body[name];
      const rowsArray = Array.isArray(rowsInput) ? rowsInput : rowsInput ? [rowsInput] : [];
      content[name] = rowsArray
        .map((row) => {
          const out: Record<string, string> = {};
          for (const fieldName of itemFieldNames) {
            const fieldDef = def.items?.properties?.[fieldName];
            out[fieldName] = String((row as Record<string, unknown>)?.[fieldName] ?? fieldDef?.default ?? "");
          }
          return out;
        })
        .filter((row) => Object.values(row).some((v) => v !== ""));
      continue;
    }

    if (body[name] !== undefined) content[name] = body[name];
  }

  return content;
}
