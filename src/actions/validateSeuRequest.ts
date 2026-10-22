import type { LivenessCheck } from "../routes/seu/core/commissioning.js";
import type { ActionInput } from "./index.js";

// Thrown when the Objective, Template, Profile or a Pack, Service or Ontology reference of an SEU is no longer live.
export class SeuLivenessError extends Error {
  constructor(public readonly references: string[], public readonly checks: LivenessCheck[]) {
    super(`references no longer live: ${references.join("; ")}`);
  }
}

// Validates a commissioning request (CR-128): runs the liveness checks on the SEU's references, inside the transition's
// transaction and before the status changes. A dead reference throws, so the SEU stays as it was and the caller takes the
// governed Failed row. The caller passes an array in `context.livenessChecks`, which the action fills.
export async function validateSeuRequest(input: ActionInput): Promise<void> {
  const seu = input.context.row as { id: string; objective_id: string; template_id: string; profile_id: string; tenant_id: string | null };
  // Loaded when called: routes/seu/core/commissioning.ts imports the transition engine, which imports this registry.
  const { checkRequestLiveness } = await import("../routes/seu/core/commissioning.js");
  const { objectivesDB } = await import("../dblayer/objectivesDB.js");
  const { templatesDB } = await import("../dblayer/templatesDB.js");
  const { profilesDB } = await import("../dblayer/profilesDB.js");
  const { getPlatformTenantId } = await import("../dblayer/constants.js");
  const [{ data: objective }, { data: template }, { data: profile }] = await Promise.all([
    objectivesDB.findById(seu.objective_id),
    templatesDB.findById(seu.template_id),
    profilesDB.findById(seu.profile_id),
  ]);
  if (!objective || !template || !profile) throw new Error(`Objective, Template or Profile referenced by SEU ${seu.id} not found`);
  const checks = await checkRequestLiveness({ objective, templates: [template], profile, viewerTenantId: seu.tenant_id ?? (await getPlatformTenantId()) });
  const sink = input.context.livenessChecks;
  if (Array.isArray(sink)) sink.push(...checks);
  const references = checks.filter((c) => c.status === "dead").map((c) => (c.detail ? `${c.item} ${c.detail}` : c.item));
  if (references.length > 0) throw new SeuLivenessError(references, checks);
}
