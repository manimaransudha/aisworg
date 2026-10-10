import { ebmsDB } from "../../dblayer/ebmsDB.js";
import type { DependencyOwningScope } from "../../dblayer/dependencyDefinitionsDB.js";

export async function resolveOwningScope(ebmId: string): Promise<DependencyOwningScope | null> {
  const { data: ebm } = await ebmsDB.findById(ebmId);
  if (!ebm) return null;
  return { templateId: ebm.template_id, profileId: ebm.profile_id, packIds: ebm.composed_packs.map((p) => p.packId) };
}
