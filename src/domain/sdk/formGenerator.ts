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
// CR-017 — a repeatable-list item field renders per its `kind`: a Registry-backed
// <select> (referential), a fixed <select> (enum), a checkbox (boolean), or a
// text input (string). This is what lets a repeatable list author real structured
// rows (e.g. a schema's field list), not just strings.
export interface ReferentialListItemField {
  name: string;
  kind: "string" | "enum" | "boolean" | "referential";
  referentialSource?: string;
  options?: string[];
}

export type GeneratedField =
  | { kind: "string"; name: string; label: string; required: boolean; value: string; help?: string }
  | { kind: "select"; name: string; label: string; required: boolean; value: string; options: string[]; help?: string }
  | { kind: "referential-select"; name: string; label: string; required: boolean; value: string; referentialSource: string; help?: string }
  | { kind: "json"; name: string; label: string; required: boolean; value: string; help?: string }
  // Bug fix (UI redesign, owner: "extremely unfriendly"): `existingCount` marks
  // how many of `rows` are the content's OWN rows vs. blank ones offered so an
  // author has somewhere to add a new one — the view uses this to render
  // existing rows as filled cards and put exactly one blank "template" row
  // behind an "+ Add another" control, instead of always showing 3 blank rows
  // (of up to 12 fields each) fully expanded regardless of whether the Pack
  // uses that contribution type at all.
  | { kind: "referential-list"; name: string; label: string; required: boolean; rows: Array<Record<string, string>>; itemFields: ReferentialListItemField[]; existingCount: number };

