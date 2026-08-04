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

    const warnings: string[] = [];

    // Bug fix — composition previously resolved template_packs/profile_packs
    // junction rows without ever checking pack.status, so a Deprecated,
    // Retired or Archived Pack composed exactly like Active, silently. Only
    // Active Packs may be composed into a new EBM; anything else is excluded
    // here (not blocked earlier) and named in the warning, so a Pack going
    // through its own lifecycle (this session's own Pack Registry audit
    // archived platform-core-engineering by hand) can't silently keep
    // shaping every new commissioning after that. Non-Active Packs remain
    // fully usable for everything else — creating a new Pack, declaring a
    // dependency on one, the SDK's dependency resolution — this restriction
    // is composition-only, per Ch.38 §14 "Runtime Visibility": only what's
    // live should be composed into new runtime configuration.
    const activePacks: PackRow[] = [];
    for (const pack of allPacks) {
      if (pack.status !== "Active") {
        warnings.push(`Pack ${pack.code}@${pack.pack_version} was excluded from composition — status is "${pack.status}", not Active.`);
        continue;
      }
      activePacks.push(pack);
    }

    // Override strategy (Architecture Catalogue §11): later-composed Pack (Profile's
    // optional set) wins over an earlier one (Template's mandatory set) contributing
    // the same code.
    const byCode = new Map<string, PackRow>();
    for (const pack of activePacks) {
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
