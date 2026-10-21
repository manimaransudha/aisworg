import { packsDB } from "../../../dblayer/packsDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import type { JsonSchemaDocument, JsonSchemaProperty } from "../../../domain/sdk/formGenerator.js";
import { listConceptsForType } from "./ontology.js";
import { listActiveNouns, activeMappingByNoun } from "./authorityVocabulary.js";
import { validateChecklistIds, validatePolicyCodes } from "./packs.js";
import { REFERENCEABLE_PACK_STATUSES } from "../../../dblayer/constants.js";
import { PACK_SELECTION_SLOTS, deriveCapabilityCodesFromPackCodes } from "./templates.js";

type Viewer = { isRoot: boolean; tenantId: string | null };

const conceptCodes = (conceptType: string) => async (viewer: Viewer): Promise<string[]> =>
  [...new Set((await listConceptsForType(conceptType, viewer, false)).map((c) => c.code))].sort();

// One loader per x-referential source, so a caller reads only the sources it needs.
const SOURCE_LOADERS: Record<string, (viewer: Viewer) => Promise<string[]>> = {
  "pack-code": async (viewer) => {
    const { data: packs } = viewer.isRoot || !viewer.tenantId ? await packsDB.findAll() : await packsDB.findAllVisibleTo(viewer.tenantId);
    return [...new Set((packs ?? []).filter((p) => p.status === "Active").map((p) => p.code))].sort();
  },
  "template-code": async () => {
    const { data: templates } = await templatesDB.findAllActive();
    return [...new Set((templates ?? []).map((t) => t.code))].sort();
  },
  "deliverable-name": async (viewer) => [...new Set((await listConceptsForType("deliverable-name", viewer, false)).map((c) => c.default_label))].sort(),
  "feature-flag": conceptCodes("feature-flag"),
  "category:evidence": conceptCodes("category:evidence"),
  "category:policy": conceptCodes("category:policy"),
  "category:obligation": conceptCodes("category:obligation"),
  "category:obligation-origin": conceptCodes("category:obligation-origin"),
  "service-name": conceptCodes("service-name"),
  "capability-name": conceptCodes("capability-name"),
  "engineering-capital": conceptCodes("engineering-capital"),
  "compliance-name": conceptCodes("compliance-name"),
  "role-name": conceptCodes("role-name"),
  "worktype-name": conceptCodes("worktype-name"),
  "dispatch-strategy-preference": conceptCodes("dispatch-strategy-preference"),
  "transition-definition": async () => {
    const { data } = await transitionDefinitionsDB.listAll();
    return [...new Set((data ?? []).filter((t) => t.is_active).map((t) => `${t.entity_type}|${t.from_state}|${t.to_state}`))].sort();
  },
  "noun": async () => (await listActiveNouns()).map((n) => n.code).sort(),
  "authority-badge": async () => Object.entries(await activeMappingByNoun()).flatMap(([noun, verbs]) => verbs.map((verb) => `${noun}_${verb}`)).sort(),
};

// The values each x-referential source offers. The web form reads every source; policy-validate-schema (CR-128) reads only the sources its schema uses.
export async function loadReferentialOptions(viewer: Viewer, sources: string[] = Object.keys(SOURCE_LOADERS)): Promise<Record<string, string[]>> {
  const wanted = sources.filter((source) => SOURCE_LOADERS[source]);
  const lists = await Promise.all(wanted.map((source) => SOURCE_LOADERS[source](viewer)));
  return Object.fromEntries(wanted.map((source, i) => [source, lists[i]]));
}

function selfReferentialFieldNamesIn(schema: JsonSchemaDocument): string[] {
  const names = new Set<string>();
  for (const def of Object.values(schema.properties ?? {})) {
    if (def["x-widget"] !== "referential-list") continue;
    for (const itemDef of Object.values(def.items?.properties ?? {})) {
      const source = itemDef["x-referential"];
      if (source?.startsWith("self:")) names.add(source.slice("self:".length));
    }
  }
  return [...names];
}

