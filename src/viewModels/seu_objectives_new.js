import { createViewModel } from "../utils/viewModel.js";

// CR-009: contextual create — the child's `tier` is fixed by the affordance,
// and `parent` is the node it decomposes from (absent for a Strategic root).
export const seu_objectives_newVM = createViewModel({
  required: ["title", "capabilities", "tier"],
  optional: ["flash", "parent", "statement", "selectedCodes"]
});
