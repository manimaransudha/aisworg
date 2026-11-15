import { getSeuDetailView } from "./seus.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import { qualityGatesDB } from "../../../dblayer/qualityGatesDB.js";
import { qualityGateEvaluationsDB } from "../../../dblayer/qualityGateEvaluationsDB.js";
import { dependencyDefinitionsDB } from "../../../dblayer/dependencyDefinitionsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { resolveSeuOwningScope } from "../../../domain/engine/deliverableSource.js";
import { dependencyDefinitionEngine } from "../../../domain/engine/dependencyDefinitionEngine.js";
import { RESOLVED_OBLIGATION_STATUSES } from "../../../domain/engine/qualityGateEngine.js";
import { EEG_BLOCKED_STATE, EEG_COLOUR_CONCEPT_TYPE, EEG_LAYOUT, EEG_NODE_TAB, EEG_SHAPE_CONCEPT_TYPE } from "../../../dblayer/constants.js";
import type { DependencyDefinitionRow, QualityGateEvaluationRow } from "../../../dblayer/seuTypes.js";

export interface GraphDetail {
  label: string;
  value: string;
}

export interface GraphQualityGateResult {
  gate: string;
  outcome: string;
  evaluatedAt: string;
  detail: string;
}

export interface GraphNode {
  id: string;
  kind: string;
  label: string;
  state: string;
  shape: string;
  colour: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tab: string;
  details: GraphDetail[];
  qualityGateResults: GraphQualityGateResult[];
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  // Whether the blocker no longer blocks. Null when the blocker has no state that can be reached.
  satisfied: boolean | null;
}

export interface SeuGraph {
  seuId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  asOf: string;
}

type RawNode = Omit<GraphNode, "shape" | "colour" | "x" | "y" | "width" | "height" | "tab" | "qualityGateResults">;

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

// Every column of a row, as label and value, so the details pane shows all the details of the entity.
function detailsOf(row: object): GraphDetail[] {
  return Object.entries(row).map(([key, value]) => ({ label: key, value: text(value) }));
}

