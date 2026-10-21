import { templatesDB } from "../dblayer/templatesDB.js";
import type { PolicyImplementationInput } from "./index.js";

// The materialisation checks of a Template (CR-128): the values of its exposed parameters are values the parameters allow. It changes nothing.
export async function materialiseTemplate(input: PolicyImplementationInput): Promise<boolean> {
  if (!input.entityId) throw new Error("policy-materialise-template needs the id of the Template");
  const { data: template, error } = await templatesDB.findById(input.entityId);
  if (error) throw error;
  if (!template) throw new Error(`Template ${input.entityId} not found`);
  // Loaded when called: sdkAuthoring.ts imports the transition engine, which imports this registry.
  const { toTemplateSeedInput } = await import("../routes/seu/core/sdkAuthoring.js");
  const { validateExposedParameterValues } = await import("../routes/seu/core/templates.js");
  const seed = toTemplateSeedInput({ code: template.code, name: template.name, ...(template.draft_content ?? {}), templateVersion: template.template_version, tenantId: template.tenant_id, parentTemplateId: template.parent_template_id });
  return (await validateExposedParameterValues(seed)).length === 0;
}
