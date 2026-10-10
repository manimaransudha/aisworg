import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { dependencyDefinitionsDB, type DependencyOwningScope } from "../../../dblayer/dependencyDefinitionsDB.js";
import { dependencyDefinitionEngine } from "../../../domain/engine/dependencyDefinitionEngine.js";
import { attestationsDB } from "../../../dblayer/attestationsDB.js";
import { deliverableReferencesDB } from "../../../dblayer/deliverableReferencesDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { evidenceDB } from "../../../dblayer/evidenceDB.js";
import { decisionsDB } from "../../../dblayer/decisionsDB.js";
import { obligationsDB } from "../../../dblayer/obligationsDB.js";
import { knowledgeItemsDB } from "../../../dblayer/knowledgeItemsDB.js";
import { reviewsDB } from "../../../dblayer/reviewsDB.js";
import { findingsDB } from "../../../dblayer/findingsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { resolveSystemActor } from "./attentionItems.js";

export interface ProvenanceEntry {
  fromState: string;
  toState: string;
  reference: string | null;
  participantLabel: string | null;
  certified: boolean;
  actingBadgeType: string | null;
  at: string;
}

export interface DependencyLink {
  type: "Deliverable" | "Capability";
  targetId: string | null;
  targetLabel: string;
  requiredState: string | null;
  readinessState: string;
}

export interface RelatedArtifact {
  id: string;
  title: string;
  status: string;
}

export interface DeliverableExplanation {
  deliverable: { id: string; name: string; seuId: string; lifecycleState: string };
  producingCapability: { id: string; label: string } | null;
  provenance: ProvenanceEntry[];
  dependsOn: DependencyLink[];
  supportingEvidence: RelatedArtifact[];
  supportingDecisions: RelatedArtifact[];
  knowledge: RelatedArtifact[];
  obligations: RelatedArtifact[];
  reviews: Array<{ id: string; category: string; name: string; status: string; outcome: string | null }>;
  findings: Array<{ id: string; reviewId: string; severity: string; title: string; status: string; obligationId: string | null }>;
}

export interface ImpactNode {
  deliverableId: string;
  name: string;
  lifecycleState: string;
  requiredState: string | null;
  readinessState: string;
  dependencyEdgeId: string;
}

export interface DeliverableImpact {
  deliverable: { id: string; name: string; seuId: string; lifecycleState: string };
  impacted: ImpactNode[];
}

async function participantLabel(participantId: string | null): Promise<string | null> {
  if (!participantId) return null;
  const { data } = await participantsDB.findById(participantId);
  return data ? `${data.display_name} (${data.type})` : "(unknown Participant)";
}

async function resolveOwningScope(seu: { template_id: string; profile_id: string; active_ebm_id: string | null }): Promise<DependencyOwningScope> {
  const { data: ebm } = seu.active_ebm_id ? await ebmsDB.findById(seu.active_ebm_id) : { data: null };
  return { templateId: seu.template_id, profileId: seu.profile_id, packIds: (ebm?.composed_packs ?? []).map((p) => p.packId) };
}

