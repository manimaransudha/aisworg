import { eventsDB } from "../../../dblayer/eventsDB.js";
import type { EventRow } from "../../../dblayer/seuTypes.js";

// CR-107 follow-up (owner: "the Events tab... shows only the events
// associated with the SEU transitions. It should show all events associated
// with the SEU") — every event already carries a required seu_id column
// (eventBus.ts's own PublishInput), so querying that column directly is both
// simpler and more complete than the old hand-curated union (SEU's own
// events + Deliverable-owned events + Command-correlated events): it also
// picks up Obligation/AttentionItem/Participant/... events published with
// this seuId, which that union missed entirely. Capped, not literally every
// event ever — see the view's own "explore the full history" link
// (Event Bus, /aisworg/seu/events?seuId=) for anything beyond this window.
const SEU_EVENTS_DISPLAY_LIMIT = 200;

export async function getSeuEvents(seuId: string): Promise<EventRow[]> {
  const { data } = await eventsDB.findPage({ seuId, limit: SEU_EVENTS_DISPLAY_LIMIT, offset: 0, sort: "sequence", dir: "desc" });
  return data?.items ?? [];
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
  name?: string;
  sort?: string;
  dir?: "asc" | "desc";
}): Promise<{ items: EventRow[]; total: number }> {
  const { data } = await eventsDB.findPage(opts);
  return { items: data?.items ?? [], total: data?.total ?? 0 };
}
