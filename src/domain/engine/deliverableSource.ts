import { dependencyDefinitionsDB } from "../../dblayer/dependencyDefinitionsDB.js";
import type { DependencyOwningScope } from "../../dblayer/dependencyDefinitionsDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { profilesDB } from "../../dblayer/profilesDB.js";
import { templatesDB } from "../../dblayer/templatesDB.js";
import type { EbmDeliverableSource, EbmRow, ProfileRow, TemplateDeliverableSeed, TemplateRow } from "../../dblayer/seuTypes.js";

// The Deliverable Catalogue a Profile carries of its own (empty when the Profile keeps its base Template's).
export function profileOwnCatalogue(profile: ProfileRow): TemplateDeliverableSeed[] {
  const catalogue = (profile.draft_content as Record<string, unknown> | null)?.deliverableCatalogue;
  return Array.isArray(catalogue) ? (catalogue as TemplateDeliverableSeed[]).filter((entry) => typeof entry?.code === "string" && entry.code.trim() !== "") : [];
}

// The Profile is the source of the catalogue and the dependencies when it carries its own catalogue, otherwise its base Template is.
// The dependency rows are those written when the source object was published.
export async function resolveDeliverableSource(template: TemplateRow, profile: ProfileRow): Promise<EbmDeliverableSource> {
  const type = profileOwnCatalogue(profile).length > 0 ? "Profile" : "Template";
  const id = type === "Profile" ? profile.id : template.id;
  const { data: rows, error } = await dependencyDefinitionsDB.findByOwner(type, id);
  if (error) throw error;
  return { type, id, dependencyDefinitionIds: (rows ?? []).map((row) => row.id) };
}

// The catalogue of one Template in a commissioning: the Profile's own when the Profile is the source and this Template is its base.
export function catalogueFor(template: TemplateRow, profile: ProfileRow, source: EbmDeliverableSource): TemplateDeliverableSeed[] {
  return source.type === "Profile" && profile.base_template_id === template.id ? profileOwnCatalogue(profile) : template.deliverable_catalogue;
}

// The source an EBM recorded when it was composed.
function recordedSource(ebm: EbmRow): EbmDeliverableSource {
  const recorded = ebm.composition_report?.deliverableSource;
  if (!recorded) throw new Error(`EBM ${ebm.id} has no recorded Deliverable source`);
  return recorded;
}

// The Deliverable Catalogue of one SEU: from the source its EBM recorded, or from its Template and Profile when it has no EBM yet.
export async function loadSeuCatalogue(seu: { template_id: string; profile_id: string; active_ebm_id: string | null }): Promise<TemplateDeliverableSeed[]> {
  const { data: ebm } = seu.active_ebm_id ? await ebmsDB.findById(seu.active_ebm_id) : { data: null };
  const [{ data: template }, { data: profile }] = await Promise.all([templatesDB.findById(ebm?.template_id ?? seu.template_id), profilesDB.findById(ebm?.profile_id ?? seu.profile_id)]);
  if (!template || !profile) throw new Error(`SEU Template ${seu.template_id} or Profile ${seu.profile_id} not found`);
  return catalogueFor(template, profile, ebm ? recordedSource(ebm) : await resolveDeliverableSource(template, profile));
}

// The dependency rows that govern one SEU. An EBM recorded them when it was composed; an SEU with no EBM yet reads them from its Template and Profile.
export async function resolveSeuOwningScope(seu: { template_id: string; profile_id: string; active_ebm_id: string | null }): Promise<DependencyOwningScope> {
  const { data: ebm } = seu.active_ebm_id ? await ebmsDB.findById(seu.active_ebm_id) : { data: null };
  if (ebm) return { dependencyDefinitionIds: recordedSource(ebm).dependencyDefinitionIds };
  const [{ data: template }, { data: profile }] = await Promise.all([templatesDB.findById(seu.template_id), profilesDB.findById(seu.profile_id)]);
  if (!template || !profile) throw new Error(`SEU Template ${seu.template_id} or Profile ${seu.profile_id} not found`);
  const source = await resolveDeliverableSource(template, profile);
  return { dependencyDefinitionIds: source.dependencyDefinitionIds };
}
