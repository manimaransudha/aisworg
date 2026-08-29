import { createViewModel } from "../utils/viewModel.js";

// CR-075 — the Edit page: statement/required Capabilities (the original
// form) plus decomposition mutations (Add child, Move to a different
// parent) and the Comments Post form — all moved here from the view page,
// since all of them are edits too.
export const seu_objectives_editVM = createViewModel({
  required: ["title", "objective", "capabilities"],
  optional: ["flash", "statement", "selectedCodes", "childTiers", "reParentOptions", "comments", "canComment"]
});
