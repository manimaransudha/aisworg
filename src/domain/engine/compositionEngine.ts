// Ch.4 minimal instance — composes a Template's mandatory Packs + a Profile's
// optional Packs into the ordered Pack list an EBM records (Build Plan §5 item
// 5: EBM and EEC are collapsed into one table, so "compose" here means
// "resolve + de-duplicate the Pack set", not build a separately-published,
// reusable EBM). Deterministic and traceable per AP requirements: same
// Template+Profile Pack set in, same composedPacks/report out, every time
// composition runs — but "the same set" is evaluated fresh each time, not
// cached: see the code-resolution note below.
import { templatesDB } from "../../dblayer/templatesDB.js";
import { profilesDB } from "../../dblayer/profilesDB.js";
import { packsDB } from "../../dblayer/packsDB.js";
import type { EbmComposedPack, EbmCompositionReport, PackRow } from "../../dblayer/seuTypes.js";

// Bug fix (Open Design Questions.md #2) — a Template/Profile used to pin a
// specific Pack *row*, resolved once when authored. Archiving that row and
// publishing a newer Active Version under the same code left nothing for the
// old reference to fall back to — the Pack just silently stopped composing.
// Fix: template_packs/profile_packs now store the Pack's *code*
// (013_template_profile_pack_by_code.sql); resolved here, at commissioning
// time, to whichever Version is currently Active for that code — the same
// findActiveByCode lookup publishPack's own supersede step already uses. A
// code with no Active Version at all (every Version terminal) resolves to
// nothing and is named in a warning, same visibility the old status-check
// gave, just for a different underlying reason.
async function resolveActivePack(code: string, requiredBy: string): Promise<{ pack: PackRow | null; warning: string | null }> {
  const { data: pack } = await packsDB.findActiveByCode(code);
  if (!pack) {
    return { pack: null, warning: `Pack "${code}" (required by ${requiredBy}) has no Active Version — excluded from composition.` };
  }
  return { pack, warning: null };
}

export const compositionEngine = {
  async compose(input: { templateId: string; profileId: string }): Promise<{
    composedPacks: EbmComposedPack[];
    compositionReport: EbmCompositionReport;
  }> {
    const { data: mandatoryCodes } = await templatesDB.getMandatoryPackCodes(input.templateId);
    const { data: optionalCodes } = await profilesDB.getOptionalPackCodes(input.profileId);

    const warnings: string[] = [];
    const resolvedPacks: PackRow[] = [];

    for (const code of mandatoryCodes ?? []) {
      const { pack, warning } = await resolveActivePack(code, "the Template's mandatory set");
      if (warning) warnings.push(warning);
      if (pack) resolvedPacks.push(pack);
    }
    for (const code of optionalCodes ?? []) {
      const { pack, warning } = await resolveActivePack(code, "the Profile's optional set");
      if (warning) warnings.push(warning);
      if (pack) resolvedPacks.push(pack);
    }

    // Override strategy (Architecture Catalogue §11): later-composed Pack (Profile's
    // optional set) wins over an earlier one (Template's mandatory set) contributing
    // the same code. Every resolved row here is already Active by construction
    // (findActiveByCode's own WHERE clause) — no separate status filter needed.
    const byCode = new Map<string, PackRow>();
    for (const pack of resolvedPacks) {
      if (byCode.has(pack.code)) {
        warnings.push(`Pack ${pack.code} contributed more than once for this commissioning — later composition overrides earlier (Override strategy).`);
      }
      byCode.set(pack.code, pack);
    }

    const packs = [...byCode.values()];
    const composedPacks: EbmComposedPack[] = packs.map((pack) => ({
      packId: pack.id,
      packCode: pack.code,
      packVersion: pack.pack_version,
    }));

    // FR-3.6 / FR-21.7: detect governance conflicts across the composed Packs
    // from their declarative contributions (read unmasked from packs.contributions,
    // before the global upsert-by-code/triple collapses them). A conflict is an
    // *incompatible* contribution from different Packs that no Override rule
    // resolves — it requires human judgement. Same-code duplicates are the
    // Override case above (a warning), and multiple policies co-apply (not a
    // conflict).
    const conflicts = detectGovernanceConflicts(packs);

    return {
      composedPacks,
      compositionReport: { warnings, conflicts, resolutions: [] },
    };
  },
};

// A conflict is a CROSS-PACK disagreement — two DIFFERENT Packs contributing
// incompatible governance for the same target. Multiplicity WITHIN one Pack is
// the author's deliberate design and is never a conflict (e.g.
// platform-core-engineering legitimately assigns different roles to
// `knowledgescope.transition` for promotion to Capability/Enterprise/Platform).
// Detected:
//   (a) two different Packs assign different authorisedRole to the SAME
//       governedTransition — ambiguous authority; and
//   (b) two different Packs contribute quality gates on the SAME
//       (entityType,fromState,toState) triple — only one gate per triple.
function detectGovernanceConflicts(packs: PackRow[]): string[] {
  const conflicts: string[] = [];

  // governedTransition -> Map<packCode, Set<role>>
  const byTransition = new Map<string, Map<string, Set<string>>>();
  for (const pack of packs) {
    for (const rule of pack.contributions?.authorityRules ?? []) {
      const perPack = byTransition.get(rule.governedTransition) ?? new Map<string, Set<string>>();
      const roles = perPack.get(pack.code) ?? new Set<string>();
      roles.add(rule.authorisedRole);
      perPack.set(pack.code, roles);
      byTransition.set(rule.governedTransition, perPack);
    }
  }
  for (const [transition, perPack] of byTransition) {
    if (perPack.size < 2) continue; // only one Pack contributes here — intra-pack design, not a conflict
    const allRoles = new Set<string>();
    for (const roles of perPack.values()) for (const r of roles) allRoles.add(r);
    if (allRoles.size > 1) {
      const detail = [...perPack.entries()].map(([code, roles]) => `${code} requires ${[...roles].map((r) => `"${r}"`).join("/")}`).join(", ");
      conflicts.push(`Authority conflict on "${transition}": ${detail}. Different Packs assign different authorised roles — resolve before commissioning.`);
    }
  }

  // triple -> Set<packCode>
  const packsByTriple = new Map<string, Set<string>>();
  for (const pack of packs) {
    for (const gate of pack.contributions?.qualityGates ?? []) {
      const triple = `${gate.entityType} ${gate.fromState} -> ${gate.toState}`;
      const set = packsByTriple.get(triple) ?? new Set<string>();
      set.add(pack.code);
      packsByTriple.set(triple, set);
    }
  }
  for (const [triple, packCodes] of packsByTriple) {
    if (packCodes.size > 1) {
      conflicts.push(`Quality Gate conflict on ${triple}: contributed by ${[...packCodes].join(", ")}. Only one Quality Gate can gate a transition — resolve before commissioning.`);
    }
  }

  return conflicts;
}
