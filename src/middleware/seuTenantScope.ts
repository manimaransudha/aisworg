import { requireTenantScope } from "./requireTenantScope.js";
import { seusDB } from "../dblayer/seusDB.js";

// CR-143 — The SEU named by a route's `:id` is in the tenant of the viewer. A router whose `:id` is an SEU id mounts it with
// `router.param("id", seuTenantScope)`. A viewer outside the tenant of the SEU gets the same answer as for an SEU that does not exist.
export const seuTenantScope = requireTenantScope.forParam("id", seusDB.findById, (seu) => seu.tenant_id, { notFoundMessage: "SEU not found." });
export const seuTenantScopeApi = requireTenantScope.forParam("id", seusDB.findById, (seu) => seu.tenant_id, { mode: "api", notFoundMessage: "SEU not found." });
