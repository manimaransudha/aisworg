import { eventsDB } from "../../../dblayer/eventsDB.js";
import type { EventRow } from "../../../dblayer/seuTypes.js";

const SEU_EVENTS_DISPLAY_LIMIT = 200;

export async function getSeuEvents(seuId: string): Promise<EventRow[]> {
  const { data } = await eventsDB.findPage({ seuId, limit: SEU_EVENTS_DISPLAY_LIMIT, offset: 0, sort: "sequence", dir: "desc" });
  return data?.items ?? [];
}

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
