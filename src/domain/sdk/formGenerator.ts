export interface JsonSchemaDocument {
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchemaProperty>;
  "x-groups"?: Array<{ key: string; label: string }>;
  "x-property-order"?: string[];
  "x-schema-notes"?: Array<{ date: string; note: string }>;
}

export interface JsonSchemaProperty {
  type?: string;
  enum?: string[];
  pattern?: string;
  minLength?: number;
  default?: unknown;
  "x-configurable"?: boolean;
  "x-widget"?: "json" | "referential-list" | "referential-select" | "referential-multi-select" | "textarea" | "version" | "db-select";
  "x-referential"?: string;
  "x-referential-source"?: string;
  "x-multi"?: boolean;
  "x-ontology"?: boolean;
  "x-ontology-composable"?: boolean;
  "x-referential-source-by"?: string;
  "x-referential-source-suffix"?: string;
  "x-referential-source-derived-by"?: string;
  "x-referential-source-by-value"?: {
    field: string;
    values: Record<string, { source: string; ontology: boolean; composable?: boolean }>;
    default: { source: string; ontology: boolean; composable?: boolean };
  };
  "x-help"?: string;
  "x-generated"?: boolean;
  "x-format"?: "markdown";
  "x-show-when"?: string;
  "x-show-when-values"?: string[];
  "x-label"?: string;
  "x-group"?: string;
  items?: JsonSchemaProperty & { properties?: Record<string, JsonSchemaProperty>; required?: string[]; "x-property-order"?: string[] };
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  "x-property-order"?: string[];
  "x-schema-notes"?: Array<{ date: string; note: string }>;
}

export interface ReferentialListItemField {
  name: string;
  kind: "string" | "enum" | "boolean" | "referential" | "referential-multi" | "nested-list" | "nested-object" | "generated" | "json" | "referential-dynamic" | "referential-by-scope";
  referentialSource?: string;
  options?: string[];
  required?: boolean;
  help?: string;
  label?: string;
  scopeVariants?: Array<{ matchValue: string | null; referentialSource: string; ontology: boolean }>;
  driverField?: string;
  driverSuffix?: string;
  markdown?: boolean;
  ontology?: boolean;
  nestedItemFields?: ReferentialListItemField[];
  showWhen?: string;
  showWhenValues?: string[];
}

export type GeneratedField =
  | { kind: "string"; name: string; label: string; required: boolean; value: string; help?: string; showWhen?: string; group?: string }
  | { kind: "textarea"; name: string; label: string; required: boolean; value: string; help?: string; showWhen?: string; group?: string }
  | { kind: "version"; name: string; label: string; required: boolean; value: string; help?: string; showWhen?: string; group?: string }
  | { kind: "select"; name: string; label: string; required: boolean; value: string; options: string[]; help?: string; showWhen?: string; group?: string }
  | { kind: "referential-select"; name: string; label: string; required: boolean; value: string; referentialSource: string; ontology: boolean; help?: string; showWhen?: string; dynamicSourceField?: string; dynamicSourceSuffix?: string; dynamicSourceDriverConceptType?: string; group?: string }
  | { kind: "db-select"; name: string; label: string; required: boolean; value: string; dbSource: string; help?: string; showWhen?: string; group?: string }
  | { kind: "referential-multi-select"; name: string; label: string; required: boolean; value: string[]; referentialSource: string; ontology: boolean; composable: boolean; help?: string; showWhen?: string; group?: string; driverField?: string; variants?: Array<{ matchValue: string | null; referentialSource: string; ontology: boolean; composable: boolean }> }
  | { kind: "json"; name: string; label: string; required: boolean; value: string; help?: string; showWhen?: string; group?: string }
  | { kind: "referential-list"; name: string; label: string; required: boolean; rows: Array<Record<string, RowValue>>; itemFields: ReferentialListItemField[]; existingCount: number; showWhen?: string; group?: string };

const BLANK_ROWS_TO_OFFER = 1;

function labelize(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

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
    if (fieldDef["x-widget"] === "json") return { name: fieldName, kind: "json" as const, ...common };
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
    if (fieldDef["x-referential-source-by"]) {
      return { name: fieldName, kind: "referential-dynamic" as const, driverField: fieldDef["x-referential-source-by"], driverSuffix: fieldDef["x-referential-source-suffix"] ?? "", ontology: true, ...common };
    }
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
        dynamicSourceDriverConceptType: driverField ? schema.properties?.[driverField]?.["x-referential-source"] : undefined,
        group,
      });
      continue;
    }

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
      fields.push({ kind: "select", name, label: labelize(name), required: isRequired, value: rawValue !== undefined ? String(rawValue) : String(def.default ?? ""), options: def.enum, help: def["x-help"], showWhen: def["x-show-when"], group });
      continue;
    }

    fields.push({ kind: "string", name, label: labelize(name), required: isRequired, value: rawValue !== undefined ? String(rawValue) : "", help: def["x-help"], showWhen: def["x-show-when"], group });
  }

  return fields;
}

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

