// The AI provider credentials of a Profile: one row per provider, {provider, apiKey}. A key is write-only on screen.
// Content shown to a user carries a masked key. A save that returns the mask unchanged keeps the stored key.

export interface AiProviderCredential {
  provider: string;
  apiKey: string;
  // Every other field of the row, such as the endpoint, is kept as it is.
  [field: string]: unknown;
}

export const AI_PROVIDER_CREDENTIALS_FIELD = "aiProviderCredentials";

// The first characters and the last four, enough to tell keys apart. A short key is masked whole.
export function maskApiKey(apiKey: string): string {
  const key = apiKey.trim();
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

function rowsOf(content: Record<string, unknown> | null | undefined): AiProviderCredential[] {
  const raw = content?.[AI_PROVIDER_CREDENTIALS_FIELD];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({ ...row, provider: String(row.provider ?? ""), apiKey: String(row.apiKey ?? "") }));
}

// The content as a user sees it: every key masked.
export function redactProfileSecrets<T extends Record<string, unknown>>(content: T): T {
  if (!Array.isArray(content[AI_PROVIDER_CREDENTIALS_FIELD])) return content;
  return { ...content, [AI_PROVIDER_CREDENTIALS_FIELD]: rowsOf(content).map((row) => ({ ...row, apiKey: row.apiKey ? maskApiKey(row.apiKey) : "" })) };
}

// The content to store. A key that equals the mask of the stored key for the same provider is the stored key. Any other value is a new key.
export function restoreProfileSecrets<T extends Record<string, unknown>>(submitted: T, stored: Record<string, unknown> | null | undefined): T {
  if (!Array.isArray(submitted[AI_PROVIDER_CREDENTIALS_FIELD])) return submitted;
  const storedKeys = new Map(rowsOf(stored).map((row) => [row.provider, row.apiKey]));
  const restored = rowsOf(submitted).map((row) => {
    const existing = storedKeys.get(row.provider);
    return { ...row, apiKey: existing && row.apiKey === maskApiKey(existing) ? existing : row.apiKey };
  });
  return { ...submitted, [AI_PROVIDER_CREDENTIALS_FIELD]: restored };
}
