import { COMMENT_REQUIRED_POLICY_CODE, SDK_ATTENTION_EVENT, UNDEFINED_EVENT } from "../../dblayer/constants.js";
import { policyDefinitionsDB } from "../../dblayer/policyDefinitionsDB.js";
import { runAction } from "../../actions/index.js";
import { withTransaction } from "../../utils/db.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import type { TransitionEntityType } from "../../dblayer/seuTypes.js";
import { badgeAuthorityEngine } from "./badgeAuthorityEngine.js";
import { eventBus } from "./eventBus.js";
import { getEntityAdapter } from "./entityAdapters.js";
import { gateRejection, transitionEngine, type GateRejectionResult } from "./transitionEngine.js";

export type TransitionEntityResult =
  | { ok: true; row: object; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | GateRejectionResult;

// One governed transition for any entity (CR-128). The from-state is the row's own state; the event, badge and verb
// come from the Transition Definition. The only entity-specific part is the adapter.
export async function transitionEntity(input: {
  entityType: TransitionEntityType;
  entityId: string;
  targetState: string;
  actorId: string;
  context?: Record<string, unknown>;
}): Promise<TransitionEntityResult> {
  const adapter = getEntityAdapter(input.entityType);
  const row = await adapter.findById(input.entityId);
  if (!row) return { ok: false, reason: "not_found" };

  const fromState = adapter.getState(row);
  const gate = await transitionEngine.evaluate({
    entityType: input.entityType,
    fromState,
    toState: input.targetState,
    actorId: input.actorId,
    entityId: input.entityId,
    context: { row, ...input.context },
  });
  if (!gate.allowed) return gateRejection(gate, input.entityType, fromState, input.targetState);
  if (!gate.authorityBadge) throw new Error(`no authority badge resolved for ${input.entityType} ${fromState} -> ${input.targetState} — the Transition Definition declares no verb`);

  const badge = gate.authorityBadge;
  // The comment, the action and the status change commit together or not at all. The event is published after the commit.
  const updated = await withTransaction(async () => {
    const comment = input.context?.comment;
    if (typeof comment === "string" && comment.trim() && adapter.addComment) {
      await adapter.addComment(input.entityId, { text: comment.trim(), actorId: input.actorId, authorityBadge: badge });
    }
    if (gate.actionCode) await runAction(gate.actionCode, { entityType: input.entityType, entityId: input.entityId, actorId: input.actorId, authorityBadge: badge, context: { row, ...input.context } });
    return adapter.setState(input.entityId, input.targetState, badge, input.actorId);
  });

  const event = {
    originatingObjectType: input.entityType,
    originatingObjectId: input.entityId,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId,
    authorityBadge: gate.authorityBadge,
    fromState,
    toState: input.targetState,
    tenantId: adapter.tenantId(updated),
  };
  if (gate.eventType) {
    await eventBus.publish({ ...event, eventType: gate.eventType, versionEvent: gate.versionEvent });
  } else {
    await eventBus.publish({ ...event, eventType: UNDEFINED_EVENT, versionEvent: gate.versionEvent });
    await eventBus.publish({ ...event, eventType: SDK_ATTENTION_EVENT });
  }
  return { ok: true, row: updated, appliedTransition: { fromState, toState: input.targetState } };
}

export interface NextAction {
  toState: string;
  verb: string;
  requiresComment: boolean;
  actionCode: string | null;
}

// The manual next transitions of a state whose badge the actor holds. No entity logic.
export async function nextActionsFor(entityType: TransitionEntityType, fromState: string, actorId: string): Promise<NextAction[]> {
  const { data, error } = await transitionDefinitionsDB.findPossibleNextTransitions(entityType, fromState);
  if (error) throw error;
  const { isRoot, badgeTypes } = await badgeAuthorityEngine.getHeldBadges(actorId);
  const policyIds = [...new Set((data ?? []).flatMap((t) => t.requiredPolicyIds))];
  const { data: policies } = policyIds.length > 0 ? await policyDefinitionsDB.findByIds(policyIds) : { data: [] };
  const commentPolicyIds = new Set((policies ?? []).filter((p) => p.code.split("::")[0] === COMMENT_REQUIRED_POLICY_CODE).map((p) => p.id));
  return (data ?? [])
    .filter((t): t is typeof t & { verb: string } => t.trigger === "manual" && !!t.verb)
    .filter((t) => isRoot || badgeTypes.has(`${entityType.toLowerCase()}_${t.verb}`))
    .map((t) => ({ toState: t.toState, verb: t.verb, requiresComment: t.requiredPolicyIds.some((id) => commentPolicyIds.has(id)), actionCode: t.actionCode }));
}
