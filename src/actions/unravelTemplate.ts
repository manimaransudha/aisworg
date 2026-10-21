import { templatesDB } from "../dblayer/templatesDB.js";
import type { ActionInput } from "./index.js";

// Unravels a Template into its tables: the catalogue, the Pack selections, the required Capabilities and the dependency graph (CR-128).
// It runs the materialisation checks first, so the content is checked as it stands now. It runs inside the transition's transaction.
export async function unravelTemplate(input: ActionInput): Promise<void> {
  const { data: template, error } = await templatesDB.findById(input.entityId);
  if (error) throw error;
  if (!template) throw new Error(`Template ${input.entityId} not found`);
  // Loaded when called: sdkAuthoring.ts imports the transition engine, which imports this registry.
  const { toTemplateSeedInput } = await import("../routes/seu/core/sdkAuthoring.js");
  const { materialiseTemplateDraft, validateExposedParameterValues } = await import("../routes/seu/core/templates.js");
  const seed = toTemplateSeedInput({ code: template.code, name: template.name, ...(template.draft_content ?? {}), templateVersion: template.template_version, tenantId: template.tenant_id, parentTemplateId: template.parent_template_id });
  const problems = await validateExposedParameterValues(seed);
  if (problems.length > 0) throw new Error(`Template ${template.code} cannot be unravelled: ${problems.join("; ")}`);
  const result = await materialiseTemplateDraft(template.id, seed, template.authored_by, template.author_badge);
  if (!result.ok) throw new Error(`Template ${template.code} cannot be unravelled: ${result.errors.join("; ")}`);
}
