import { executionTargetsDB } from "../dblayer/executionTargetsDB.js";
import { tenantsDB } from "../dblayer/tenantsDB.js";
import type { ResolvedExecutionTarget } from "./participantAdapter.js";

async function effectiveTenantId(tenantId: string | null): Promise<string | null> {
  if (tenantId) return tenantId;
  const { data: def } = await tenantsDB.findDefault();
  return def?.id ?? null;
}

export async function resolveExecutionTarget(tenantId: string | null, capabilityId: string | null): Promise<ResolvedExecutionTarget> {
  const human: ResolvedExecutionTarget = { mode: "human-on-ui", adapterEndpoint: null, adapterAuthRef: null };
  if (!capabilityId) return human;
  const effectiveTenant = await effectiveTenantId(tenantId);
  if (!effectiveTenant) return human;
  const { data: row } = await executionTargetsDB.findByTenantAndCapability(effectiveTenant, capabilityId);
  if (!row) return human;
  return { mode: row.mode, adapterEndpoint: row.adapter_endpoint, adapterAuthRef: row.adapter_auth_ref };
}
