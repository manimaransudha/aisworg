import { createViewModel } from "../utils/viewModel.js";

export const seu_seus_composeVM = createViewModel({
  required: ["title", "objectiveId", "selections", "compositionReport"],
  optional: ["flash", "pending", "seuId", "ebmComposed", "composedPacks", "profileDetails", "resolvedParameterOverrides", "unraveled", "compositionConflicts", "resolvedCompositionConflicts"]
});
