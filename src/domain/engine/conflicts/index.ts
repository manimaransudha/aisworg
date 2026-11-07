import { detectServiceConflicts } from "./services.js";
import { detectCapabilityConflicts } from "./capabilities.js";
import { detectPolicyConflicts } from "./policies.js";
import { detectAuthorityRuleConflicts } from "./authorityRules.js";
import { detectQualityGateConflicts } from "./qualityGates.js";
import { detectReviewGateConflicts } from "./reviewGates.js";
import { detectObligationDefinitionConflicts } from "./obligationDefinitions.js";
import { detectEngineeringCapitalConflicts } from "./engineeringCapital.js";

import { withAction, resolveConflict, type ConflictPick } from "./resolve.js";
import { flattenComposedPacks } from "./composedPacks.js";
import { describeComposition } from "./describeComposition.js";
import { settleServices, type ServicesSettled } from "./settleServices.js";
import { settleCapabilities, type CapabilitiesSettled } from "./settleCapabilities.js";
import { settlePolicies, type PoliciesSettled } from "./settlePolicies.js";
import { settleAuthorityRules, type AuthorityRulesSettled } from "./settleAuthorityRules.js";
import { settleQualityGates, type QualityGatesSettled } from "./settleQualityGates.js";
import { settleReviewGates, type ReviewGatesSettled } from "./settleReviewGates.js";
import { settleObligationDefinitions, type ObligationDefinitionsSettled } from "./settleObligationDefinitions.js";
import { settleEngineeringCapital, type EngineeringCapitalSettled } from "./settleEngineeringCapital.js";
import { settleDependencies, type DependenciesSettled } from "./settleDependencies.js";
import { settleChecklists, type ChecklistsSettled } from "./settleChecklists.js";
import { settleCompetencies, type CompetenciesSettled } from "./settleCompetencies.js";
import { settleProfileConfiguration, type ProfileConfigurationSettled } from "./settleProfileConfiguration.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import type { ProfileRow, TemplateRow } from "../../../dblayer/seuTypes.js";
import type { ActionedConflict, ConflictResolutions, DetectionContext, EbmConflict } from "./types.js";

export { settleServicesFrom } from "./settleServices.js";
export type { ServicesSettled, SettledService } from "./settleServices.js";
export type { ActionedConflict, ConflictOption, ConflictResolutions, EbmConflict } from "./types.js";
export { resolveConflict, type ConflictPick, type ResolveResult } from "./resolve.js";
export { detectServiceConflicts, detectCapabilityConflicts, detectPolicyConflicts, detectAuthorityRuleConflicts, detectQualityGateConflicts, detectReviewGateConflicts, detectObligationDefinitionConflicts, detectEngineeringCapitalConflicts };

export type EbmConflictTable = EbmConflict["table"];

type TableDetector = (context: DetectionContext, resolutions: ConflictResolutions) => Promise<EbmConflict[]>;

// One detector per table. Each takes the detection context and the user's picks, so one table can be re-run alone after a pick.
// Checklists are a union and competencies are added together, so neither has a detector.
export const CONFLICT_DETECTORS: Record<EbmConflictTable, TableDetector> = {
  services: detectServiceConflicts,
  capabilities: detectCapabilityConflicts,
  policies: detectPolicyConflicts,
  authorityRules: detectAuthorityRuleConflicts,
  qualityGates: detectQualityGateConflicts,
  reviewGates: detectReviewGateConflicts,
  obligationDefinitions: detectObligationDefinitionConflicts,
  engineeringCapital: detectEngineeringCapitalConflicts,
  // The dependency conflicts are found by Step 0, which follows the dependencies.
  dependencies: async (context) => context.composedPacks.dependencyConflicts,
};

// Re-runs the one detector of a table, for example after the user picks on that table's tab.
export async function detectTableConflicts(table: EbmConflictTable, context: DetectionContext, resolutions: ConflictResolutions): Promise<ActionedConflict[]> {
  return (await CONFLICT_DETECTORS[table](context, resolutions)).map(withAction);
}

// The one entry point of conflict detection. Step 0 runs first and flattens the Packs of the Templates and Profiles into one list.
// That list goes to every table's detector. Every conflict comes back with the user's pick, or null while it is open.
// The context every detector and every settle function receives. Step 0 runs here and flattens the Packs of the Templates and Profiles into one list.
export async function buildDetectionContext(input: { templateIds: string[]; profileIds: string[]; viewerTenantId: string }): Promise<DetectionContext> {
  const templates: TemplateRow[] = [];
  for (const templateId of input.templateIds) {
    const { data: template } = await templatesDB.findById(templateId);
    if (template) templates.push(template);
  }
  const profiles: ProfileRow[] = [];
  for (const profileId of input.profileIds) {
    const { data: profile } = await profilesDB.findById(profileId);
    if (profile) profiles.push(profile);
  }
  const composedPacks = await flattenComposedPacks({ templates, profiles }, input.viewerTenantId);
  return { templates, profiles, viewerTenantId: input.viewerTenantId, composedPacks };
}