export function ontologyComposableFieldsIn(schema: JsonSchemaDocument): Array<{ fieldName: string; multi: boolean; resolveConceptType: (content: Record<string, unknown>) => string }> {
  const result: Array<{ fieldName: string; multi: boolean; resolveConceptType: (content: Record<string, unknown>) => string }> = [];
  for (const [name, def] of Object.entries(schema.properties ?? {})) {
    const multi = def["x-widget"] === "referential-multi-select";
    if (!multi && def["x-widget"] !== "referential-select") continue;
    const byValue = def["x-referential-source-by-value"];
    if (byValue) {
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
    if (def["x-widget"] === "referential-list" && def.items?.properties) {
      collectOntologyTypesFromItemProps(def.items.properties, types);
    }
  }
  return [...types];
}

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

export interface FieldGroup { key: string; label: string; field: GeneratedField }
export interface SimpleFieldGroup { key: string; label: string; fields: GeneratedField[] }
export interface FieldGroups {
  groups: SimpleFieldGroup[];
  dependencies: GeneratedField | null;
  exposableParameters: GeneratedField[];
  configurationParameters: GeneratedField[];
  parameterOverrides: GeneratedField[];
  contributions: FieldGroup[];
  other: GeneratedField[];
}

const EXPOSABLE_PARAMETERS_FIELD_NAMES = new Set(["exposedParameters"]);
const PARAMETER_OVERRIDES_FIELD_NAMES = new Set(["exposedParameterOverrides"]);
const CONFIGURATION_PARAMETER_FIELD_NAMES = new Set([
  "targetCloudProvider", "primaryProgrammingLanguage", "sourceControlProvider", "deploymentStrategy",
  "aiProviderPreference", "defaultRepositoryStructure", "documentationLevel", "developmentMethodology",
  "domain", "participatingOrganisationCodes", "environmentConfiguration",
]);

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
  if (groups.other.length) {
    if (groups.groups.length) groups.groups[0].fields = groups.groups[0].fields.concat(groups.other);
    else groups.groups.push({ key: "other", label: "Other", fields: groups.other });
  }
  return groups;
}

export function rowHasContent(row: Record<string, string>, itemFields: ReferentialListItemField[]): boolean {
  const referentialField = itemFields.find((f) => f.kind === "referential");
  const identifyingNames = [referentialField?.name, "code", "checklist", "statement", "name"].filter((n): n is string => !!n);
  return identifyingNames.some((n) => (row[n] ?? "").trim() !== "");
}

export const CONTRIBUTION_SECTION_HELP: Record<string, string> = {
  contributionCapabilities: "Abilities this Pack introduces (e.g. \"testing\", \"architecture\") — what a Participant needs to fulfil in order to do this kind of work.",
  contributionServices: "Work products this Pack's Capabilities produce, each tied to the Capability that provides it (must be declared in this same Pack, above).",
  contributionAuthorityRules: "Legacy per-transition role authorisations (pre-noun×verb). New Packs should generally rely on the platform's noun×verb badges instead.",
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
  checklistIds: "Which of this Pack's own Checklists (any version/tenant sharing this Pack's code) must complete for this gate. All listed Checklists are required (AND); a Checklist shared by more than one gate only runs once.",
  recommendedChecklistIds: "Advisory Checklists (this Pack's own code only) — completing them does not block this gate, unlike Checklist Ids.",
};

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

function isFieldFilled(v: unknown): boolean {
  return Array.isArray(v) ? v.length > 0 : v !== "" && v !== false;
}

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
  const identifyingFieldNames = itemFieldNames.filter((fn) => def.items?.properties?.[fn]?.["x-referential"] && def.items?.required?.includes(fn));
  const rowsArray = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
  return rowsArray
    .map((row) => {
      const out: Record<string, unknown> = {};
      for (const fieldName of itemFieldNames) {
        const fieldDef = def.items?.properties?.[fieldName];
        const raw = (row as Record<string, unknown>)?.[fieldName];
        if (fieldDef?.["x-widget"] === "json") out[fieldName] = parseJsonItemField(raw);
        else if (fieldDef?.type === "array" && fieldDef.items?.properties) out[fieldName] = parseReferentialListField(fieldDef, raw);
        else if (fieldDef?.type === "array") out[fieldName] = Array.isArray(raw) ? raw.filter((v) => v !== "") : raw ? [raw] : [];
        else if (fieldDef?.type === "object" && fieldDef.properties) out[fieldName] = parseNestedObjectField(fieldDef, raw);
        else if (fieldDef?.type === "boolean") out[fieldName] = raw === true || raw === "true" || raw === "on";
        else out[fieldName] = String(raw ?? fieldDef?.default ?? "");
      }
      return out;
    })
    .filter((row) => identifyingFieldNames.length > 0
      ? identifyingFieldNames.some((fn) => isFieldFilled(row[fn]))
      : Object.values(row).some(isFieldFilled));
}

export function parseFormBody(schema: JsonSchemaDocument, body: Record<string, unknown>): Record<string, unknown> {
  const content: Record<string, unknown> = {};

  for (const [name, def] of Object.entries(schema.properties ?? {})) {
    if (def["x-widget"] === "json") {
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
