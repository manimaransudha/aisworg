import { createViewModel } from "../utils/viewModel.js";

// CR-009: the Objectives page is a tree. `mode` is "browse" (paginated Strategic
// roots — `roots` + `childTiers`) or "search" (flat hit list). `list` is the
// ListResult driving pagination in both modes.
export const seu_objectives_indexVM = createViewModel({
  required: ["title", "list", "mode"],
  optional: ["flash", "listBasePath", "roots", "childTiers"]
});
