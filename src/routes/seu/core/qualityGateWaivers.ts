import { qualityGateDefinitionsDB } from "../../../dblayer/qualityGateDefinitionsDB.js";
import { qualityGateWaiversDB } from "../../../dblayer/qualityGateWaiversDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { qualityGateWaiverRisksDB } from "../../../dblayer/qualityGateWaiverRisksDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { evidenceDB } from "../../../dblayer/evidenceDB.js";
import { knowledgeItemsDB } from "../../../dblayer/knowledgeItemsDB.js";
import { decisionsDB } from "../../../dblayer/decisionsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { QUALITY_GATE_WAIVE_BADGE, WAIVER_CONTROL_CONCEPT, WAIVER_CONTROL_EXPIRY, WAIVER_CONTROL_OBLIGATION, WAIVER_CONTROL_ACCEPT_RISK, WAIVER_RISK_ENTITY_TYPE, WAIVER_SCOPE_GATE, WAIVER_SCOPE_POLICY, WAIVER_SCOPE_OBLIGATION, WAIVER_SCOPE_POLICY_OBLIGATION, WAIVER_SCOPES, WAIVER_ENTITY_TYPE, WAIVER_SUPPORT_EVIDENCE, WAIVER_SUPPORT_KNOWLEDGE, WAIVER_SUPPORT_DECISION, WAIVER_SUPPORT_TYPES, WAIVER_DEFAULT_EXPIRY_DAYS, QUALITY_GATE_CRITERIA_NO_UNRESOLVED_OBLIGATIONS } from "../../../dblayer/constants.js";
import { listOpenAttentionObligations } from "./attentionObligations.js";
import { assertCanonicalCategory } from "./ontology.js";
import { createObligation } from "./obligations.js";
import { resolveAuthor } from "./attentionItems.js";
import { getWaivers } from "../../../domain/engine/qualityGateOutcomeComposition.js";
import type { QualityGateWaiverRow } from "../../../dblayer/seuTypes.js";

// What a waiver does about one risk it accepts. An Obligation control raises an Obligation on the SEU, or on a Deliverable of the SEU. With
// blockedFromState and blockedToState on a Deliverable, the Obligation holds that hop of the Deliverable until it is resolved.
export type WaiverControlInput =
  | { type: typeof WAIVER_CONTROL_EXPIRY }
  | { type: typeof WAIVER_CONTROL_ACCEPT_RISK }
  | {
      type: typeof WAIVER_CONTROL_OBLIGATION;
      obligation: {
        relatedObjectType: "SEU" | "Deliverable";
        relatedObjectId: string;
        category: string;
        title: string;
        description?: string | null;
        severity?: string;
        priority?: string | null;
        completionCriteria?: string | null;
        blockedFromState?: string | null;
        blockedToState?: string | null;
      };
    };

// One risk the waiver accepts, with the controls that offset it. A risk with no control gets the Expiry control.
export interface WaiverRiskInput {
  risk: string;
  controls: WaiverControlInput[];
}

// The records of the SEU a waiver can name as support: its Evidence (of the SEU and of its Deliverables), its Knowledge items and its Decisions.
export interface WaiverSupportOption { type: string; id: string; label: string }

export async function listWaiverSupportOptions(seuId: string): Promise<WaiverSupportOption[]> {
  const [evidenceOfSeu, evidenceOfDeliverables, knowledge, decisions] = await Promise.all([
    evidenceDB.findBySeuId(seuId), evidenceDB.findLinkedToSeu(seuId), knowledgeItemsDB.findBySeuId(seuId), decisionsDB.findBySeuId(seuId),
  ]);
  for (const r of [evidenceOfSeu, evidenceOfDeliverables, knowledge, decisions]) if (r.error) throw r.error;
  const evidence = new Map([...(evidenceOfSeu.data ?? []), ...(evidenceOfDeliverables.data ?? [])].map((e) => [e.id, e]));
  return [
    ...[...evidence.values()].map((e) => ({ type: WAIVER_SUPPORT_EVIDENCE, id: e.id, label: `${e.title} (${e.category}, ${e.status}, confidence ${e.confidence_level ?? "unassessed"})` })),
    ...(knowledge.data ?? []).map((k) => ({ type: WAIVER_SUPPORT_KNOWLEDGE, id: k.id, label: `${k.title} (${k.category}, ${k.status}, confidence ${k.confidence_level ?? "unassessed"})` })),
    ...(decisions.data ?? []).map((d) => ({ type: WAIVER_SUPPORT_DECISION, id: d.id, label: `${d.title} (${d.category}, ${d.status})` })),
  ];
}

