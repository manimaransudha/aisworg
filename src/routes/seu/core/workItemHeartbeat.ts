// Participant Integration & Attestation — Plan step 4 (Decision 8, Resolution 9),
// refined 2026-08-11. The stall half of first-class async failure handling.
// Out-of-process execution can hang (a human on leave, an agent that never
// calls back); a dispatched Work Item is genuinely outstanding, not simulated,
// so nothing completes it on its own.
//
// The SLA is materialized as a target completion time set on the Work Item at
// assignment (dispatchEngine), so this sweep is a single set-based query for
// Work Items already past their target — no per-item SLA re-derivation, no
// service join, no scan-and-loop. It escalates each to an Escalation Attention
// Item (Ch.34) — unattended, driven by a scheduler, not a Participant callback.
// (The explicit `failed`/`blocked` path is handled in completeWorkItem's Ch.36
// Failed -> Attention route.)
//
// §0.1 core-invariance: the logic keys off ONLY the Work Item's outstanding
// state and its committed target. It embeds no assumption about how or where
// the Participant executes — a stalled human-on-UI item and a stalled external
// orchestrator item are indistinguishable here, exactly as required.
import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { attentionItemsDB } from "../../../dblayer/attentionItemsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { raiseAttentionItem } from "./attentionItems.js";

export interface StallSweepResult {
  scanned: number;
  escalated: number;
  escalatedWorkItemIds: string[];
}

export async function sweepStalledWorkItems(input?: { now?: Date; seuId?: string }): Promise<StallSweepResult> {
  const now = input?.now ?? new Date();
  // One indexed query returns ONLY the outstanding Work Items already past their
  // committed target — nothing else is loaded.
  const { data: overdue } = await workItemsDB.findOverdue(now, input?.seuId);

  let escalated = 0;
  const escalatedWorkItemIds: string[] = [];

  for (const workItem of overdue ?? []) {
    const { data: command } = await commandsDB.findById(workItem.command_id);
    if (!command || command.entity_type !== "Deliverable") continue;

    const { data: deliverable } = await deliverablesDB.findById(command.entity_id);

    // Idempotent: one open Escalation per stalled Deliverable, however many
    // times the sweep runs (AM-002, same dedup discipline as the other
    // Attention paths). Skip the count + event too, not just the row.
    const { data: existing } = await attentionItemsDB.findOpenByRelatedObject(command.seu_id, "Escalation", "Deliverable", command.entity_id);
    if (existing) continue;

    const overdueBy = Math.round((now.getTime() - new Date(workItem.target_completion_at!).getTime()) / 1000);
    await raiseAttentionItem({
      seuId: command.seu_id,
      category: "Escalation",
      priority: "High",
      title: `Work Item stalled on Deliverable "${deliverable?.name ?? command.entity_id}"`,
      description: `Outstanding ~${overdueBy}s past its committed target completion time with no result reported. The ${command.from_state} -> ${command.to_state} transition is waiting on a Participant.`,
      relatedObjectType: "Deliverable",
      relatedObjectId: command.entity_id,
    });
    await eventBus.publish({
      eventType: "WorkItemStalled",
      originatingObjectType: "WorkItem",
      originatingObjectId: workItem.id,
      correlationId: command.correlation_id,
      payload: { deliverableId: command.entity_id, targetCompletionAt: workItem.target_completion_at, overdueBySeconds: overdueBy },
    });

    escalated++;
    escalatedWorkItemIds.push(workItem.id);
  }

  return { scanned: (overdue ?? []).length, escalated, escalatedWorkItemIds };
}
