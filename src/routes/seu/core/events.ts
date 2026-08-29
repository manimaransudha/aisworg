import { eventsDB } from "../../../dblayer/eventsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import type { EventRow } from "../../../dblayer/seuTypes.js";

// The SEU's own events (commissioning/lifecycle) plus every event published
// against a Deliverable belonging to it (Deliverable transitions publish with
// originatingObjectType 'Deliverable' and the Deliverable's own id, per Ch.29's
// event-per-object model — this merges the two so the SEU's event log reads
// as the SEU's full execution history, not just its own lifecycle events).
// Post-MVP Phase 3: Command/WorkItem events publish against their own
// Command/WorkItem id, not the SEU or Deliverable — pulled in by Correlation
// Id (Ch.30 §13) instead, one per Command this SEU has ever generated, so the
// dispatch pipeline's internal steps are visible in the same log rather than
// only in the dedicated Commands section.
export async function getSeuEvents(seuId: string): Promise<EventRow[]> {
  const [{ data: seuEvents }, { data: deliverables }, { data: commands }] = await Promise.all([
    eventsDB.findByOriginatingObject("SEU", seuId),
    deliverablesDB.findBySeuId(seuId),
    commandsDB.findBySeuId(seuId),
  ]);

  const [deliverableEventLists, commandEventLists] = await Promise.all([
    Promise.all((deliverables ?? []).map((d) => eventsDB.findByOriginatingObject("Deliverable", d.id))),
    Promise.all((commands ?? []).map((c) => eventsDB.findByCorrelationId(c.correlation_id))),
  ]);

  const all = [
    ...(seuEvents ?? []),
    ...deliverableEventLists.flatMap((r) => r.data ?? []),
    ...commandEventLists.flatMap((r) => r.data ?? []),
  ];
  const deduped = [...new Map(all.map((e) => [e.id, e])).values()];
  return deduped.sort((a, b) => Number(a.sequence) - Number(b.sequence));
}

// CR-074 — the EventBus browser (owner: "Create a UI to show the EventBus
// (events table)"). Deliberately NOT getSeuEvents: this is a general, raw
// table browser (every event, any entity, any SEU), not one SEU's enriched
// execution history — seuId is one optional filter among several, using the
// real events.seu_id column directly.
export async function getEventsPage(opts: {
  limit: number;
  offset: number;
  seuId?: string;
  eventType?: string;
  entityType?: string;
}): Promise<{ items: EventRow[]; total: number }> {
  const { data } = await eventsDB.findPage(opts);
  return { items: data?.items ?? [], total: data?.total ?? 0 };
}
