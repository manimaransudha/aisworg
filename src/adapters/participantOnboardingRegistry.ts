// CR-098 — the ONE place onboarding adapters are named, mirroring
// adapterRegistry.ts's own seam exactly: the registry maps a Participant
// Type to a concrete ParticipantOnboardingAdapter. Adding a client-specific
// adapter (a real HR system, a real AI provisioning platform, a real CI/CD
// registry, a real audit board) is a single registerOnboardingAdapter call
// here with no change to cleanSlate.ts, seedParticipantsMaster.ts, or
// core/participantsMaster.ts's validated write path. If wiring a new/
// replacement adapter ever forced a change outside this file + its adapter
// module, the seam would be misplaced.
import type { ParticipantOnboardingAdapter } from "./participantOnboardingAdapter.js";
import { aiOnboardingAdapter } from "./aiOnboardingAdapter.js";
import { humanOnboardingAdapter } from "./humanOnboardingAdapter.js";
import { automatedOnboardingAdapter } from "./automatedOnboardingAdapter.js";
import { externalOnboardingAdapter } from "./externalOnboardingAdapter.js";

const adapters = new Map<string, ParticipantOnboardingAdapter>();

export function registerOnboardingAdapter(type: string, adapter: ParticipantOnboardingAdapter): void {
  adapters.set(type, adapter);
}

export function resolveOnboardingAdapter(type: string): ParticipantOnboardingAdapter {
  const adapter = adapters.get(type);
  if (!adapter) throw new Error(`no onboarding adapter registered for Participant Type "${type}"`);
  return adapter;
}

// Every Participant Type currently registered — a seed/bootstrap script
// iterates this instead of hardcoding the 4 type names, so a 5th
// registered type is picked up with no change to any caller.
export function listRegisteredOnboardingTypes(): string[] {
  return [...adapters.keys()];
}

// The 4 built-in mock adapters (Ch.13 §7). A tenant/plugin registers
// additional or replacement ones without touching the core.
registerOnboardingAdapter(aiOnboardingAdapter.type as string, aiOnboardingAdapter);
registerOnboardingAdapter(humanOnboardingAdapter.type as string, humanOnboardingAdapter);
registerOnboardingAdapter(automatedOnboardingAdapter.type as string, automatedOnboardingAdapter);
registerOnboardingAdapter(externalOnboardingAdapter.type as string, externalOnboardingAdapter);