// Blank slots appended after however many the content already has, so the
// form always offers a place to add one more without needing client-side JS
// to insert the FIRST row. Kept to one (not several) — the authoring UI's own
// "+ Add another" control (edit.ejs) clones this one client-side rather than
// pre-rendering a pile of blanks nobody asked for.
const BLANK_ROWS_TO_OFFER = 1;

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
      // Bug fix: default to the field's own declared shape — "[]" for an
      // array-typed field, "{}" otherwise — not always "{}". A new draft with
      // no existing value for an array-typed json field (e.g. Template's
      // deliverableCatalogue) previously rendered/submitted a literal "{}",
      // which downstream code that iterates the parsed value (`for...of`)
      // then threw on ("object is not iterable").
      const emptyDefault = def.type === "array" ? "[]" : "{}";
      fields.push({ kind: "json", name, label: labelize(name), required: isRequired, value: rawValue !== undefined ? JSON.stringify(rawValue, null, 2) : emptyDefault, help: def["x-help"] });
      continue;
    }

    if (def["x-widget"] === "referential-list") {
      const itemProps = def.items?.properties ?? {};
      const itemFields: ReferentialListItemField[] = Object.entries(itemProps).map(([fieldName, fieldDef]) => {
        if (fieldDef["x-referential"]) return { name: fieldName, kind: "referential", referentialSource: fieldDef["x-referential"] };
        if (fieldDef.enum) return { name: fieldName, kind: "enum", options: fieldDef.enum };
        if (fieldDef.type === "boolean") return { name: fieldName, kind: "boolean" };
        return { name: fieldName, kind: "string" };
      });
      const existingRows = Array.isArray(rawValue) ? (rawValue as Array<Record<string, unknown>>) : [];
      const rows: Array<Record<string, string>> = existingRows.map((row) => {
        const out: Record<string, string> = {};
        for (const field of itemFields) out[field.name] = String(row[field.name] ?? "");
        return out;
      });
      const existingCount = rows.length;
      for (let i = 0; i < BLANK_ROWS_TO_OFFER; i++) {
        const blank: Record<string, string> = {};
        for (const field of itemFields) blank[field.name] = String(itemProps[field.name]?.default ?? "");
        rows.push(blank);
      }
      fields.push({ kind: "referential-list", name, label: labelize(name), required: isRequired, rows, itemFields, existingCount });
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

// --- Display grouping (UI redesign, owner: "extremely unfriendly") --------
// generateFields() returns one flat list in schema-property order — Pack's 23
// fields interleave Identity/Metadata, Compatibility, Dependencies, and 8
// separate Contribution types with no visual structure at all. This groups
// the SAME fields (no schema/DB change) into the sections the authoring page
// actually renders as separate cards. Purely name-driven, so it's harmless
// for Template/Profile/the schema-registry's own meta-schema — anything that
// doesn't match a known Pack field name just lands in `other` and renders
// exactly as it does today.
export interface FieldGroup { key: string; label: string; field: GeneratedField }
export interface FieldGroups {
  metadata: GeneratedField[];
  compatibility: GeneratedField[];
  dependencies: GeneratedField | null;
  contributions: FieldGroup[];
  other: GeneratedField[];
}

const METADATA_FIELD_NAMES = new Set([
  "name", "owner", "category", "publisher", "description", "packVersion", "installationClassification", "compositionStrategy",
  "code", "environment", "baseTemplateCode", "deliverableCatalogue", "requiredCapabilityCodes", "mandatoryPackCodes", "optionalPackCodes", "configParameters",
]);
const COMPATIBILITY_FIELD_NAMES = new Set(["supportedPlatformVersion", "minSupportedPlatformVersion", "maxSupportedPlatformVersion", "incompatiblePackVersions", "migrationGuidance"]);

// "contributionQualityGates" -> "Quality Gates"; "contributionsCompliance" ->
// "Compliance" (the one field using the "contributions" — plural — prefix).
function labelizeContribution(name: string): string {
  return labelize(name.replace(/^contributions?/, ""));
}

export function groupFieldsForDisplay(fields: GeneratedField[]): FieldGroups {
  const groups: FieldGroups = { metadata: [], compatibility: [], dependencies: null, contributions: [], other: [] };
  for (const f of fields) {
    if (f.name === "dependencies") { groups.dependencies = f; continue; }
    if (/^contributions?[A-Z]/.test(f.name)) { groups.contributions.push({ key: f.name, label: labelizeContribution(f.name), field: f }); continue; }
    if (COMPATIBILITY_FIELD_NAMES.has(f.name)) { groups.compatibility.push(f); continue; }
    if (METADATA_FIELD_NAMES.has(f.name)) { groups.metadata.push(f); continue; }
    groups.other.push(f);
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
  const identifyingNames = [referentialField?.name, "code", "checklist", "statement"].filter((n): n is string => !!n);
  return identifyingNames.some((n) => (row[n] ?? "").trim() !== "");
}

// Contextual help (owner: "structure + layout + contextual help") — shown
// once per contribution section, not repeated per row/field, since these are
// the same handful of §20 verifiable-item fields reused across four
// contribution types (Checklists/Review Gates/Quality Gates/Obligations).
export const CONTRIBUTION_SECTION_HELP: Record<string, string> = {
  contributionCapabilities: "Abilities this Pack introduces (e.g. \"testing\", \"architecture-design\") — what a Participant needs to fulfil in order to do this kind of work.",
  contributionServices: "Work products this Pack's Capabilities produce, each tied to the Capability that provides it (must be declared in this same Pack, above).",
  contributionAuthorityRules: "Legacy per-transition role authorisations (pre-noun×verb). New Packs should generally rely on the platform's noun×verb badges instead.",
  contributionPolicies: "Conditions checked on a governed transition — a blocking Policy or a non-blocking Standard (deviations are recorded, not blocked).",
  contributionQualityGates: "Pass/fail criteria a specific transition (entity + from-state + to-state) must satisfy before it's allowed to proceed.",
  contributionChecklists: "Verifiable checklist items — each one a Statement to confirm, with a Classification of how it's confirmed (see below).",
  contributionReviewGates: "Verifiable review requirements — typically \"judgment\" or \"human-attested\" items that gate a review outcome.",
  contributionObligationDefinitions: "Verifiable obligations this Pack can raise — a commitment that must be resolved, of the Obligation Type given.",
  contributionsCompliance: "Compliance Frameworks and their Requirements this Pack declares (raw JSON — deeply nested, not yet a structured widget).",
};
export const VERIFIABLE_ITEM_FIELD_HELP: Record<string, string> = {
  statement: "The claim being verified, in plain language — this is the core content; everything else describes how it gets checked.",
  classification: "machine-verifiable = an AI/tool checks it and records Evidence · judgment = an AI assessment a human accepts as a Review · human-attested = a human directly attests to it.",
  prompt: "What to actually ask/run to check the Statement — the instruction handed to the assigned Participant.",
  participant: "Who checks this: AI, AI+human (AI proposes, human accepts), or human only.",
  outputContract: "The shape of the result: passed-failed-notes (a check) or assessment-acceptance (a review outcome).",
  externalEvidence: "Check this if verification comes from an external system (e.g. a CI run) rather than analysing an artifact directly.",
  assurance: "Optional: a confidence threshold below which an AI result should escalate to a human (declared only — not yet enforced).",
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
      const itemFieldNames = Object.keys(def.items?.properties ?? {});
      // Bug fix: the row generateFields offers beyond the existing ones
      // (BLANK_ROWS_TO_OFFER, "for convenience") pre-fills each item field's
      // own schema `default` — e.g. Pack dependencies' `type` defaults to
      // "required" — so an untouched offered row's <select> renders (and
      // submits) "required" even though the user never touched it. Detecting
      // "blank" by "every field empty" then treats that default as real
      // content: the row survives, gets saved with an empty identifying field
      // (packCode), and validatePackSeed reports a phantom "required
      // dependency ... Pack "" not found". Worse, it COMPOUNDS — the saved
      // phantom row becomes an "existing" row next render, on top of 3 MORE
      // freshly offered blanks, so the count grows by 3 on every Save. Fix:
      // blank-ness is decided by the item's IDENTIFYING field(s) — those
      // marked `x-referential` (what the row is actually a row *of*) — not by
      // every field including ones that carry a schema default. Falls back to
      // "every field empty" only for item shapes with no identifying field.
      const identifyingFieldNames = itemFieldNames.filter((fn) => def.items?.properties?.[fn]?.["x-referential"]);
      const rowsInput = body[name];
      const rowsArray = Array.isArray(rowsInput) ? rowsInput : rowsInput ? [rowsInput] : [];
      content[name] = rowsArray
        .map((row) => {
          const out: Record<string, unknown> = {};
          for (const fieldName of itemFieldNames) {
            const fieldDef = def.items?.properties?.[fieldName];
            const raw = (row as Record<string, unknown>)?.[fieldName];
            // CR-017: a boolean item field is a checkbox — present/"true" -> true.
            if (fieldDef?.type === "boolean") out[fieldName] = raw === true || raw === "true" || raw === "on";
            else out[fieldName] = String(raw ?? fieldDef?.default ?? "");
          }
          return out;
        })
        .filter((row) => identifyingFieldNames.length > 0
          ? identifyingFieldNames.some((fn) => row[fn] !== "")
          : Object.values(row).some((v) => v !== "" && v !== false));
      continue;
    }

    if (body[name] !== undefined) content[name] = body[name];
  }

  return content;
}
