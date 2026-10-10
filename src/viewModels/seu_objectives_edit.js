import { createViewModel } from "../utils/viewModel.js";

export const seu_objectives_editVM = createViewModel({
  required: ["title", "objective", "capabilities"],
  optional: ["flash", "statement", "selectedCodes", "childTiers", "reParentOptions", "comments", "canComment"]
});
