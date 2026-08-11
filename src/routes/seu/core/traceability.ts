// Participant Integration & Attestation — Plan step 3 (Decision 7): the Ch.20
// Traceability query surface. Ch.20 is NOT a standalone subsystem here — the
// attestation is the new provenance edge (the previously-missing "who produced
// what, under what governance, at which commit"), and this module joins that
// backbone with the structural relationships already in the schema (producing
// Capability, dependency edges, Evidence/Decision/Knowledge/Obligation
// attachments) to answer Ch.20's functional requirements:
//
//   FR-20.3 forward navigation      -> impactOfDeliverable (downstream)
//   FR-20.4 backward navigation     -> explainDeliverable (upstream + provenance)
//   FR-20.5 impact analysis         -> impactOfDeliverable (transitive downstream)
//   FR-20.6/20.7 permanent provenance -> the attestation/reference timeline,
//                                        immutable by construction (append-only).
//
// §0.1 core-invariance: this reads ONLY platform-held records — attestations,
// deliverable_references, and the existing structural tables. It never makes a
// live call into any tenant VCS or orchestrator, and it works identically
// regardless of which provider produced the references (they are opaque here).
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { dependencyEdgesDB } from "../../../dblayer/dependencyEdgesDB.js";
import { attestationsDB } from "../../../dblayer/attestationsDB.js";
import { deliverableReferencesDB } from "../../../dblayer/deliverableReferencesDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { evidenceDB } from "../../../dblayer/evidenceDB.js";
import { decisionsDB } from "../../../dblayer/decisionsDB.js";
import { obligationsDB } from "../../../dblayer/obligationsDB.js";
import { knowledgeItemsDB } from "../../../dblayer/knowledgeItemsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";

export interface ProvenanceEntry {
  fromState: string;
  toState: string;
  reference: string | null;
  participantLabel: string | null;
  certified: boolean; // true when this state change also minted an attestation (an acceptance transition)
  actingAuthorityGrantId: string | null;
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
  // Backward navigation (FR-20.4) + permanent provenance (FR-20.6/20.7): the
  // commit and Participant that produced each state this Deliverable reached.
  provenance: ProvenanceEntry[];
  dependsOn: DependencyLink[];
  supportingEvidence: RelatedArtifact[];
  supportingDecisions: RelatedArtifact[];
  knowledge: RelatedArtifact[];
  obligations: RelatedArtifact[];
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
  // Forward navigation (FR-20.3) + impact analysis (FR-20.5): every downstream
  // Deliverable that depends on this one, transitively — "if this changes, what
  // is impacted."
  impacted: ImpactNode[];
}

async function participantLabel(participantId: string | null): Promise<string | null> {
  if (!participantId) return null;
  const { data } = await participantsDB.findById(participantId);
  return data ? `${data.display_name} (${data.type})` : "(unknown Participant)";
}

// FR-20.4 / FR-20.6 / FR-20.7 — "Explain this Deliverable." Where did each of
// its states come from, and what supports it.
export async function explainDeliverable(deliverableId: string): Promise<DeliverableExplanation | null> {
  const { data: deliverable } = await deliverablesDB.findById(deliverableId);
  if (!deliverable) return null;

  const [{ data: references }, { data: attestations }, { data: edges }, { data: evidence }, { data: decisions }, { data: obligations }, { data: knowledge }] =
    await Promise.all([
      deliverableReferencesDB.findByDeliverableId(deliverableId),
      attestationsDB.findByDeliverableId(deliverableId),
      dependencyEdgesDB.findByFromDeliverable(deliverableId),
      evidenceDB.findByRelatedObject("Deliverable", deliverableId),
      decisionsDB.findByRelatedObject("Deliverable", deliverableId),
      obligationsDB.findByRelatedObject("Deliverable", deliverableId),
      knowledgeItemsDB.findByDeliverableId(deliverableId),
    ]);

  // An attestation exists for exactly the acceptance transitions; key them by
  // (from -> to) so the provenance timeline can mark which state changes were
  // certified vs. bare production completions.
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
      actingAuthorityGrantId: att?.acting_badge_grant_id ?? null,
      at: ref.created_at,
    });
  }

  let producingCapability: { id: string; label: string } | null = null;
  if (deliverable.producing_capability_id) {
    const { data: cap } = await capabilitiesDB.findById(deliverable.producing_capability_id);
    producingCapability = cap ? { id: cap.id, label: `${cap.name} (${cap.code})` } : { id: deliverable.producing_capability_id, label: "(unknown Capability)" };
  }

  const dependsOn: DependencyLink[] = [];
  for (const edge of edges ?? []) {
    if (edge.dependency_type === "Deliverable" && edge.to_deliverable_id) {
      const { data: target } = await deliverablesDB.findById(edge.to_deliverable_id);
      dependsOn.push({ type: "Deliverable", targetId: edge.to_deliverable_id, targetLabel: target?.name ?? "(unknown Deliverable)", requiredState: edge.required_state, readinessState: edge.readiness_state });
    } else if (edge.dependency_type === "Capability" && edge.to_service_id) {
      const { data: service } = await servicesDB.findById(edge.to_service_id);
      dependsOn.push({ type: "Capability", targetId: edge.to_service_id, targetLabel: service?.name ?? "(unknown Service)", requiredState: edge.required_state, readinessState: edge.readiness_state });
    }
  }

  await eventBus.publish({
    eventType: "TraceabilityQueryExecuted",
    originatingObjectType: "Deliverable",
    originatingObjectId: deliverableId,
    correlationId: eventBus.newCorrelationId(),
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
  };
}

// FR-20.3 / FR-20.5 — "Show all downstream impacts." Transitive closure over
// the dependency edges that point AT this Deliverable. Cycle-safe via a visited
// set (dependency graphs shouldn't cycle, but a bad authoring import could).
export async function impactOfDeliverable(deliverableId: string): Promise<DeliverableImpact | null> {
  const { data: deliverable } = await deliverablesDB.findById(deliverableId);
  if (!deliverable) return null;

  const impacted: ImpactNode[] = [];
  const visited = new Set<string>([deliverableId]);
  const queue: string[] = [deliverableId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const { data: edges } = await dependencyEdgesDB.findByToDeliverable(current);
    for (const edge of edges ?? []) {
      const downstreamId = edge.from_deliverable_id;
      if (visited.has(downstreamId)) continue;
      visited.add(downstreamId);
      const { data: down } = await deliverablesDB.findById(downstreamId);
      impacted.push({
        deliverableId: downstreamId,
        name: down?.name ?? "(unknown Deliverable)",
        lifecycleState: down?.lifecycle_state ?? "(unknown)",
        requiredState: edge.required_state,
        readinessState: edge.readiness_state,
        dependencyEdgeId: edge.id,
      });
      queue.push(downstreamId);
    }
  }

  await eventBus.publish({
    eventType: "TraceabilityQueryExecuted",
    originatingObjectType: "Deliverable",
    originatingObjectId: deliverableId,
    correlationId: eventBus.newCorrelationId(),
    payload: { query: "impactOfDeliverable" },
  });

  return {
    deliverable: { id: deliverable.id, name: deliverable.name, seuId: deliverable.seu_id, lifecycleState: deliverable.lifecycle_state },
    impacted,
  };
}
