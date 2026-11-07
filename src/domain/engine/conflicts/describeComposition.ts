import { resolveDeliverableSource } from "../deliverableSource.js";
import type { EbmComposedPack, EbmDeliverableSource } from "../../../dblayer/seuTypes.js";
import type { DetectionContext } from "./types.js";

// What the EBM records about the composition itself: the Packs it composes, the warnings of Step 0, and where the Deliverable Catalogue and its dependencies come from.
export interface CompositionDescription {
  composedPacks: EbmComposedPack[];
  warnings: string[];
  deliverableSource?: EbmDeliverableSource;
}

// Describes the composition from the Step 0 Pack list and the Profile and Template. It decides nothing.
export async function describeComposition(context: DetectionContext): Promise<CompositionDescription> {
  const profile = context.profiles[0];
  const template = profile ? context.templates.find((t) => t.id === profile.base_template_id) : undefined;
  return {
    composedPacks: context.composedPacks.packs.map((pack) => ({ packId: pack.id, packCode: pack.code, packVersion: pack.pack_version })),
    warnings: context.composedPacks.warnings,
    deliverableSource: profile && template ? await resolveDeliverableSource(template, profile) : undefined,
  };
}
