import { COMMENT_REQUIRED_POLICY_CODE, SDK_ATTENTION_EVENT, UNDEFINED_EVENT } from "../../dblayer/constants.js";
import { policyDefinitionsDB } from "../../dblayer/policyDefinitionsDB.js";
import { runAction } from "../../actions/index.js";
import { withTransaction } from "../../utils/db.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import type { EventRow, TransitionEntityType } from "../../dblayer/seuTypes.js";
import { badgeAuthorityEngine } from "./badgeAuthorityEngine.js";
import { eventBus, type PublishInput } from "./eventBus.js";
import { getEntityAdapter } from "./entityAdapters.js";
import { gateRejection, transitionEngine, type GateRejectionResult } from "./transitionEngine.js";

// The event a hop names. The caller publishes it after the call (see publishTransition); the function publishes nothing.
// eventType is null when the Transition Definition names no event.
export type TransitionEvent = Omit<PublishInput, "eventType" | "correlationId"> & { eventType: string | null };

export type TransitionEntityResult =
  | { ok: true; row: object; appliedTransition: { fromState: string; toState: string }; event: TransitionEvent }
  | { ok: false; reason: "not_found" }
  | GateRejectionResult;

// One governed transition for any entity (CR-128). The from-state is the row's own state; the event, badge and verb
// come from the Transition Definition. The only entity-specific part is the adapter. The caller publishes the returned
// event after a successful call.
export async function transitionEntity(input: {
  entityType: TransitionEntityType;
  entityId: string;
  targetState: string;
  actorId: string;
  seuId?: string | null;
  context?: Record<string, unknown>;
}): Promise<TransitionEntityResult> {
  const adapter = getEntityAdapter(input.entityType);
  const row = await adapter.findById(input.entityId);
  if (!row) return { ok: false, reason: "not_found" };

  const fromState = adapter.getState(row);
  const evaluateInput = {
    entityType: input.entityType,
    fromState,
    toState: input.targetState,
    actorId: input.actorId,
    entityId: input.entityId,
    context: { row, ...input.context },
  };
  // An entity inside an SEU also passes the Quality Gate and the participant check of that SEU.
  const gateSeuId = await adapter.seuId?.(row);
  const gate = gateSeuId
    ? await transitionEngine.evaluateGoverned({ ...evaluateInput, gateEntityId: input.entityId, gateSeuId })
    : await transitionEngine.evaluate(evaluateInput);
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

  const event: TransitionEvent = {
    eventType: gate.eventType ?? null,
    versionEvent: gate.versionEvent,
    originatingObjectType: input.entityType,
    originatingObjectId: input.entityId,
    seuId: input.seuId ?? gateSeuId ?? null,
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId,
    authorityBadge: gate.authorityBadge,
    fromState,
    toState: input.targetState,
    tenantId: await adapter.tenantId(updated),
  };
  return { ok: true, row: updated, appliedTransition: { fromState, toState: input.targetState }, event };
}

// Publishes the event of a successful hop. A row that names no event publishes UNDEFINED_EVENT and then SDK_ATTENTION_EVENT.
// A caller that needs two events, another payload or an id chain publishes from result.event itself.
// The options replace the default payload and chain the event to the id of a commissioning. It returns the first event published.
export async function publishTransition(
  result: Extract<TransitionEntityResult, { ok: true }>,
  options?: { payload?: Record<string, unknown>; correlationId?: string; causationId?: string | null }
): Promise<EventRow> {
  const { eventType, ...event } = result.event;
  const common = { ...event, payload: options?.payload ?? event.payload, correlationId: options?.correlationId ?? eventBus.newCorrelationId(), causationId: options?.causationId };
  if (eventType) return eventBus.publish({ ...common, eventType });
  const first = await eventBus.publish({ ...common, eventType: UNDEFINED_EVENT });
  await eventBus.publish({ ...common, eventType: SDK_ATTENTION_EVENT, versionEvent: undefined });
  return first;
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
