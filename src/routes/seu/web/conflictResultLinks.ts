import { getPlatformTenantId, CONFLICT_ENTITY_PAGES, CONFLICT_RESULT_LINK_COLUMNS, CONFLICT_SOURCE_LABEL_ENTITIES } from "../../../dblayer/constants.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";

export interface ResultLink {
  label: string;
  href: string;
  // The column and the text in that column the link belongs to, so the cell can show that text as the link.
  column: string;
  match: string;
}

type Row = Record<string, unknown>;

// The codes a cell holds: a code, or a list of codes.
function codesIn(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value]).filter((x): x is string => typeof x === "string" && x !== "");
}

// The id of every row found for a list of codes, by entity type.
async function idsByCode(entity: string, codes: string[], viewerTenantId: string): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map();
  switch (entity) {
    case "pack": return new Map(((await packsDB.findActiveByCodesVisibleTo(codes, viewerTenantId)).data ?? []).map((r) => [r.code, r.id]));
    case "deliverable": return new Map(((await deliverableDefinitionsDB.findActiveByCodesVisibleTo(codes, viewerTenantId)).data ?? []).map((r) => [r.code, r.id]));
    case "service": return new Map(((await serviceDefinitionsDB.findActiveByCodesVisibleTo(codes, viewerTenantId)).data ?? []).map((r) => [r.code, r.id]));
    case "capability": return new Map(((await capabilityDefinitionsDB.findActiveByCodesVisibleTo(codes, viewerTenantId)).data ?? []).map((r) => [r.code, r.id]));
    case "policy": return new Map(((await policyDefinitionsDB.findActiveByCodesVisibleTo(codes, viewerTenantId)).data ?? []).map((r) => [r.code, r.id]));
    case "profile": {
      const platformTenantId = await getPlatformTenantId();
      const found = await Promise.all(codes.map(async (code) => [code, ((await profilesDB.findActiveByCode(code, viewerTenantId)).data ?? (await profilesDB.findActiveByCode(code, platformTenantId)).data)?.id] as const));
      return new Map(found.filter((f): f is readonly [string, string] => f[1] !== undefined));
    }
    default: return new Map();
  }
}

// The entities a cell names, as (entity, code) pairs. A competency source is a label such as "Pack development".
function refsIn(value: unknown, entity: string): Array<{ entity: string; code: string }> {
  if (entity !== "sourceLabels") return codesIn(value).map((code) => ({ entity, code }));
  return codesIn(value).flatMap((label) => {
    const [prefix, ...rest] = label.split(" ");
    const kind = CONFLICT_SOURCE_LABEL_ENTITIES[prefix];
    return kind && rest.length > 0 ? [{ entity: kind, code: rest.join(" ") }] : [];
  });
}

// For each row of a table's "What the SEU takes", the entities it names, one link for each: the Pack, Deliverable, Service, Capability or Policy that holds the whole definition.
export async function resolveResultLinks(table: string, rows: Row[], viewerTenantId: string): Promise<ResultLink[][]> {
  const columns = CONFLICT_RESULT_LINK_COLUMNS[table] ?? {};
  const wanted = new Map<string, Set<string>>();
  for (const row of rows) for (const [column, entity] of Object.entries(columns)) {
    if (entity === "packId" || entity === "definitionPacks") continue;
    for (const ref of refsIn(row[column], entity)) wanted.set(ref.entity, (wanted.get(ref.entity) ?? new Set<string>()).add(ref.code));
  }
  const found = new Map<string, Map<string, string>>();
  for (const [entity, codes] of wanted) found.set(entity, await idsByCode(entity, [...codes], viewerTenantId));

  return rows.map((row) => {
    const links: ResultLink[] = [];
    const seen = new Set<string>();
    const add = (entity: string, code: string, id: string | undefined, column: string, match: string) => {
      const page = CONFLICT_ENTITY_PAGES[entity];
      const href = id && page ? `${page.path}/${id}` : "";
      if (!href || seen.has(href)) return;
      seen.add(href);
      links.push({ label: `${page.label} ${code}`, href, column, match });
    };
    for (const [column, entity] of Object.entries(columns)) {
      if (entity === "packId") add("pack", String(row.code ?? row[column]), typeof row[column] === "string" ? (row[column] as string) : undefined, column, String(row[column]));
      else if (entity === "definitionPacks") {
        for (const definition of Array.isArray(row[column]) ? (row[column] as Array<{ packs?: Array<{ id: string; code: string }> }>) : []) for (const pack of definition.packs ?? []) add("pack", pack.code, pack.id, column, pack.code);
      } else if (entity === "sourceLabels") {
        for (const label of codesIn(row[column])) for (const ref of refsIn(label, entity)) add(ref.entity, ref.code, found.get(ref.entity)?.get(ref.code), column, label);
      } else for (const ref of refsIn(row[column], entity)) add(ref.entity, ref.code, found.get(ref.entity)?.get(ref.code), column, ref.code);
    }
    return links;
  });
}