export function loadSelfReferentialOptions(schema: JsonSchemaDocument, content: Record<string, unknown>): Record<string, string[]> {
  const options: Record<string, string[]> = {};
  for (const fieldName of selfReferentialFieldNamesIn(schema)) {
    const rows = Array.isArray(content[fieldName]) ? (content[fieldName] as Array<Record<string, unknown>>) : [];
    const identityKey = schema.properties?.[fieldName]?.items?.properties?.code ? "code" : "name";
    options[`self:${fieldName}`] = [...new Set(rows.map((r) => (typeof r[identityKey] === "string" ? (r[identityKey] as string) : "")).filter(Boolean))];
  }
  return options;
}

export function extractPackCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => (typeof row === "string" ? row : (row as Record<string, unknown> | null)?.packCode))
    .filter((code): code is string => typeof code === "string" && code.trim() !== "");
}

// The list-backed sources named by the schema's non-Ontology referential fields. Pack sources read the Packs when checked.
function referentialSourcesUsedBy(schema: JsonSchemaDocument): string[] {
  const sources = new Set<string>();
  const add = (def: JsonSchemaProperty) => {
    const byValue = def["x-referential-source-by-value"];
    const sourcesOfField = byValue ? [byValue.default, ...Object.values(byValue.values)].filter((v) => !v.ontology).map((v) => v.source) : [sourceOf(def)];
    for (const source of sourcesOfField) if (source && def["x-ontology"] !== true && source !== "pack-code" && !source.startsWith("pack-code:")) sources.add(source);
    Object.values(def.items?.properties ?? def.properties ?? {}).forEach(add);
  };
  for (const def of Object.values(schema.properties ?? {})) {
    if (def["x-widget"] === "referential-list") Object.values(def.items?.properties ?? {}).forEach(add);
    else if (def["x-widget"] === "referential-select" || def["x-widget"] === "referential-multi-select") add(def);
  }
  return [...sources];
}

export async function loadDerivedPackCapabilityOptions(content: Record<string, unknown>): Promise<Record<string, string[]>> {
  const packCodes = [...new Set(PACK_SELECTION_SLOTS.flatMap((slot) => extractPackCodes(content[slot.field as string])))];
  const derived = await deriveCapabilityCodesFromPackCodes(packCodes);
  return { "derived:requiredCapabilityCodes": derived.sort() };
}

// Sources whose values depend on the entity's own content, not on a list: a reference is a name or code the entity declares, or a published record owned by a Pack with the same code.
const CONTENT_BOUND_SOURCES: Record<string, (refs: string[], content: Record<string, unknown>, context: string) => Promise<string[]>> = {
  checklist: (refs, content, context) => validateChecklistIds(refs, declaredChecklistNames(content), String(content.code ?? ""), context),
  policy: (refs, content, context) => validatePolicyCodes(refs, declaredPolicyCodes(content), String(content.code ?? ""), context),
};

function declaredChecklistNames(content: Record<string, unknown>): string[] {
  const rows = Array.isArray(content.contributionChecklists) ? (content.contributionChecklists as Array<Record<string, unknown>>) : [];
  return rows.map((r) => (typeof r?.name === "string" ? r.name : "")).filter(Boolean);
}

function declaredPolicyCodes(content: Record<string, unknown>): string[] {
  return Array.isArray(content.contributionPolicies) ? (content.contributionPolicies as unknown[]).filter((v): v is string => typeof v === "string") : [];
}

function valuesOf(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  return typeof raw === "string" && raw.trim() !== "" ? [raw] : [];
}

// A source name on a field: the plain `x-referential` or `x-referential-source`, or `derived:<name>` for `x-referential-source-derived-by`.
function sourceOf(def: JsonSchemaProperty, topLevelContent?: Record<string, unknown>): string | null {
  if (def["x-referential-source-derived-by"]) return `derived:${def["x-referential-source-derived-by"]}`;
  // A source driven by another field's value (the Policy applicability row name, by scope). An Ontology source is checked against the Ontology elsewhere.
  const byValue = def["x-referential-source-by-value"];
  if (byValue && topLevelContent) {
    const resolved = byValue.values[String(topLevelContent[byValue.field] ?? "")] ?? byValue.default;
    return resolved.ontology ? null : resolved.source;
  }
  return def["x-referential"] ?? def["x-referential-source"] ?? null;
}

