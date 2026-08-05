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

    const composedPacks: EbmComposedPack[] = [...byCode.values()].map((pack) => ({
      packId: pack.id,
      packCode: pack.code,
      packVersion: pack.pack_version,
    }));

    return {
      composedPacks,
      compositionReport: { warnings, conflicts: [], resolutions: [] },
    };
  },
};
