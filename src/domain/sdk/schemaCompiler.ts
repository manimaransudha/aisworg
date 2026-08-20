// CR-017 — form-based schema authoring. A schema (a `schema_definitions` grammar)
// is authored through a form generated from META_SCHEMA (a constrained
// "schema-of-schemas"), then compiled to the JSON Schema document the rest of the
// SDK consumes. Deliberately constrained to the field vocabulary this platform's
// `formGenerator` actually renders/validates — not a general JSON-Schema editor.
//
// Round-trips: fieldListToJsonSchema (author -> stored schema) and
// jsonSchemaToFieldList (stored schema -> author, for editing). Nested
// repeatable-list item structures (e.g. Pack `dependencies`) are NOT expressible
// in this flat field list — those grammars keep the raw-JSON advanced path.
import type { JsonSchemaDocument, JsonSchemaProperty } from "./formGenerator.js";

export const FIELD_TYPES = ["string", "number", "boolean", "object", "array"] as const;
export const FIELD_WIDGETS = ["none", "json", "referential-select", "textarea", "version"] as const;
// CR-019: TransitionDefinition is not grammar-authored (it uses the CR-007 form).
export const SCHEMA_KINDS = ["Pack", "Template", "Profile"] as const;

export interface AuthoredField {
  name: string;
  type: string;
  required: boolean;
  enumValues: string; // comma-separated
  widget: string; // one of FIELD_WIDGETS
  referentialSource: string;
  // Ch.18 Ontology (owner: "the schema has to pick the values from the
  // ontology"): when true, referentialSource is the exact Ontology
  // concept_type to resolve options from, not an arbitrary registry key.
  ontology: boolean;
  help: string;
  pattern: string;
}

export interface AuthoredSchema {
  entityKind: string;
  fields: AuthoredField[];
}

// The constrained meta-schema — drives the schema-authoring form via generateFields.
export const META_SCHEMA: JsonSchemaDocument = {
  type: "object",
  required: ["entityKind", "fields"],
  properties: {
    entityKind: { type: "string", enum: [...SCHEMA_KINDS], "x-help": "which entity's grammar this is a new version of" },
    fields: {
      type: "array",
      "x-widget": "referential-list",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: [...FIELD_TYPES] },
          required: { type: "boolean" },
          enumValues: { type: "string" },
          widget: { type: "string", enum: [...FIELD_WIDGETS] },
          referentialSource: { type: "string" },
          ontology: { type: "boolean" },
          help: { type: "string" },
          pattern: { type: "string" },
        },
      },
    },
  },
};

function splitEnum(csv: string): string[] {
  return csv.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

// author field-list -> the JSON Schema document stored in schema_definitions.
export function fieldListToJsonSchema(authored: AuthoredSchema): JsonSchemaDocument {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];
  for (const f of authored.fields ?? []) {
    const name = (f.name ?? "").trim();
    if (!name) continue;
    const prop: JsonSchemaProperty = { type: f.type || "string" };
    const enums = splitEnum(f.enumValues ?? "");
    if (enums.length) prop.enum = enums;
    if (f.widget && f.widget !== "none") prop["x-widget"] = f.widget as JsonSchemaProperty["x-widget"];
    if ((f.referentialSource ?? "").trim()) prop["x-referential-source"] = f.referentialSource.trim();
    if (f.ontology === true) prop["x-ontology"] = true;
    if ((f.pattern ?? "").trim()) prop.pattern = f.pattern.trim();
    if ((f.help ?? "").trim()) prop["x-help"] = f.help.trim();
    properties[name] = prop;
    if (f.required === true) required.push(name);
  }
  return { type: "object", required, properties };
}

// stored JSON Schema -> author field-list (for the edit form's prefill).
export function jsonSchemaToFieldList(schema: JsonSchemaDocument): AuthoredField[] {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([name, def]) => ({
    name,
    type: def.type ?? "string",
    required: required.has(name),
    enumValues: (def.enum ?? []).join(", "),
    widget: def["x-widget"] ?? "none",
    referentialSource: def["x-referential-source"] ?? "",
    ontology: def["x-ontology"] === true,
    help: def["x-help"] ?? "",
    pattern: def.pattern ?? "",
  }));
}
