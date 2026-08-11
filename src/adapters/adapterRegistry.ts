// Participant Integration & Attestation — Plan step 5 (the decisive
// core-invariance seam). The registry maps an execution mode to a concrete
// ParticipantAdapter. This is the ONE place adapters are named; the core
// resolves an adapter by mode string and calls the interface, so adding a third
// adapter (LangGraph, gRPC, a queue) is a single `registerAdapter` call here
// with no core edit. If wiring a new adapter ever forced a change outside this
// file + its adapter module, the seam would be misplaced.
import type { ParticipantAdapter } from "./participantAdapter.js";
import { humanOnUiAdapter } from "./humanOnUiAdapter.js";
import { externalOrchestratorAdapter } from "./externalOrchestratorAdapter.js";

const adapters = new Map<string, ParticipantAdapter>();

export function registerAdapter(mode: string, adapter: ParticipantAdapter): void {
  adapters.set(mode, adapter);
}

// Resolve the adapter for a mode. Falls back to the human-on-UI adapter for an
// unknown/unconfigured mode — a Work Item is never left undeliverable, it just
// surfaces on the UI.
export function resolveAdapter(mode: string): ParticipantAdapter {
  return adapters.get(mode) ?? humanOnUiAdapter;
}

// The two built-in adapters. A tenant/plugin registers additional ones without
// touching the core.
registerAdapter(humanOnUiAdapter.mode as string, humanOnUiAdapter);
registerAdapter(externalOrchestratorAdapter.mode as string, externalOrchestratorAdapter);
