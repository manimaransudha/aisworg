import { versionEventsDB } from "../../../dblayer/versionEventsDB.js";
import type { VersionEventRow } from "../../../dblayer/seuTypes.js";

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

export async function getVersionReplay(entityType: string, entityId: string): Promise<VersionEventRow[]> {
  const { data } = await versionEventsDB.findByEntity(entityType, entityId);
  return data ?? [];
}
