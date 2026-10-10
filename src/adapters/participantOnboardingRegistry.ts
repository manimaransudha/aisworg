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

export function listRegisteredOnboardingTypes(): string[] {
  return [...adapters.keys()];
}

registerOnboardingAdapter(aiOnboardingAdapter.type as string, aiOnboardingAdapter);
registerOnboardingAdapter(humanOnboardingAdapter.type as string, humanOnboardingAdapter);
registerOnboardingAdapter(automatedOnboardingAdapter.type as string, automatedOnboardingAdapter);
registerOnboardingAdapter(externalOnboardingAdapter.type as string, externalOnboardingAdapter);
