import { participantsMasterDB } from "../../dblayer/participantsMasterDB.js";

export interface HeldRoles {
  isSuperuser: boolean;
  roles: Set<string>;
  has: (role: string) => boolean;
}

function isExpired(effectiveTill: string, now: Date): boolean {
  const till = new Date(effectiveTill);
  return !Number.isNaN(till.getTime()) && till.getTime() < now.getTime();
}

export async function resolveHeldRoles(userId: string | string, opts: { seuId?: string | null } = {}): Promise<HeldRoles> {
  const { data: master } = await participantsMasterDB.findById(userId);
  const now = new Date();
  const activeGrants = (master?.authorised_role ?? []).filter((entry) => !isExpired(entry.effective_till, now));
  const isSuperuser = activeGrants.some((entry) => entry.role === "superuser");
  const seuId = opts.seuId ?? null;
  const roles = new Set(
    activeGrants
      .filter((entry) => entry.seu_ids.length === 0 || (seuId !== null && entry.seu_ids.includes(seuId)))
      .map((entry) => entry.role)
  );
  return { isSuperuser, roles, has: (role: string) => isSuperuser || roles.has(role) };
}
