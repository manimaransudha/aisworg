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
  // Review Model (Ch.25 §14, Phase 14): the Reviews that evaluated this object
  // and the Findings they produced — provenance edges in the same graph.
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

// CR-043 — the SEU's full owning scope (Template + every composed Pack +
// Profile), for the two dependency_definitions lookups below.
async function resolveOwningScope(seu: { template_id: string; profile_id: string; active_ebm_id: string | null }): Promise<DependencyOwningScope> {
  const { data: ebm } = seu.active_ebm_id ? await ebmsDB.findById(seu.active_ebm_id) : { data: null };
  return { templateId: seu.template_id, profileId: seu.profile_id, packIds: (ebm?.composed_packs ?? []).map((p) => p.packId) };
}

// FR-20.4 / FR-20.6 / FR-20.7 — "Explain this Deliverable." Where did each of
// its states come from, and what supports it.
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

  // CR-039 — dependency_definitions is Template-scoped and name-keyed; a row
  // carries no per-SEU instance FK, so the target instance (if any) is
  // resolved here for display, same as the old edge's to_deliverable_id/
  // to_service_id resolution used to be.
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

  await eventBus.publish({
    eventType: "TraceabilityQueryExecuted",
    originatingObjectType: "Deliverable",
    originatingObjectId: deliverableId,
    seuId: deliverable.seu_id,
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
    reviews: (reviews ?? []).map((r) => ({ id: r.id, category: r.category, name: r.name, status: r.status, outcome: r.outcome })),
    findings: (findings ?? []).map((f) => ({ id: f.id, reviewId: f.review_id, severity: f.severity, title: f.title, status: f.status, obligationId: f.obligation_id })),
  };
}

// FR-20.3 / FR-20.5 — "Show all downstream impacts." Transitive closure over
// the dependency edges that point AT this Deliverable. Cycle-safe via a visited
// set (dependency graphs shouldn't cycle, but a bad authoring import could).
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

  // CR-039 — walking forward now means "what names is this one a from_*
  // prerequisite for" (findBySourceName), the opposite direction from the
  // gating lookup (findByTargetName), then resolving each downstream name to
  // its real instance within this same SEU — dependency_definitions has no
  // instance FK of its own to walk directly, unlike the old edges table.
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

  await eventBus.publish({
    eventType: "TraceabilityQueryExecuted",
    originatingObjectType: "Deliverable",
    originatingObjectId: deliverableId,
    seuId: deliverable.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { query: "impactOfDeliverable" },
  });

  return {
    deliverable: { id: deliverable.id, name: deliverable.name, seuId: deliverable.seu_id, lifecycleState: deliverable.lifecycle_state },
    impacted,
  };
}
