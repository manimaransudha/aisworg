// The provider side of an AI adapter. A client runs one conversation with a provider and returns when the model stops.
// The adapter stays free of conversation mechanics, so the mock and the real client are interchangeable.

export interface AiToolDefinition {
  name: string;
  description: string;
  // A JSON Schema object describing the tool input.
  inputSchema: Record<string, unknown>;
}

export interface AiToolResult {
  ok: boolean;
  // What the model reads back. A failed rule is returned here as text, so the model can act on it.
  content: string;
}

export type AiToolHandler = (name: string, input: Record<string, unknown>) => Promise<AiToolResult>;

export interface AiRunRequest {
  // The SEU the Work Item belongs to. A client that needs credentials resolves them for this SEU.
  seuId: string;
  system: string;
  prompt: string;
  tools: AiToolDefinition[];
}

export interface AiRunResult {
  finalText: string;
}

export interface AiProviderClient {
  run(request: AiRunRequest, onToolCall: AiToolHandler): Promise<AiRunResult>;
}

const clients = new Map<string, AiProviderClient>();

// A client is registered per adapter key. The real client is registered at start-up. Tests register the mock.
export function registerAiProviderClient(adapterKey: string, client: AiProviderClient): void {
  clients.set(adapterKey, client);
}

export function clearAiProviderClient(adapterKey: string): void {
  clients.delete(adapterKey);
}

export function resolveAiProviderClient(adapterKey: string): AiProviderClient {
  const client = clients.get(adapterKey);
  if (!client) throw new Error(`no AI provider client is registered for adapter "${adapterKey}"`);
  return client;
}
