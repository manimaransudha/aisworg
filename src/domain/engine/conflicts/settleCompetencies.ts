import { COMPETENCY_DIMENSION_DOMAIN, COMPETENCY_DIMENSION_ROLE, COMPETENCY_DIMENSION_TECHNOLOGY, COMPETENCY_DIMENSION_WORK_TYPE } from "../../../dblayer/constants.js";
import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
import type { RecordedConflict, CapabilityRole } from "../../../dblayer/seuTypes.js";
import type { CapabilitiesSettled } from "./settleCapabilities.js";
import type { ComposedPacks } from "./composedPacks.js";
import type { LeftOut } from "./settleShared.js";
import type { DetectionContext } from "./types.js";

// A competency the SEU requires, with where it comes from.
export interface SettledCompetency {
  dimension: string;
  value: string;
  sources: string[];
}

export interface CompetenciesSettled {
  // Competencies are added together, so there is no conflict. The field is kept so every table is saved the same way.
  conflicts: RecordedConflict[];
  result: SettledCompetency[];
  // Competencies are added together, so nothing is left out.
  leftOut: LeftOut[];
}

// What the competencies are built from, gathered by the caller.
export interface CompetencySources {
  // The roles of the Capability Definitions of the Capabilities the SEU takes, with the Capability each belongs to.
  capabilityRoles: Array<{ capability: string; roles: CapabilityRole[] }>;
  // The Profiles' programming language and domain.
  profiles: Array<{ code: string; programmingLanguage: string | null; domain: string | null }>;
  // The competencies the composed Packs give.
  packCompetencies: Array<{ pack: string; dimension: string; value: string }>;
}

// The competencies are added together from three places: the role types and work types of the Capabilities the SEU takes, the Profile's programming language and domain, and the Packs' own.
export function settleCompetenciesFrom(sources: CompetencySources): CompetenciesSettled {
  const found = new Map<string, SettledCompetency>();
  const add = (dimension: string, value: string, source: string) => {
    const id = JSON.stringify([dimension, value]);
    const existing = found.get(id) ?? { dimension, value, sources: [] };
    if (!existing.sources.includes(source)) existing.sources.push(source);
    found.set(id, existing);
  };
  for (const { capability, roles } of sources.capabilityRoles) {
    for (const role of roles) {
      add(COMPETENCY_DIMENSION_ROLE, role.name, `Capability ${capability}`);
      for (const worktype of role.worktypes) add(COMPETENCY_DIMENSION_WORK_TYPE, worktype, `Capability ${capability}`);
    }
  }
  for (const profile of sources.profiles) {
    if (profile.programmingLanguage) add(COMPETENCY_DIMENSION_TECHNOLOGY, profile.programmingLanguage, `Profile ${profile.code}`);
    if (profile.domain) add(COMPETENCY_DIMENSION_DOMAIN, profile.domain, `Profile ${profile.code}`);
  }
  for (const competency of sources.packCompetencies) add(competency.dimension, competency.value, `Pack ${competency.pack}`);
  return { conflicts: [], leftOut: [], result: [...found.values()].sort((a, b) => a.dimension.localeCompare(b.dimension) || a.value.localeCompare(b.value)) };
}

// Gathers the three places from the Step 0 Packs, the Profiles and the Capabilities the SEU takes.
export async function settleCompetencies(context: DetectionContext, capabilities: CapabilitiesSettled): Promise<CompetenciesSettled> {
  const codes = capabilities.result.map((r) => r.capability);
  const { data: definitions } = codes.length > 0 ? await capabilityDefinitionsDB.findActiveByCodesVisibleTo(codes, context.viewerTenantId) : { data: [] };
  const profiles = context.profiles.map((profile) => {
    const draft = (profile.draft_content ?? {}) as Record<string, unknown>;
    return { code: profile.code, programmingLanguage: typeof draft.primaryProgrammingLanguage === "string" ? draft.primaryProgrammingLanguage : null, domain: typeof draft.domain === "string" ? draft.domain : null };
  });
  return settleCompetenciesFrom({
    capabilityRoles: (definitions ?? []).map((d) => ({ capability: d.code, roles: d.roles ?? [] })),
    profiles,
    packCompetencies: packCompetenciesOf(context.composedPacks),
  });
}

function packCompetenciesOf(composedPacks: ComposedPacks): CompetencySources["packCompetencies"] {
  return composedPacks.packs.flatMap((pack) => (pack.contributions?.competencies ?? []).filter((c) => c.dimension && c.value).map((c) => ({ pack: pack.code, dimension: c.dimension!, value: c.value! })));
}
