import { templatesDB } from "../../../dblayer/templatesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
import { generateFields, groupFieldsForDisplay, toSchemaRows, type FieldGroups, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { getAuthoringDraft } from "./sdkAuthoring.js";
import { listConceptsForType } from "./ontology.js";
import { ontologySourcesIn, type PackViewRef } from "./packView.js";
import type { TemplateRow } from "../../../dblayer/seuTypes.js";

export interface DependencyGraphNode { id: string; x: number; y: number; w: number; h: number; label: string; code: string; kind: "Deliverable" | "Capability"; href: string | null }
export interface DependencyGraphEdge { path: string }
export interface DependencyGraphLayout { width: number; height: number; nodes: DependencyGraphNode[]; edges: DependencyGraphEdge[] }

const NODE_W = 220;
const NODE_H = 44;
const COLUMN_GAP = 110;
const ROW_GAP = 28;
const LABEL_MAX = 28;

function clip(text: string): string {
  return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text;
}

// Lays the dependency graph out in columns: a prerequisite sits to the left of what it gates. Returns null when there are no nodes.
function layoutDependencyGraph(
  entries: Array<Record<string, unknown>>,
  catalogueCodes: string[],
  nameOf: (kind: "Deliverable" | "Capability", code: string) => { label: string; href: string | null }
): DependencyGraphLayout | null {
  const nodes = new Map<string, DependencyGraphNode>();
  const edges: Array<{ from: string; to: string }> = [];
  const nodeFor = (kind: "Deliverable" | "Capability", code: string): string => {
    const id = `${kind}:${code}`;
    if (!nodes.has(id)) {
      const { label, href } = nameOf(kind, code);
      nodes.set(id, { id, x: 0, y: 0, w: NODE_W, h: NODE_H, label: clip(label), code, kind, href });
    }
    return id;
  };
  // Every catalogue Deliverable is a node, including those with no edge.
  for (const code of catalogueCodes) nodeFor("Deliverable", code);
  for (const e of entries) {
    const toCode = typeof e.toCode === "string" ? e.toCode : "";
    const fromType = e.fromType === "Capability" ? "Capability" : "Deliverable";
    const fromCode = fromType === "Capability" ? e.fromCapabilityCode : e.fromCode;
    if (typeof fromCode !== "string" || !fromCode) continue;
    if (!toCode) { nodeFor(fromType, fromCode); continue; }
    edges.push({ from: nodeFor(fromType, fromCode), to: nodeFor("Deliverable", toCode) });
  }
  // if (edges.length === 0) return null;
  if (nodes.size === 0) return null;
  const depth = new Map<string, number>([...nodes.keys()].map((id) => [id, 0]));
  for (let pass = 0; pass < nodes.size; pass++) {
    let changed = false;
    for (const e of edges) {
      const next = (depth.get(e.from) ?? 0) + 1;
      if (next > (depth.get(e.to) ?? 0) && next < nodes.size) { depth.set(e.to, next); changed = true; }
    }
    if (!changed) break;
  }
  const rowInColumn = new Map<number, number>();
  for (const node of nodes.values()) {
    const column = depth.get(node.id) ?? 0;
    const row = rowInColumn.get(column) ?? 0;
    rowInColumn.set(column, row + 1);
    node.x = column * (NODE_W + COLUMN_GAP);
    node.y = row * (NODE_H + ROW_GAP);
  }
  const columns = Math.max(...rowInColumn.keys()) + 1;
  const rows = Math.max(...rowInColumn.values());
  const laidEdges = edges.map((e) => {
    const a = nodes.get(e.from)!;
    const b = nodes.get(e.to)!;
    const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
    const dx = Math.max(40, (x2 - x1) / 2);
    return { path: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}` };
  });
  return { width: columns * NODE_W + (columns - 1) * COLUMN_GAP, height: rows * NODE_H + (rows - 1) * ROW_GAP, nodes: [...nodes.values()], edges: laidEdges };
}

// The dependency graph of an object being edited, drawn from its catalogue and graph entries. A node carries no link.
export async function buildDependencyGraphLayout(content: Record<string, unknown>, viewer: { isRoot: boolean; tenantId: string | null }): Promise<DependencyGraphLayout | null> {
  const deliverableLabels = Object.fromEntries((await listConceptsForType("deliverable-name", viewer)).map((c) => [c.code, c.default_label]));
  const capabilityLabels = Object.fromEntries((await listConceptsForType("capability-name", viewer)).map((c) => [c.code, c.default_label]));
  const catalogueCodes = (Array.isArray(content.deliverableCatalogue) ? content.deliverableCatalogue : []).map((r) => (r as Record<string, unknown>)?.code).filter((c): c is string => typeof c === "string" && c.trim() !== "");
  return layoutDependencyGraph(
    Array.isArray(content.dependencyGraph) ? (content.dependencyGraph as Array<Record<string, unknown>>) : [],
    catalogueCodes,
    (kind, code) => ({ label: (kind === "Capability" ? capabilityLabels[code] : deliverableLabels[code]) ?? code, href: null })
  );
}

export interface TemplateViewData {
  template: TemplateRow;
  // The same tab set as the authoring page: the schema's x-groups and the Exposable Parameters tab.
  groups: FieldGroups;
  content: Record<string, unknown>;
  labels: Record<string, Record<string, string>>;
  // Referenced Packs and Deliverable Definitions, keyed by referential source and then by code.
  refs: Record<string, Record<string, PackViewRef>>;
  // The name of the Service or Policy behind each exposed parameter, keyed "<sourceType>::<sourceCode>".
  parameterSources: Record<string, string>;
  // The dependency graph drawn in columns, or null when the Template has none.
  graph: DependencyGraphLayout | null;
}

// One Template for the Registry view page. Returns null when the row does not exist or is not visible to the viewer's tenant.
export async function getTemplateView(id: string, viewer: { isRoot: boolean; tenantId: string | null }): Promise<TemplateViewData | null> {
  const { data: template, error } = await templatesDB.findById(id);
  if (error) throw error;
  if (!template) return null;
  const platformTenantId = await getPlatformTenantId();
  if (!viewer.isRoot && template.tenant_id !== platformTenantId && template.tenant_id !== viewer.tenantId) return null;
  const { data: pinned } = template.schema_definition_id ? await schemaDefinitionsDB.findById(template.schema_definition_id) : { data: null };
  const schemaRow = pinned ?? (await schemaDefinitionsDB.findLatest("Template")).data;
  if (!schemaRow) throw new Error("no schema_definitions grammar for Template");
  const schema = schemaRow.schema as JsonSchemaDocument;
  const draft = await getAuthoringDraft("Template", id);
  if (!draft) return null;
  const content = toSchemaRows(schema, draft.content);
  const fields = generateFields(schema, content);
  const labels: Record<string, Record<string, string>> = {};
  for (const source of ontologySourcesIn(fields)) {
    const concepts = await listConceptsForType(source, viewer);
    labels[source] = Object.fromEntries(concepts.map((c) => [c.code, c.default_label]));
  }
  const tenantId = viewer.tenantId ?? platformTenantId;
  const rowCodes = (v: unknown, key: string): string[] => (Array.isArray(v) ? v.map((r) => (r as Record<string, unknown>)?.[key]).filter((x): x is string => typeof x === "string") : []);
  const refs: Record<string, Record<string, PackViewRef>> = { "pack-code": {}, "deliverable-name": {} };
  const packCodes = Object.entries(content).filter(([name]) => /PackCodes$/.test(name)).flatMap(([, rows]) => rowCodes(rows, "packCode"));
  for (const code of new Set(packCodes)) {
    const { data: own } = await packsDB.findActiveByCode(code, tenantId);
    const found = own ?? (await packsDB.findActiveByCode(code, platformTenantId)).data;
    if (found) refs["pack-code"][code] = { name: found.name, note: found.category, id: found.id, mandatory: found.installation_classification === "Mandatory" };
  }
  for (const code of new Set(rowCodes(content.deliverableCatalogue, "code"))) {
    const { data: deliverable } = await deliverableDefinitionsDB.findActiveByCodeVisibleTo(code, viewer.tenantId);
    if (deliverable) refs["deliverable-name"][code] = { name: labels["deliverable-name"]?.[code] ?? code, note: deliverable.description, id: deliverable.id };
  }
  const parameterSources: Record<string, string> = {};
  for (const p of Array.isArray(content.exposedParameters) ? (content.exposedParameters as Array<Record<string, unknown>>) : []) {
    const type = String(p.sourceType ?? "");
    const code = String(p.sourceCode ?? "");
    const { data: source } = type === "service" ? await serviceDefinitionsDB.findActiveByCodeVisibleTo(code, tenantId) : type === "policy" ? await policyDefinitionsDB.findActiveByCodeVisibleTo(code, tenantId) : { data: null };
    if (source) parameterSources[`${type}::${code}`] = source.name;
  }
  const capabilityLabels = Object.fromEntries((await listConceptsForType("capability-name", viewer)).map((c) => [c.code, c.default_label]));
  const graph = layoutDependencyGraph(Array.isArray(content.dependencyGraph) ? (content.dependencyGraph as Array<Record<string, unknown>>) : [], rowCodes(content.deliverableCatalogue, "code"), (kind, code) =>
    kind === "Capability"
      ? { label: capabilityLabels[code] ?? code, href: null }
      : { label: labels["deliverable-name"]?.[code] ?? code, href: refs["deliverable-name"][code]?.id ? `/aisworg/seu/deliverable-definitions/${refs["deliverable-name"][code].id}` : null }
  );
  return { template, groups: groupFieldsForDisplay(schema, fields), content, labels, refs, parameterSources, graph };
}
