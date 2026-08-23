// Governance & EBM Sharpening — Plan (Phase 16, Ch.21 FR-21.1). Every SEU shall
// possess ONE effective Governance Model derived from its Engineering Behavior
// Model. Governance was only ever evaluated ad hoc per transition; this
// materialises it as a single inspectable projection, computed on read from the
// SEU's EBM (its composed Packs' declarative contributions). Read-only — it
// assembles, it never governs or mutates.
import { seusDB } from "../../../dblayer/seusDB.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";

export interface EffectiveGovernanceModel {
  seuId: string;
  ebm: { id: string; version: number; status: string; composedPacks: Array<{ packCode: string; packVersion: string }> };
  authorityRules: Array<{ code: string; governedTransition: string; authorisedRole: string; fromPack: string }>;
  policies: Array<{ code: string; name: string; governedTransition: string; fromPack: string }>;
  qualityGates: Array<{ name: string; category: string; governedTransition: string; criteriaType: string; fromPack: string }>;
  conflicts: string[];
}

export async function getEffectiveGovernanceModel(seuId: string): Promise<EffectiveGovernanceModel | null> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu?.active_ebm_id) return null;
  const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
  if (!ebm) return null;

  const composed = (ebm.composed_packs as Array<{ packId: string; packCode: string; packVersion: string }>) ?? [];
  const { data: packs } = await packsDB.findByIds(composed.map((p) => p.packId));

  const authorityRules: EffectiveGovernanceModel["authorityRules"] = [];
  const policies: EffectiveGovernanceModel["policies"] = [];
  const qualityGates: EffectiveGovernanceModel["qualityGates"] = [];
  const seenAuth = new Set<string>();
  const seenPolicy = new Set<string>();
  const seenGate = new Set<string>();

  for (const pack of packs ?? []) {
    for (const r of pack.contributions?.authorityRules ?? []) {
      if (seenAuth.has(r.code)) continue;
      seenAuth.add(r.code);
      authorityRules.push({ code: r.code, governedTransition: r.governedTransition, authorisedRole: r.authorisedRole, fromPack: pack.code });
    }
    for (const p of pack.contributions?.policies ?? []) {
      if (seenPolicy.has(p.code)) continue;
      seenPolicy.add(p.code);
      policies.push({ code: p.code, name: p.name, governedTransition: p.governedTransition, fromPack: pack.code });
    }
    for (const g of pack.contributions?.qualityGates ?? []) {
      // CR-058 follow-up — a gate's real identity is (governedTransition,
      // category), not an author-typed code (that field no longer exists).
      const slotKey = `${g.governedTransition}::${g.category}`;
      if (seenGate.has(slotKey)) continue;
      seenGate.add(slotKey);
      qualityGates.push({ name: g.name, category: g.category, governedTransition: g.governedTransition, criteriaType: g.criteriaType, fromPack: pack.code });
    }
  }

  await eventBus.publish({
    eventType: "GovernanceModelInspected",
    originatingObjectType: "SEU",
    originatingObjectId: seuId,
    seuId,
    correlationId: eventBus.newCorrelationId(),
    payload: { ebmVersion: ebm.version, authorityRules: authorityRules.length, policies: policies.length, qualityGates: qualityGates.length },
  });

  return {
    seuId,
    ebm: {
      id: ebm.id,
      version: ebm.version,
      status: ebm.status,
      composedPacks: composed.map((p) => ({ packCode: p.packCode, packVersion: p.packVersion })),
    },
    authorityRules,
    policies,
    qualityGates,
    conflicts: (ebm.composition_report?.conflicts as string[]) ?? [],
  };
}