// Each node is placed in the layer after the last layer of the nodes that block it.
function layOut(nodeIds: string[], edges: GraphEdge[]): Map<string, { layer: number; row: number }> {
  const layerOf = new Map(nodeIds.map((id) => [id, 0]));
  for (let pass = 0; pass < nodeIds.length; pass++) {
    let changed = false;
    for (const edge of edges) {
      const next = (layerOf.get(edge.from) ?? 0) + 1;
      if (next > (layerOf.get(edge.to) ?? 0) && next < nodeIds.length) {
        layerOf.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const rowInLayer = new Map<number, number>();
  const placement = new Map<string, { layer: number; row: number }>();
  for (const id of nodeIds) {
    const layer = layerOf.get(id) ?? 0;
    const row = rowInLayer.get(layer) ?? 0;
    rowInLayer.set(layer, row + 1);
    placement.set(id, { layer, row });
  }
  return placement;
}

export async function getSeuGraph(seuId: string): Promise<SeuGraph | null> {
  const detail = await getSeuDetailView(seuId);
  if (!detail) return null;
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) return null;

  const [{ data: shapeConcepts }, { data: colourConcepts }, { data: services }, { data: gateEvaluations }] = await Promise.all([
    ontologyDB.findConceptsByType(EEG_SHAPE_CONCEPT_TYPE, { isRoot: false, tenantId: null }),
    ontologyDB.findConceptsByType(EEG_COLOUR_CONCEPT_TYPE, { isRoot: false, tenantId: null }),
    servicesDB.findAll(),
    qualityGateEvaluationsDB.findBySeuId(seuId),
  ]);
  const shapeByKind = new Map((shapeConcepts ?? []).map((c) => [c.code, c.default_label]));
  const colourByKey = new Map((colourConcepts ?? []).map((c) => [c.code, c.default_label]));
  const capabilityIdByServiceCode = new Map((services ?? []).map((s) => [s.code, s.providing_capability_id]));

  const rawNodes = new Map<string, RawNode>();
  const edges: GraphEdge[] = [];

  const scope = await resolveSeuOwningScope(seu);

  const deliverableNodeIdByName = new Map<string, string>();
  for (const d of detail.deliverables) deliverableNodeIdByName.set(d.name, d.id);
  const capabilityNodeIdByCapabilityId = new Map(detail.capabilities.map((c) => [c.capabilityId, c.id]));

  async function hopLabel(fromState: string | null, toState: string | null): Promise<string> {
    if (!toState) return "any hop";
    if (!fromState) return `to ${toState}`;
    const { data: definition } = await transitionDefinitionsDB.find("Deliverable", fromState, toState);
    return definition?.verb ? `${definition.verb} (${fromState} → ${toState})` : `${fromState} → ${toState}`;
  }

  // Deliverables, with their blockers.
  const blockedDeliverableIds = new Set<string>();
  for (const d of detail.deliverables) {
    if (d.blockedBy.length > 0) blockedDeliverableIds.add(d.id);
  }

  for (const c of detail.capabilities) {
    rawNodes.set(c.id, { id: c.id, kind: "Capability", label: `${c.name} (${c.code})`, state: c.status, details: detailsOf({ id: c.id, capabilityId: c.capabilityId, code: c.code, name: c.name, status: c.status }) });
  }

  // Obligations that block a hop, of the SEU or of a Deliverable.
  for (const o of detail.obligations) {
    const row = o.obligation;
    if (!row.blocked_to_state) continue;
    const isOpen = !RESOLVED_OBLIGATION_STATUSES.has(row.status);
    if (isOpen && row.related_object_type === "Deliverable" && detail.deliverables.some((d) => d.id === row.related_object_id)) blockedDeliverableIds.add(row.related_object_id);
    rawNodes.set(row.id, { id: row.id, kind: "Obligation", label: row.title, state: row.status, details: detailsOf(row) });
    const targets = row.related_object_type === "SEU" ? detail.deliverables : detail.deliverables.filter((d) => d.id === row.related_object_id);
    for (const d of targets) {
      edges.push({ id: `${row.id}>${d.id}`, from: row.id, to: d.id, label: `${await hopLabel(row.blocked_from_state, row.blocked_to_state)}${row.related_object_type === "SEU" ? " · SEU-wide" : ""}`, satisfied: !isOpen });
    }
  }

  // Decisions of a Deliverable block every hop of it until Approved.
  for (const dec of detail.decisions) {
    const relatedDeliverableIds = dec.decision.related_objects.filter((g) => g.related_object_type === "Deliverable").flatMap((g) => g.related_object_ids).filter((id) => detail.deliverables.some((d) => d.id === id));
    if (relatedDeliverableIds.length === 0) continue;
    const approved = await dependencyDefinitionEngine.isReachedOrPassed("Decision", "Approved", dec.decision.status);
    rawNodes.set(dec.decision.id, { id: dec.decision.id, kind: "Decision", label: dec.decision.title, state: dec.decision.status, details: detailsOf(dec.decision) });
    for (const deliverableId of relatedDeliverableIds) {
      if (!approved) blockedDeliverableIds.add(deliverableId);
      edges.push({ id: `${dec.decision.id}>${deliverableId}`, from: dec.decision.id, to: deliverableId, label: "any hop", satisfied: approved });
    }
  }

  // Dependency rows of each Deliverable.
  for (const d of detail.deliverables) {
    const { data: rows } = await dependencyDefinitionsDB.findByTargetName(scope, "Deliverable", d.name);
    for (const row of (rows ?? []) as DependencyDefinitionRow[]) {
      const satisfied = await dependencyDefinitionEngine.isRowSatisfied(seuId, row);
      const label = `${await hopLabel(d.lifecycleState, row.to_state)} · needs ${row.from_state}`;
      if (row.from_entity_type === "Deliverable" && row.from_name) {
        const fromId = deliverableNodeIdByName.get(row.from_name);
        if (fromId) edges.push({ id: `${row.id}>${d.id}`, from: fromId, to: d.id, label, satisfied });
      } else if (row.from_entity_type === "Capability" && row.from_name) {
        const capabilityId = capabilityIdByServiceCode.get(row.from_name);
        const fromId = capabilityId ? capabilityNodeIdByCapabilityId.get(capabilityId) : undefined;
        if (fromId) edges.push({ id: `${row.id}>${d.id}`, from: fromId, to: d.id, label, satisfied });
      } else if (row.from_entity_type === "Obligation") {
        for (const o of detail.obligations.filter((v) => v.obligation.related_object_type === "Deliverable" && v.obligation.related_object_id === d.id)) {
          rawNodes.set(o.obligation.id, { id: o.obligation.id, kind: "Obligation", label: o.obligation.title, state: o.obligation.status, details: detailsOf(o.obligation) });
          edges.push({ id: `${row.id}>${o.obligation.id}>${d.id}`, from: o.obligation.id, to: d.id, label, satisfied });
        }
      } else if (row.from_entity_type === "Decision") {
        for (const dec of detail.decisions.filter((v) => v.decision.related_objects.some((g) => g.related_object_type === "Deliverable" && g.related_object_ids.includes(d.id)))) {
          rawNodes.set(dec.decision.id, { id: dec.decision.id, kind: "Decision", label: dec.decision.title, state: dec.decision.status, details: detailsOf(dec.decision) });
          edges.push({ id: `${row.id}>${dec.decision.id}>${d.id}`, from: dec.decision.id, to: d.id, label, satisfied });
        }
      } else if (row.from_entity_type === "Evidence") {
        for (const e of detail.evidence.filter((v) => v.relationships.some((r) => r.related_object_type === "Deliverable" && r.related_object_id === d.id))) {
          rawNodes.set(e.evidence.id, { id: e.evidence.id, kind: "Evidence", label: e.evidence.title, state: e.evidence.status, details: detailsOf(e.evidence) });
          edges.push({ id: `${row.id}>${e.evidence.id}>${d.id}`, from: e.evidence.id, to: d.id, label, satisfied });
        }
      } else if (row.from_entity_type === "Knowledge") {
        for (const k of detail.knowledgeItems.filter((v) => v.knowledgeItem.deliverable_id === d.id)) {
          rawNodes.set(k.knowledgeItem.id, { id: k.knowledgeItem.id, kind: "Knowledge", label: k.knowledgeItem.title, state: k.knowledgeItem.status, details: detailsOf(k.knowledgeItem) });
          edges.push({ id: `${row.id}>${k.knowledgeItem.id}>${d.id}`, from: k.knowledgeItem.id, to: d.id, label, satisfied });
        }
      }
    }

    // A Command already in flight for a hop of the Deliverable blocks the same hop.
    for (const toState of d.possibleNextStates) {
      const { data: command } = await commandsDB.findInFlight("Deliverable", d.id, d.lifecycleState, toState);
      if (!command) continue;
      blockedDeliverableIds.add(d.id);
      rawNodes.set(command.id, { id: command.id, kind: "Command", label: command.command_type, state: command.status, details: detailsOf(command) });
      edges.push({ id: `${command.id}>${d.id}`, from: command.id, to: d.id, label: await hopLabel(command.from_state, command.to_state), satisfied: false });
    }
  }

  // The latest stored Quality Gate result of each gate for each entity. The graph reads the stored rows and never evaluates a gate.
  const latestByEntityAndGate = new Map<string, QualityGateEvaluationRow>();
  for (const evaluation of gateEvaluations ?? []) {
    const key = `${evaluation.entity_id}|${evaluation.quality_gate_id}`;
    if (!latestByEntityAndGate.has(key)) latestByEntityAndGate.set(key, evaluation);
  }
  const { data: gates } = await qualityGatesDB.findByIds([...new Set([...latestByEntityAndGate.values()].map((e) => e.quality_gate_id))]);
  const gateNameById = new Map((gates ?? []).map((g) => [g.id, g.name]));
  const gateResultsOf = (entityId: string): GraphQualityGateResult[] =>
    [...latestByEntityAndGate.values()]
      .filter((e) => e.entity_id === entityId)
      .map((e) => ({ gate: gateNameById.get(e.quality_gate_id) ?? e.quality_gate_id, outcome: e.outcome, evaluatedAt: e.evaluated_at, detail: text(e.detail) }));
  for (const d of detail.deliverables) {
    if (gateResultsOf(d.id).some((r) => r.outcome === "Blocked")) blockedDeliverableIds.add(d.id);
  }

  for (const d of detail.deliverables) {
    const row = { ...d, blockedBy: d.blockedBy.map((b) => `${b.kind}: ${b.label} (to ${b.toState})`), dependencyEdges: d.dependencyEdges.map((e) => `${e.dependencyType} ${e.targetLabel} at ${e.requiredState} — ${e.readinessState}`), participants: d.participants };
    rawNodes.set(d.id, { id: d.id, kind: "Deliverable", label: d.name, state: d.lifecycleState, details: detailsOf(row) });
  }

  const nodeIds = [...rawNodes.keys()];
  const placement = layOut(nodeIds, edges);

  const nodes: GraphNode[] = nodeIds.map((id) => {
    const raw = rawNodes.get(id)!;
    const shape = shapeByKind.get(raw.kind);
    if (!shape) throw new Error(`[seuGraph] no ${EEG_SHAPE_CONCEPT_TYPE} concept for "${raw.kind}"`);
    const displayState = raw.kind === "Deliverable" && blockedDeliverableIds.has(id) ? EEG_BLOCKED_STATE : raw.state;
    const colour = colourByKey.get(`${raw.kind}|${displayState}`);
    if (!colour) throw new Error(`[seuGraph] no ${EEG_COLOUR_CONCEPT_TYPE} concept for "${raw.kind}|${displayState}"`);
    const tab = EEG_NODE_TAB[raw.kind];
    if (!tab) throw new Error(`[seuGraph] no SEU page tab for "${raw.kind}"`);
    const place = placement.get(id)!;
    return {
      ...raw,
      state: displayState,
      shape,
      colour,
      x: EEG_LAYOUT.margin + place.layer * EEG_LAYOUT.layerWidth,
      y: EEG_LAYOUT.margin + place.row * EEG_LAYOUT.rowHeight,
      width: EEG_LAYOUT.nodeWidth,
      height: EEG_LAYOUT.nodeHeight,
      tab,
      qualityGateResults: gateResultsOf(id),
    };
  });

  return { seuId, nodes, edges, asOf: new Date().toISOString() };
}
