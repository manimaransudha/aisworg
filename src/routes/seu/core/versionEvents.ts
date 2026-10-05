import { versionEventsDB } from "../../../dblayer/versionEventsDB.js";
import type { VersionEventRow } from "../../../dblayer/seuTypes.js";

// CR-117 — Chapter 41 §18 "Version APIs": a thin, filterable, paginated
// browser over version_events, modeled directly on core/events.ts's
// getEventsPage (CR-074).
export async function getVersionEventsPage(opts: {
  limit: number;
  offset: number;
  tenantId?: string;
  entityType?: string;
  entityId?: string;
  versionEvent?: string;
  sort?: string;
  dir?: "asc" | "desc";
}): Promise<{ items: VersionEventRow[]; total: number }> {
  const { data } = await versionEventsDB.findPage(opts);
  return { items: data?.items ?? [], total: data?.total ?? 0 };
}

// §12 Historical Reconstruction — the real per-entity version chain, in
// order. A reconstruction reader over version_events, not a separate module:
// walks the entity's own version-classified hops and hands back each one's
// event id for the caller to rehydrate the full event payload from, if
// needed (events.ts's own eventsDB already does that lookup).
export async function getVersionReplay(entityType: string, entityId: string): Promise<VersionEventRow[]> {
  const { data } = await versionEventsDB.findByEntity(entityType, entityId);
  return data ?? [];
}