// `pack-code` and `pack-code:<Category>` offer the Packs that are Active or past Active (the form's dropdown still lists Active Packs only). Every other source reads the option lists.
async function optionsForSource(source: string, options: Record<string, string[]>, viewer: { isRoot: boolean; tenantId: string | null }): Promise<string[] | undefined> {
  if (source !== "pack-code" && !source.startsWith("pack-code:")) return options[source];
  const category = source === "pack-code" ? null : source.slice("pack-code:".length);
  const { data: packs } = viewer.isRoot || !viewer.tenantId ? await packsDB.findAll() : await packsDB.findAllVisibleTo(viewer.tenantId);
  const statuses: readonly string[] = REFERENCEABLE_PACK_STATUSES;
  return [...new Set((packs ?? []).filter((p) => statuses.includes(p.status) && (category === null || p.category === category)).map((p) => p.code))];
}

// Every field that names an x-referential source holds only values that source offers: the item fields of a
// referential-list, and the top-level referential-select fields. Fields marked x-ontology are checked against the
// Ontology elsewhere. A source with no resolver is an error, not a silent pass.
export async function validateReferentialFields(schema: JsonSchemaDocument, content: Record<string, unknown>, viewer: { isRoot: boolean; tenantId: string | null }): Promise<string[]> {
  const errors: string[] = [];
  const used = referentialSourcesUsedBy(schema);
  const options = {
    ...(await loadReferentialOptions(viewer, used)),
    ...loadSelfReferentialOptions(schema, content),
    ...(used.some((source) => source.startsWith("derived:")) ? await loadDerivedPackCapabilityOptions(content) : {}),
  };
  const packOptions = new Map<string, Promise<string[] | undefined>>();

  async function check(def: JsonSchemaProperty, values: string[], context: string): Promise<void> {
    const source = sourceOf(def, content);
    if (!source || def["x-ontology"] === true || values.length === 0) return;
    const contentBound = CONTENT_BOUND_SOURCES[source];
    if (contentBound) { errors.push(...(await contentBound(values, content, context))); return; }
    if (!packOptions.has(source)) packOptions.set(source, optionsForSource(source, options, viewer));
    const offered = await packOptions.get(source);
    if (!offered) throw new Error(`no resolver for the referential source "${source}" (${context})`);
    for (const v of values) if (!offered.includes(v)) errors.push(`${context}: "${v}" is not offered by the "${source}" source`);
  }

  // The arrays and objects nested inside a row: their fields are checked like the row's own fields.
  async function checkNested(def: JsonSchemaProperty, value: unknown, context: string): Promise<void> {
    const nestedRows: Array<[Record<string, JsonSchemaProperty>, Record<string, unknown>, string]> = [];
    if (def.type === "array" && def.items?.properties && Array.isArray(value)) {
      for (const [i, row] of value.entries()) if (row && typeof row === "object") nestedRows.push([def.items.properties, row as Record<string, unknown>, `${context} row ${i + 1}`]);
    } else if (def.type === "object" && def.properties && value && typeof value === "object" && !Array.isArray(value)) {
      nestedRows.push([def.properties, value as Record<string, unknown>, context]);
    }
    for (const [props, row, label] of nestedRows) {
      for (const [fieldName, fieldDef] of Object.entries(props)) {
        await check(fieldDef, valuesOf(row[fieldName]), `${label} "${fieldName}"`);
        await checkNested(fieldDef, row[fieldName], `${label} "${fieldName}"`);
      }
    }
  }

  for (const [name, def] of Object.entries(schema.properties ?? {})) {
    if (def["x-widget"] === "referential-list") {
      const rows = Array.isArray(content[name]) ? (content[name] as Array<Record<string, unknown>>) : [];
      for (const [fieldName, fieldDef] of Object.entries(def.items?.properties ?? {}) as Array<[string, JsonSchemaProperty]>) {
        for (const [i, row] of rows.entries()) {
          await check(fieldDef, valuesOf(row?.[fieldName]), `"${name}" row ${i + 1} "${fieldName}"`);
          await checkNested(fieldDef, row?.[fieldName], `"${name}" row ${i + 1} "${fieldName}"`);
        }
      }
    } else if (def["x-widget"] === "referential-select" || def["x-widget"] === "referential-multi-select") {
      await check(def, valuesOf(content[name]), `"${name}"`);
    }
  }
  return errors;
}