export type GrantQualityGateWaiverResult = { ok: true; waiver: QualityGateWaiverRow } | { ok: false; reason: string };

export async function grantQualityGateWaiver(input: {
  // What the waiver lets the gate override. One waiver has one scope: Gate names the gate; Policy names a Policy code; Policy Obligation names the Policy that raised an
  // Obligation and its title; Obligation names the category and the title of an Obligation no Policy raised.
  scope?: string;
  qualityGateId?: string | null;
  policyCode?: string | null;
  obligationCategory?: string | null;
  obligationTitle?: string | null;
  seuId: string;
  entityType: string;
  // The Deliverable (or the SEU) the waiver was granted from.
  entityId: string;
  // The Deliverables of the SEU the waiver covers, with entityId. The waiver names them by code.
  deliverableIds?: string[];
  // Share the waiver with every SEU that uses the Profile of this SEU: it covers the Deliverables of the same codes there.
  shareWithProfile?: boolean;
  rationale: string;
  actorId: string;
  expiresAt?: string | null;
  risks?: WaiverRiskInput[];
  // The records that support the waiver, by type: { Evidence: [ids], Knowledge: [ids], Decision: [ids] }. Each is a record of this SEU.
  supportingRecords?: Record<string, string[]>;
}): Promise<GrantQualityGateWaiverResult> {
  if (!input.rationale?.trim()) return { ok: false, reason: "rationale is required" };
  // A waiver with no expiry time expires after the default number of days.
  const expiresAt = input.expiresAt || new Date(Date.now() + WAIVER_DEFAULT_EXPIRY_DAYS * 86400000).toISOString();
  if (!(new Date(expiresAt).getTime() > Date.now())) return { ok: false, reason: "the expiry time must be a time in the future" };
  const authorityBadge = await badgeAuthorityEngine.resolveAuthorBadge(input.actorId, QUALITY_GATE_WAIVE_BADGE);
  const scope = input.scope ?? WAIVER_SCOPE_GATE;
  if (!WAIVER_SCOPES.includes(scope)) return { ok: false, reason: `waiver scope "${scope}" is not one of ${WAIVER_SCOPES.join(", ")}` };
  if ((scope === WAIVER_SCOPE_POLICY || scope === WAIVER_SCOPE_POLICY_OBLIGATION) && !input.policyCode?.trim()) return { ok: false, reason: "this waiver names a Policy code" };
  if ((scope === WAIVER_SCOPE_POLICY_OBLIGATION || scope === WAIVER_SCOPE_OBLIGATION) && !input.obligationTitle?.trim()) return { ok: false, reason: "this waiver names the title of an Obligation" };
  if (scope === WAIVER_SCOPE_OBLIGATION) {
    if (!input.obligationCategory) return { ok: false, reason: "this waiver names the category of an Obligation" };
    await assertCanonicalCategory("category:obligation", input.obligationCategory);
  }

  // Every supporting record is a record of this SEU, and its type is one a waiver accepts.
  const supportingRecords: Record<string, string[]> = {};
  const supportOptions = await listWaiverSupportOptions(input.seuId);
  for (const [type, ids] of Object.entries(input.supportingRecords ?? {})) {
    if (!WAIVER_SUPPORT_TYPES.includes(type)) return { ok: false, reason: `a waiver cannot be supported by a "${type}" record` };
    const unique = [...new Set(ids)];
    if (unique.some((id) => !supportOptions.some((o) => o.type === type && o.id === id))) return { ok: false, reason: `a supporting ${type} record is not a record of this SEU` };
    if (unique.length > 0) supportingRecords[type] = unique;
  }

  // The Deliverables the waiver covers are named by code, in this SEU or, when it is shared, in every SEU of the Profile.
  const { data: seu } = await seusDB.findById(input.seuId);
  if (!seu) return { ok: false, reason: "SEU not found" };
  const coveredIds = [...new Set([input.entityId, ...(input.deliverableIds ?? [])])];
  const deliverableCodes: string[] = [];
  if (input.entityType === "Deliverable") {
    for (const id of coveredIds) {
      const { data: deliverable } = await deliverablesDB.findById(id);
      if (deliverable?.seu_id !== input.seuId) return { ok: false, reason: "a covered Deliverable is not a Deliverable of this SEU" };
      if (!deliverable.code) return { ok: false, reason: `Deliverable "${deliverable.name}" has no code, so a waiver cannot name it` };
      deliverableCodes.push(deliverable.code);
    }
  } else if (input.shareWithProfile || coveredIds.length > 1) {
    return { ok: false, reason: "a waiver granted for the SEU covers the SEU only" };
  }

  // An Obligation that holds a Deliverable for an Attention Item is covered by no waiver. An Attention Item needs a person to fix it, so a waiver that
  // names that Obligation, or the gate that counts it, is refused while the Obligation is open.
  if (input.entityType === "Deliverable") {
    let namesGateOfObligations = false;
    if (scope === WAIVER_SCOPE_GATE && input.qualityGateId) {
      const { data: gateDefinitions } = await qualityGateDefinitionsDB.findByIds([input.qualityGateId]);
      namesGateOfObligations = (gateDefinitions ?? []).some((g) => g.criteria_type === QUALITY_GATE_CRITERIA_NO_UNRESOLVED_OBLIGATIONS);
    }
    for (const id of coveredIds) {
      const held = (await listOpenAttentionObligations(id)).filter((o) => namesGateOfObligations || ((scope === WAIVER_SCOPE_OBLIGATION || scope === WAIVER_SCOPE_POLICY_OBLIGATION) && o.title === input.obligationTitle));
      if (held.length > 0) return { ok: false, reason: `an Obligation holds the Deliverable for an Attention Item ("${held[0]!.title}"). No waiver covers it. Resolve the Attention Item.` };
    }
  }

  // Every risk and control is checked before anything is written.
  const risks = (input.risks ?? []).map((r) => ({ risk: r.risk?.trim() ?? "", controls: r.controls.length > 0 ? r.controls : [{ type: WAIVER_CONTROL_EXPIRY } as WaiverControlInput] }));
  for (const r of risks) {
    if (!r.risk) return { ok: false, reason: "an associated risk is empty" };
    for (const control of r.controls) {
      await assertCanonicalCategory(WAIVER_CONTROL_CONCEPT, control.type);
      if (control.type !== WAIVER_CONTROL_OBLIGATION) continue;
      const o = control.obligation;
      if (!o.title?.trim()) return { ok: false, reason: `the Obligation control of the risk "${r.risk}" needs a title` };
      await assertCanonicalCategory("category:obligation", o.category);
      if (o.relatedObjectType === "SEU") {
        if (o.relatedObjectId !== input.seuId) return { ok: false, reason: "the Obligation of a risk can be raised on this SEU only" };
        if (o.blockedFromState || o.blockedToState) return { ok: false, reason: "an Obligation on the SEU holds no hop, so it carries no blocked states" };
      } else {
        const { data: deliverable } = await deliverablesDB.findById(o.relatedObjectId);
        if (deliverable?.seu_id !== input.seuId) return { ok: false, reason: "the Obligation of a risk can be raised on a Deliverable of this SEU only" };
        if (!o.blockedFromState !== !o.blockedToState) return { ok: false, reason: "blocked from state and blocked to state are given together" };
      }
    }
  }
  if (risks.some((r) => r.controls.some((c) => c.type === WAIVER_CONTROL_OBLIGATION))) await resolveAuthor(input.seuId, input.actorId);

  if (scope === WAIVER_SCOPE_GATE) {
    if (!input.qualityGateId) return { ok: false, reason: "a Gate waiver names a Quality Gate" };
    const { data: gate } = await qualityGateDefinitionsDB.findByIds([input.qualityGateId]);
    if (!gate || gate.length === 0) return { ok: false, reason: "quality gate not found" };
  }

  // A waiver of the same scope for the same target, granted from the same entity, that is Active already covers it.
  const target = {
    qualityGateId: scope === WAIVER_SCOPE_GATE ? input.qualityGateId ?? null : null,
    policyCode: scope === WAIVER_SCOPE_POLICY || scope === WAIVER_SCOPE_POLICY_OBLIGATION ? input.policyCode?.trim() ?? null : null,
    obligationCategory: scope === WAIVER_SCOPE_OBLIGATION ? input.obligationCategory ?? null : null,
    obligationTitle: scope === WAIVER_SCOPE_POLICY_OBLIGATION || scope === WAIVER_SCOPE_OBLIGATION ? input.obligationTitle?.trim() ?? null : null,
  };
  const duplicate = (await getWaivers(input.seuId)).find((w) =>
    w.scope === scope && w.entity_type === input.entityType && w.entity_id === input.entityId &&
    (w.quality_gate_id ?? null) === target.qualityGateId && (w.policy_code ?? null) === target.policyCode &&
    (w.obligation_category ?? null) === target.obligationCategory && (w.obligation_title ?? null) === target.obligationTitle
  );
  if (duplicate) return { ok: false, reason: `an Active waiver of this scope for the same target and entity already exists (${duplicate.id})` };

  const { data: master } = await participantsMasterDB.findById(input.actorId);
  if (!master) return { ok: false, reason: `No superuser provisioned.` };

  const { data: waiver, error } = await qualityGateWaiversDB.grant({
    scope,
    qualityGateId: scope === WAIVER_SCOPE_GATE ? input.qualityGateId : null,
    policyCode: scope === WAIVER_SCOPE_POLICY || scope === WAIVER_SCOPE_POLICY_OBLIGATION ? input.policyCode?.trim() : null,
    obligationCategory: scope === WAIVER_SCOPE_OBLIGATION ? input.obligationCategory : null,
    obligationTitle: scope === WAIVER_SCOPE_POLICY_OBLIGATION || scope === WAIVER_SCOPE_OBLIGATION ? input.obligationTitle?.trim() : null,
    deliverableCodes,
    sharedProfileId: input.shareWithProfile ? seu.profile_id : null,
    seuId: input.seuId,
    entityType: input.entityType,
    entityId: input.entityId,
    rationale: input.rationale,
    grantedBy: master.id,
    authorityBadge,
    expiresAt,
    supportingRecords,
  });
  if (error || !waiver) return { ok: false, reason: (error ?? new Error("failed to grant waiver")).message };

  for (const r of risks) {
    const { data: riskRow, error: riskError } = await qualityGateWaiverRisksDB.createRisk({ waiverId: waiver.id, seuId: input.seuId, risk: r.risk });
    if (riskError || !riskRow) throw riskError ?? new Error("failed to record the risk of a waiver");
    for (const control of r.controls) {
      let obligationId: string | null = null;
      if (control.type === WAIVER_CONTROL_OBLIGATION) {
        const obligation = await createObligation({
          ...control.obligation,
          originatingEntityType: WAIVER_RISK_ENTITY_TYPE,
          originatingEntityId: riskRow.id,
          actorId: input.actorId,
          authorBadge: authorityBadge,
        });
        obligationId = obligation.id;
      }
      const { error: controlError } = await qualityGateWaiverRisksDB.createControl({ riskId: riskRow.id, waiverId: waiver.id, seuId: input.seuId, controlType: control.type, obligationId });
      if (controlError) throw controlError;
    }
  }

  await eventBus.publish({
    eventType: "QualityGateWaiverCreated",
    originatingObjectType: scope === WAIVER_SCOPE_GATE ? "QualityGate" : WAIVER_ENTITY_TYPE,
    originatingObjectId: scope === WAIVER_SCOPE_GATE && input.qualityGateId ? input.qualityGateId : waiver.id,
    seuId: input.seuId,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge,
    tenantId: seu.tenant_id,
    payload: { waiverId: waiver.id, sharedProfileId: waiver.shared_profile_id, scope, entityType: input.entityType, entityId: input.entityId, deliverableCodes, rationale: input.rationale },
  });

  return { ok: true, waiver };
}

export async function listQualityGateWaivers(seuId: string): Promise<QualityGateWaiverRow[]> {
  const { data } = await qualityGateWaiversDB.findBySeuId(seuId);
  return data ?? [];
}
