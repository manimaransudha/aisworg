import { createViewModel } from "../utils/viewModel.js";

export const seu_objectives_newVM = createViewModel({
  required: ["title", "capabilities", "parentOptions"],
  optional: ["flash"]
});
