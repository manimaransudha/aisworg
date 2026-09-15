// CR-104 — the EBM is the entity that actually owns a composition
// (composed_packs, template_id, profile_id all live on ebms, not seus — a
// SEU merely points at its active EBM via active_ebm_id). Originally lived,
// SEU-keyed, only inside dependencyDefinitionEngine.ts; now shared, and
// rekeyed to take the EBM directly, since qualityGateEngine's own governance
// materialisation (compositionCompleted.ts) needs the identical scope and
// has no reason to go through a SEU at all — every column it needs is
// already on the ebms row it's about to write.
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import type { DependencyOwningScope } from "../../dblayer/dependencyDefinitionsDB.js";

export async function resolveOwningScope(ebmId: string): Promise<DependencyOwningScope | null> {
  const { data: ebm } = await ebmsDB.findById(ebmId);
  if (!ebm) return null;
  return { templateId: ebm.template_id, profileId: ebm.profile_id, packIds: ebm.composed_packs.map((p) => p.packId) };
}
