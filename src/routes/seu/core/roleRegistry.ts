import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
import { CAPABILITY_ACTIVE_STATE } from "../../../dblayer/constants.js";
import { renderMarkdown } from "../../../domain/sdk/markdownRender.js";
import { listConceptsForType } from "./ontology.js";
import type { OntologyConceptRow } from "../../../dblayer/seuTypes.js";

export interface RoleRegistryWorkItemType {
  code: string;
  label: string;
  descriptionHtml: string;
}

export interface RoleRegistryCapability {
  id: string;
  code: string;
  label: string;
}

export interface RoleRegistryEntry {
  code: string;
  label: string;
  descriptionHtml: string;
  workItemTypes: RoleRegistryWorkItemType[];
  capabilities: RoleRegistryCapability[];
}

// The description of an Ontology concept is markdown or plain text, as its text_type states.
export function descriptionHtml(concept: OntologyConceptRow | undefined): string {
  if (!concept?.description) return "";
  return concept.text_type === "markdown" ? renderMarkdown(concept.description) : renderMarkdown(concept.description.replace(/[\\`*_{}[\]()#+\-.!>|]/g, "\\$&"));
}

// Every Role of the Ontology with its description, the work item types the Active Capability Definitions give it, and those Capabilities.
// Roles and work item types come from the Ontology. The link between them is held by the Capability Definitions.
export async function listRoleRegistry(viewer: { isRoot: boolean; tenantId: string | null }): Promise<RoleRegistryEntry[]> {
  const [roleConcepts, worktypeConcepts] = await Promise.all([
    listConceptsForType("role-name", viewer, false),
    listConceptsForType("worktype-name", viewer, false),
  ]);
  const worktypeByCode = new Map(worktypeConcepts.map((c) => [c.code, c]));

  const { data: rows, error } = viewer.isRoot || !viewer.tenantId ? await capabilityDefinitionsDB.findAll() : await capabilityDefinitionsDB.findAllVisibleTo(viewer.tenantId);
  if (error) throw error;
  const activeCapabilities = (rows ?? []).filter((c) => c.status === CAPABILITY_ACTIVE_STATE);

  const worktypesByRole = new Map<string, Set<string>>();
  const capabilitiesByRole = new Map<string, Map<string, RoleRegistryCapability>>();
  for (const capability of activeCapabilities) {
    for (const role of capability.roles ?? []) {
      const worktypes = worktypesByRole.get(role.name) ?? new Set<string>();
      for (const worktype of role.worktypes ?? []) worktypes.add(worktype);
      worktypesByRole.set(role.name, worktypes);
      const capabilities = capabilitiesByRole.get(role.name) ?? new Map<string, RoleRegistryCapability>();
      capabilities.set(capability.id, { id: capability.id, code: capability.code, label: capability.default_label });
      capabilitiesByRole.set(role.name, capabilities);
    }
  }

  return roleConcepts.map((role) => ({
    code: role.code,
    label: role.default_label,
    descriptionHtml: descriptionHtml(role),
    workItemTypes: [...(worktypesByRole.get(role.code) ?? [])].map((code) => {
      const concept = worktypeByCode.get(code);
      return { code, label: concept?.default_label ?? code, descriptionHtml: descriptionHtml(concept) };
    }),
    capabilities: [...(capabilitiesByRole.get(role.code)?.values() ?? [])].sort((a, b) => a.label.localeCompare(b.label)),
  }));
}
