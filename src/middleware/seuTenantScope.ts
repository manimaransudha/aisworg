import type { Request, Response, NextFunction } from "express";
import { requireTenantScope } from "./requireTenantScope.js";
import { getPlatformTenantId } from "../dblayer/constants.js";
import { seusDB } from "../dblayer/seusDB.js";
import { obligationsDB } from "../dblayer/obligationsDB.js";
import { deliverablesDB } from "../dblayer/deliverablesDB.js";
import { workItemsDB } from "../dblayer/workItemsDB.js";
import { userDB } from "../dblayer/userDB.js";
import { objectivesDB } from "../dblayer/objectivesDB.js";
import { profilesDB } from "../dblayer/profilesDB.js";
import { getEntityAdapter } from "../domain/engine/entityAdapters.js";
import type { DbResult, TransitionEntityType } from "../dblayer/seuTypes.js";

// CR-143 — The SEU named by a route's `:id` is in the tenant of the viewer. A router whose `:id` is an SEU id mounts it with
// `router.param("id", seuTenantScope)`. A viewer outside the tenant of the SEU gets the same answer as for an SEU that does not exist.
export const seuTenantScope = requireTenantScope.forParam("id", seusDB.findById, (seu) => seu.tenant_id, { notFoundMessage: "SEU not found." });
export const seuTenantScopeApi = requireTenantScope.forParam("id", seusDB.findById, (seu) => seu.tenant_id, { mode: "api", notFoundMessage: "SEU not found." });

// The Obligation named by a route's `:obligationId` belongs to an SEU in the tenant of the viewer. An Obligation takes its tenant from its owning SEU.
export const obligationTenantScope = requireTenantScope.forParam("obligationId", obligationsDB.findByIdWithTenant, (obligation) => obligation.tenant_id, { notFoundMessage: "Obligation not found." });

// The Deliverable named by a route's `:deliverableId` belongs to an SEU in the tenant of the viewer. A Deliverable takes its tenant from its owning SEU.
export const deliverableTenantScope = requireTenantScope.forParam("deliverableId", deliverablesDB.findByIdWithTenant, (deliverable) => deliverable.tenant_id, { notFoundMessage: "Deliverable not found." });

// The Work Item named by a route's `:workItemId` belongs to an SEU in the tenant of the viewer. A Work Item takes its tenant from the SEU of its Command.
export const workItemTenantScope = requireTenantScope.forParam("workItemId", workItemsDB.findByIdWithTenant, (workItem) => workItem.tenant_id, { notFoundMessage: "Work Item not found." });

// The entity of the given type with its tenant, read through the entity's own adapter (the one the transition function uses).
function entityWithTenant(entityType: TransitionEntityType) {
  return async (id: string): Promise<DbResult<{ tenantId: string | null } | null>> => {
    try {
      const adapter = getEntityAdapter(entityType);
      const row = await adapter.findById(id);
      return { data: row ? { tenantId: await adapter.tenantId(row) } : null };
    } catch (err) {
      return { error: err as Error };
    }
  };
}

// The entity named by a route param is in the tenant of the viewer. The entity and its tenant come from the entity's own adapter
// (the one the transition function uses), so one call guards any adapter-backed entity id. A router mounts it with
// `router.param(paramName, checkTenant(paramName, entityType))`.
export function checkTenant(paramName: string, entityType: TransitionEntityType, opts: { mode?: "web" | "api" } = {}) {
  return requireTenantScope.forParam(paramName, entityWithTenant(entityType), (entity) => entity.tenantId, { ...opts, notFoundMessage: `${entityType} not found.` });
}

// A Definition (Template, Profile, Deliverable Definition, Policy, Service, Capability) named by a route's `:id` is in the Platform tenant
// or the tenant of the viewer. A router mounts it with `router.param("id", definitionTenantScope(<entity>DB.findById, (row) => row.tenant_id, "<Entity> not found."))`.
export function definitionTenantScope<T>(lookup: (id: string) => Promise<DbResult<T | null>>, getTenantId: (row: T) => string | null, notFoundMessage: string) {
  return async (req: Request, res: Response, next: NextFunction, value: string): Promise<void> => {
    const gate = requireTenantScope.forParam("id", lookup, getTenantId, { notFoundMessage, platformTenantId: await getPlatformTenantId() });
    return gate(req, res, next, value);
  };
}

// The user named by a route's `:id` is in the tenant of the viewer. A user carries its own tenant.
export const userTenantScope = requireTenantScope.forParam(
  "id",
  async (id: string) => {
    try {
      return { data: await userDB.findById(id) };
    } catch (err) {
      return { error: err as Error };
    }
  },
  (user) => user.tenant_id,
  { notFoundMessage: "User not found." }
);

// POST /seus — the Objective named by the body field `objectiveId` is in the tenant of the viewer.
export const commissionObjectiveScope = requireTenantScope.forField("body", "objectiveId", objectivesDB.findById, (objective) => objective.sponsoring_authority?.tenant ?? null, { notFoundMessage: "Objective not found." });

// GET /seus/new — the Objective named by the query field `objectiveId` is in the tenant of the viewer.
export const commissionObjectiveQueryScope = requireTenantScope.forField("query", "objectiveId", objectivesDB.findById, (objective) => objective.sponsoring_authority?.tenant ?? null, { notFoundMessage: "Objective not found." });

// POST /seus — the Profile named by the body field `templateProfile` ("<templateId>|<profileId>") is in the Platform tenant or the tenant of the viewer.
export async function commissionProfileScope(req: Request, res: Response, next: NextFunction): Promise<void> {
  const profileId = String(req.body?.templateProfile ?? "").split("|")[1]?.trim() ?? "";
  if (!profileId) return next();
  const gate = requireTenantScope.forParam("templateProfile", profilesDB.findById, (profile) => profile.tenant_id, { notFoundMessage: "Profile not found.", platformTenantId: await getPlatformTenantId() });
  return gate(req, res, next, profileId);
}

// The Deliverable named by the body field `deliverableId` of an Evidence create or link is in the tenant of the viewer.
// The Deliverable may belong to any SEU of the tenant: Evidence is reusable across SEUs.
export const evidenceDeliverableScope = requireTenantScope.forField("body", "deliverableId", deliverablesDB.findByIdWithTenant, (deliverable) => deliverable.tenant_id, { notFoundMessage: "Deliverable not found." });

// The Evidence named by the body field `predecessorEvidenceId` of an Evidence create is in the tenant of the viewer.
export const evidencePredecessorScope = requireTenantScope.forField("body", "predecessorEvidenceId", entityWithTenant("Evidence"), (evidence) => evidence.tenantId, { notFoundMessage: "Evidence not found." });
