import { createViewModel } from "../utils/viewModel.js";

export const quickview_indexVM = createViewModel({
  required: ["title", "seus"],
  optional: ["flash"]
});
