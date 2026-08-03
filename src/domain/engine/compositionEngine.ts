// Ch.4 minimal instance — composes a Template's mandatory Packs + a Profile's
// optional Packs into the ordered Pack list an EBM records (Build Plan §5 item
// 5: EBM and EEC are collapsed into one table, so "compose" here means
// "resolve + de-duplicate the Pack set", not build a separately-published,
// reusable EBM). Deterministic and traceable per AP requirements: same
// Template+Profile Pack set in, same composedPacks/report out, every time.
import { templatesDB } from "../../dblayer/templatesDB.js";
import { profilesDB } from "../../dblayer/profilesDB.js";
import type { EbmComposedPack, EbmCompositionReport, PackRow } from "../../dblayer/seuTypes.js";

export const compositionEngine = {
  async compose(input: { templateId: string; profileId: string }): Promise<{
    composedPacks: EbmComposedPack[];
    compositionReport: EbmCompositionReport;
  }> {
    const { data: mandatoryPacks } = await templatesDB.getMandatoryPacks(input.templateId);
    const { data: optionalPacks } = await profilesDB.getOptionalPacks(input.profileId);
    const allPacks: PackRow[] = [...(mandatoryPacks ?? []), ...(optionalPacks ?? [])];

    // Override strategy (Architecture Catalogue §11): later-composed Pack (Profile's
    // optional set) wins over an earlier one (Template's mandatory set) contributing
    // the same code. With MVP's single-Pack seed data this never actually triggers —
    // written to be correct once a second Pack is added, not just for the seed data.
    const byCode = new Map<string, PackRow>();
    const warnings: string[] = [];
    for (const pack of allPacks) {
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
