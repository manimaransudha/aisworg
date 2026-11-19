import type { ParticipantAdapter } from "./participantAdapter.js";
import { humanOnUiAdapter } from "./humanOnUiAdapter.js";
import { externalOrchestratorAdapter } from "./externalOrchestratorAdapter.js";
import { anthropicAiAdapter } from "./anthropicAiAdapter.js";

const adapters = new Map<string, ParticipantAdapter>();

export function registerAdapter(mode: string, adapter: ParticipantAdapter): void {
  adapters.set(mode, adapter);
}

export function isRegisteredAdapter(key: string): boolean {
  return adapters.has(key);
}

export function listRegisteredAdapters(): string[] {
  return [...adapters.keys()];
}

export function resolveAdapter(mode: string): ParticipantAdapter {
  return adapters.get(mode) ?? humanOnUiAdapter;
}

registerAdapter(humanOnUiAdapter.mode as string, humanOnUiAdapter);
registerAdapter(externalOrchestratorAdapter.mode as string, externalOrchestratorAdapter);
registerAdapter(anthropicAiAdapter.mode as string, anthropicAiAdapter);
