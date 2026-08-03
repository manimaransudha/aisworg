import { seusDB } from "../../../dblayer/seusDB.js";
import { seuCapabilitiesDB } from "../../../dblayer/seuCapabilitiesDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { dependencyEdgesDB } from "../../../dblayer/dependencyEdgesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { dependencyEngine } from "../../../domain/engine/dependencyEngine.js";
import { getSeuEvents } from "./events.js";
import type { DependencyEdgeRow, EbmComposedPack, EventRow, SeuRow } from "../../../dblayer/seuTypes.js";

export interface SeuStatusView {
  seu: SeuRow;
  capabilities: Array<{ id: string; capabilityId: string; code: string; name: string; status: string }>;
  deliverables: Array<{ id: string; name: string; category: string; lifecycleState: string }>;
}

export async function getSeuStatus(seuId: string): Promise<SeuStatusView | null> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) return null;

  const { data: capabilities } = await seuCapabilitiesDB.findBySeuId(seuId);
  const { data: deliverables } = await deliverablesDB.findBySeuId(seuId);

  return {
    seu,
    capabilities: (capabilities ?? []).map((c) => ({ id: c.id, capabilityId: c.capability_id, code: c.capability_code, name: c.capability_name, status: c.status })),
    deliverables: (deliverables ?? []).map((d) => ({ id: d.id, name: d.name, category: d.category, lifecycleState: d.lifecycle_state })),
  };
}

export interface SeuListItem {
  id: string;
  objectiveStatement: string;
  lifecycleState: string;
  createdAt: string;
}

export async function listSeus(): Promise<SeuListItem[]> {
  const { data } = await seusDB.listWithObjectiveStatement();
  return (data ?? []).map((row) => ({
    id: row.id,
    objectiveStatement: row.objective_statement,
    lifecycleState: row.lifecycle_state,
    createdAt: row.created_at,
  }));
}

export interface SeuQuickviewItem extends SeuListItem {
  capabilitiesFulfilled: number;
  capabilitiesTotal: number;
  deliverablesAdvanced: number; // moved beyond the default 'Defined' state
  deliverablesTotal: number;
}

// Drives the post-login landing page — per-SEU progress at a glance. Single-
// tenant for now (Build Plan §5 item 13): this lists every commissioned SEU
// platform-wide, not "this Tenant's SEUs" — that scoping needs a Tenant model
// (Ch.42) this MVP doesn't have yet.
export async function getSeuQuickview(): Promise<SeuQuickviewItem[]> {
  const items = await listSeus();
  return Promise.all(
    items.map(async (item) => {
      const [{ data: capabilities }, { data: deliverables }] = await Promise.all([
        seuCapabilitiesDB.findBySeuId(item.id),
        deliverablesDB.findBySeuId(item.id),
      ]);
      return {
        ...item,
        capabilitiesFulfilled: (capabilities ?? []).filter((c) => c.status === "Fulfilled").length,
        capabilitiesTotal: capabilities?.length ?? 0,
        deliverablesAdvanced: (deliverables ?? []).filter((d) => d.lifecycle_state !== "Defined").length,
        deliverablesTotal: deliverables?.length ?? 0,
      };
    })
  );
}

export interface SeuDetailDeliverable {
  id: string;
  name: string;
  category: string;
  lifecycleState: string;
  acquisitionScope: string;
  possibleNextStates: string[];
  dependencyEdges: DependencyEdgeRow[];
}

export interface SeuDetailView {
  seu: SeuRow;
  objectiveStatement: string;
  composedPacks: EbmComposedPack[];
  capabilities: Array<{ id: string; capabilityId: string; code: string; name: string; status: string }>;
  deliverables: SeuDetailDeliverable[];
  events: EventRow[];
}

// Everything the SEU detail page renders, composed in one place so the web
// controller stays a thin render step — the same discipline as the API layer,
// just a richer read model for a human instead of a machine client.
export async function getSeuDetailView(seuId: string): Promise<SeuDetailView | null> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) return null;

  const [{ data: objective }, { data: capabilities }, { data: deliverables }, { data: ebm }, events] = await Promise.all([
    objectivesDB.findById(seu.objective_id),
    seuCapabilitiesDB.findBySeuId(seuId),
    deliverablesDB.findBySeuId(seuId),
    seu.active_ebm_id ? ebmsDB.findById(seu.active_ebm_id) : Promise.resolve({ data: null }),
    getSeuEvents(seuId),
  ]);

  const deliverableViews: SeuDetailDeliverable[] = await Promise.all(
    (deliverables ?? []).map(async (d) => {
      const [{ data: edges }, { data: nextStates }] = await Promise.all([
        dependencyEdgesDB.findByFromDeliverable(d.id),
        transitionDefinitionsDB.findPossibleNextStates("Deliverable", d.lifecycle_state),
      ]);
      // Recompute against live data before display — the stored readiness_state
      // is a write-side cache only updated as a side effect of a transition
      // attempt on this exact Deliverable, so reading it raw shows stale status
      // on every plain page load. See design/mvp-build-plan/Open Design
      // Questions.md for the related, still-open scope-of-gating question.
      const refreshedEdges = await Promise.all((edges ?? []).map((edge) => dependencyEngine.refreshEdge(edge)));
      return {
        id: d.id,
        name: d.name,
        category: d.category,
        lifecycleState: d.lifecycle_state,
        acquisitionScope: d.acquisition_scope,
        possibleNextStates: nextStates ?? [],
        dependencyEdges: refreshedEdges,
      };
    })
  );

  return {
    seu,
    objectiveStatement: objective?.statement ?? "(objective not found)",
    composedPacks: ebm?.composed_packs ?? [],
    capabilities: (capabilities ?? []).map((c) => ({ id: c.id, capabilityId: c.capability_id, code: c.capability_code, name: c.capability_name, status: c.status })),
    deliverables: deliverableViews,
    events,
  };
}
