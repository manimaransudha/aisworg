import { createViewModel } from "../utils/viewModel.js";

// design/mvp-build-plan/SEU Composition.md, 2026-09-07 — split out of
// seu_seus_validate.js (owner: "That was supposed to only show the liveness
// of the information... decoupling is also going to need new pages"). Compose
// EBM's own output only — ebmComposerHandler's real result, or "Apply &
// re-validate"'s own recompute of the same thing.
export const seu_seus_composeVM = createViewModel({
  required: ["title", "objectiveId", "selections", "compositionReport"],
  optional: ["flash", "pending", "seuId", "ebmComposed", "composedPacks", "profileDetails", "resolvedParameterOverrides", "unraveled", "compositionConflicts", "resolvedCompositionConflicts"]
});