export async function detectEbmConflicts(input: {
  templateIds: string[];
  profileIds: string[];
  viewerTenantId: string;
  resolutions?: ConflictResolutions;
}): Promise<Record<EbmConflictTable, ActionedConflict[]>> {
  const context = await buildDetectionContext(input);
  const resolutions = input.resolutions ?? {};
  const result = {} as Record<EbmConflictTable, ActionedConflict[]>;
  for (const table of Object.keys(CONFLICT_DETECTORS) as EbmConflictTable[]) result[table] = await detectTableConflicts(table, context, resolutions);
  return result;
}

// What the EBM saves, table by table: the conflicts with the user's picks, and the final result the SEU takes.
export interface EbmSettled {
  services: ServicesSettled;
  capabilities: CapabilitiesSettled;
  policies: PoliciesSettled;
  authorityRules: AuthorityRulesSettled;
  qualityGates: QualityGatesSettled;
  reviewGates: ReviewGatesSettled;
  obligationDefinitions: ObligationDefinitionsSettled;
  engineeringCapital: EngineeringCapitalSettled;
  dependencies: DependenciesSettled;
  checklists: ChecklistsSettled;
  competencies: CompetenciesSettled;
  profileConfiguration: ProfileConfigurationSettled;
}

export async function settleEbm(input: { templateIds: string[]; profileIds: string[]; viewerTenantId: string; resolutions?: ConflictResolutions }): Promise<EbmSettled> {
  const context = await buildDetectionContext(input);
  const resolutions = input.resolutions ?? {};
  const capabilities = await settleCapabilities(context, resolutions);
  return {
    services: await settleServices(context, resolutions),
    capabilities,
    policies: await settlePolicies(context, resolutions),
    authorityRules: await settleAuthorityRules(context, resolutions),
    qualityGates: await settleQualityGates(context, resolutions),
    reviewGates: await settleReviewGates(context, resolutions),
    obligationDefinitions: await settleObligationDefinitions(context, resolutions),
    engineeringCapital: await settleEngineeringCapital(context, resolutions),
    dependencies: await settleDependencies(context),
    checklists: await settleChecklists(context),
    competencies: await settleCompetencies(context, capabilities),
    profileConfiguration: await settleProfileConfiguration(context),
  };
}

// The conflicts that stop composition from completing: every conflict that has no pick, except a notice. A conflict that cannot be resolved here never gets a pick and still blocks.
export function blockingEbmConflicts(conflicts: Partial<Record<EbmConflictTable, ActionedConflict[]>>): ActionedConflict[] {
  return (Object.keys(conflicts) as EbmConflictTable[]).flatMap((table) => (conflicts[table] ?? []).filter((c) => !c.notice && c.resolution === null));
}

// Finds the conflict a pick is for (open or already picked, so a pick can be changed), checks the pick and returns the value to store under the conflict's key.
export function applyConflictPick(
  conflicts: Partial<Record<EbmConflictTable, ActionedConflict[]>>,
  key: string,
  pick: ConflictPick
): { ok: true; key: string; value: unknown } | { ok: false; error: string } {
  const conflict = (Object.keys(conflicts) as EbmConflictTable[]).flatMap((table) => conflicts[table] ?? []).find((c) => c.key === key);
  if (!conflict) return { ok: false, error: "That conflict is not open." };
  const resolved = resolveConflict(conflict, pick);
  return resolved.ok ? { ok: true, key, value: resolved.value } : resolved;
}

// What the Resolve Conflicts screen shows for one conflict: open, resolved, or a notice that needs no pick.
export type ConflictStatus = "open" | "notice" | "resolved";

export function conflictStatus(conflict: ActionedConflict): ConflictStatus {
  return conflict.notice ? "notice" : conflict.resolution !== null ? "resolved" : "open";
}

// One entry for each tab of the screen: the table, how many conflicts it has and how many of them are open.
export type EbmTab = EbmConflictTable | "checklists" | "competencies" | "profileConfiguration";

// The checklists, the competencies and the Profile configuration have no conflict, but their tab shows the value the SEU takes.
export const VALUE_ONLY_TABS: EbmTab[] = ["checklists", "competencies", "profileConfiguration"];

export function summariseConflictTables(conflicts: Partial<Record<EbmConflictTable, ActionedConflict[]>>): Array<{ table: EbmTab; total: number; open: number }> {
  const withConflicts = (Object.keys(CONFLICT_DETECTORS) as EbmConflictTable[]).map((table) => {
    const list = conflicts[table] ?? [];
    return { table: table as EbmTab, total: list.length, open: list.filter((c) => conflictStatus(c) === "open").length };
  });
  return [...withConflicts, ...VALUE_ONLY_TABS.map((table) => ({ table, total: 0, open: 0 }))];
}

export { describeComposition };
