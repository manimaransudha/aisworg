import { seusDB } from "../dblayer/seusDB.js";
import { tenantsDB } from "../dblayer/tenantsDB.js";
import { loadSettled, configurationParameter } from "../domain/engine/ebmSettled.js";
import {
  AI_PROVIDER_CREDENTIALS_PARAMETER, ANTHROPIC_ENDPOINT_LIVE, ANTHROPIC_LIVE_BASE_URL, ANTHROPIC_PROVIDER_CODE, ANTHROPIC_SIMULATOR_API_KEY, ANTHROPIC_SIMULATOR_BASE_URL, DEMO_TENANT_CODE,
} from "../dblayer/constants.js";

export interface AnthropicCredentials {
  apiKey: string;
  baseURL: string;
}

// Where an SEU's Anthropic calls go. Calls are enabled for the Demo tenant only.
// The simulated endpoint is the default. A Profile row for `anthropic` whose endpoint is Anthropic bypasses it and calls the live API with the row's key,
// which the SEU's EBM carries.
export async function resolveAnthropicCredentials(seuId: string): Promise<AnthropicCredentials> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) throw new Error(`SEU ${seuId} not found`);
  const { data: tenant } = await tenantsDB.findById(seu.tenant_id);
  if (tenant?.code !== DEMO_TENANT_CODE) throw new Error(`calls to Anthropic are enabled for the "${DEMO_TENANT_CODE}" tenant only`);

  const rows = configurationParameter(await loadSettled(seuId), AI_PROVIDER_CREDENTIALS_PARAMETER);
  const row = (Array.isArray(rows) ? (rows as Array<{ provider?: string; endpoint?: string; apiKey?: string }>) : []).find((r) => r.provider === ANTHROPIC_PROVIDER_CODE);
  if (row?.endpoint !== ANTHROPIC_ENDPOINT_LIVE) return { apiKey: ANTHROPIC_SIMULATOR_API_KEY, baseURL: ANTHROPIC_SIMULATOR_BASE_URL };
  if (!row.apiKey?.trim()) throw new Error(`the Profile of SEU ${seuId} names the live Anthropic endpoint and holds no API key for the provider "${ANTHROPIC_PROVIDER_CODE}"`);
  return { apiKey: row.apiKey.trim(), baseURL: ANTHROPIC_LIVE_BASE_URL };
}