export async function explainDeliverable(deliverableId: string): Promise<DeliverableExplanation | null> {
  const { data: deliverable } = await deliverablesDB.findById(deliverableId);
  if (!deliverable) return null;

  const { data: seu } = await seusDB.findById(deliverable.seu_id);
  if (!seu) return null;
  const scope = await resolveOwningScope(seu);

  const [{ data: references }, { data: attestations }, { data: rows }, { data: evidence }, { data: decisions }, { data: obligations }, { data: knowledge }, { data: reviews }, { data: findings }] =
    await Promise.all([
      deliverableReferencesDB.findByDeliverableId(deliverableId),
      attestationsDB.findByDeliverableId(deliverableId),
      dependencyDefinitionsDB.findByTargetName(scope, "Deliverable", deliverable.name),
      evidenceDB.findByRelatedObject("Deliverable", deliverableId),
      decisionsDB.findByRelatedObject("Deliverable", deliverableId),
      obligationsDB.findByRelatedObject("Deliverable", deliverableId),
      knowledgeItemsDB.findByDeliverableId(deliverableId),
      reviewsDB.findByRelatedObject("Deliverable", deliverableId),
      findingsDB.findByRelatedObject("Deliverable", deliverableId),
    ]);

  const attestationByTransition = new Map((attestations ?? []).map((a) => [`${a.from_state}->${a.to_state}`, a] as const));

  const provenance: ProvenanceEntry[] = [];
  for (const ref of (references ?? []).slice().reverse()) {
    const att = attestationByTransition.get(`${ref.from_state}->${ref.to_state}`);
    provenance.push({
      fromState: ref.from_state,
      toState: ref.to_state,
      reference: ref.reference,
      participantLabel: await participantLabel(ref.participant_id),
      certified: Boolean(att),
      actingBadgeType: att?.acting_badge_type ?? null,
      at: ref.created_at,
    });
  }

  let producingCapability: { id: string; label: string } | null = null;
  if (deliverable.producing_capability_id) {
    const { data: cap } = await capabilitiesDB.findById(deliverable.producing_capability_id);
    producingCapability = cap ? { id: cap.id, label: `${cap.name} (${cap.code})` } : { id: deliverable.producing_capability_id, label: "(unknown Capability)" };
  }

  const dependsOn: DependencyLink[] = [];
  for (const row of rows ?? []) {
    const satisfied = await dependencyDefinitionEngine.isRowSatisfied(seu.id, row);
    const readinessState = satisfied ? "Satisfied" : "Pending";
    if (row.from_entity_type === "Deliverable") {
      const { data: siblings } = await deliverablesDB.findBySeuId(seu.id);
      const target = siblings?.find((d) => d.name === row.from_name);
      dependsOn.push({ type: "Deliverable", targetId: target?.id ?? null, targetLabel: row.from_name ?? "(unknown Deliverable)", requiredState: row.from_state, readinessState });
    } else if (row.from_entity_type === "Capability") {
      const { data: services } = await servicesDB.findAll();
      const service = services?.find((s) => s.code === row.from_name);
      dependsOn.push({ type: "Capability", targetId: service?.id ?? null, targetLabel: service?.name ?? "(unknown Service)", requiredState: row.from_state, readinessState });
    }
  }

  const explainSystemActor = await resolveSystemActor(deliverable.seu_id);
  await eventBus.publish({
    eventType: "TraceabilityQueryExecuted",
    originatingObjectType: "Deliverable",
    originatingObjectId: deliverableId,
    seuId: deliverable.seu_id,
    correlationId: eventBus.newCorrelationId(),
    actorId: explainSystemActor.actorId,
    authorityBadge: explainSystemActor.authorBadge,
    payload: { query: "explainDeliverable" },
  });

  return {
    deliverable: { id: deliverable.id, name: deliverable.name, seuId: deliverable.seu_id, lifecycleState: deliverable.lifecycle_state },
    producingCapability,
    provenance,
    dependsOn,
    supportingEvidence: (evidence ?? []).map((e) => ({ id: e.id, title: e.title, status: e.status })),
    supportingDecisions: (decisions ?? []).map((d) => ({ id: d.id, title: d.title, status: d.status })),
    knowledge: (knowledge ?? []).map((k) => ({ id: k.id, title: k.title, status: k.status })),
    obligations: (obligations ?? []).map((o) => ({ id: o.id, title: o.title, status: o.status })),
    reviews: (reviews ?? []).map((r) => ({ id: r.id, category: r.category, name: r.name, status: r.status, outcome: r.outcome })),
    findings: (findings ?? []).map((f) => ({ id: f.id, reviewId: f.review_id, severity: f.severity, title: f.title, status: f.status, obligationId: f.obligation_id })),
  };
}

export async function impactOfDeliverable(deliverableId: string): Promise<DeliverableImpact | null> {
  const { data: deliverable } = await deliverablesDB.findById(deliverableId);
  if (!deliverable) return null;
  const { data: seu } = await seusDB.findById(deliverable.seu_id);
  if (!seu) return null;
  const scope = await resolveOwningScope(seu);
  const { data: siblings } = await deliverablesDB.findBySeuId(seu.id);
  const siblingByName = new Map((siblings ?? []).map((d) => [d.name, d]));

  const impacted: ImpactNode[] = [];
  const visited = new Set<string>([deliverableId]);
  const queue: string[] = [deliverable.name];

  while (queue.length > 0) {
    const currentName = queue.shift()!;
    const { data: rows } = await dependencyDefinitionsDB.findBySourceName(scope, "Deliverable", currentName);
    for (const row of rows ?? []) {
      const down = siblingByName.get(row.to_name);
      if (!down || visited.has(down.id)) continue;
      visited.add(down.id);
      const satisfied = await dependencyDefinitionEngine.isRowSatisfied(seu.id, row);
      impacted.push({
        deliverableId: down.id,
        name: down.name,
        lifecycleState: down.lifecycle_state,
        requiredState: row.from_state,
        readinessState: satisfied ? "Satisfied" : "Pending",
        dependencyEdgeId: row.id,
      });
      queue.push(down.name);
    }
  }

  const impactSystemActor = await resolveSystemActor(deliverable.seu_id);
  await eventBus.publish({
    eventType: "TraceabilityQueryExecuted",
    originatingObjectType: "Deliverable",
    originatingObjectId: deliverableId,
    seuId: deliverable.seu_id,
    correlationId: eventBus.newCorrelationId(),
    actorId: impactSystemActor.actorId,
    authorityBadge: impactSystemActor.authorBadge,
    payload: { query: "impactOfDeliverable" },
  });

  return {
    deliverable: { id: deliverable.id, name: deliverable.name, seuId: deliverable.seu_id, lifecycleState: deliverable.lifecycle_state },
    impacted,
  };
}
