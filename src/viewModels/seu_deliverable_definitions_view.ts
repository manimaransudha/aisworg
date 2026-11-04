import { createViewModel } from "../utils/viewModel.js";

export const seu_deliverable_definitions_viewVM = createViewModel({
  required: ["title", "deliverable", "displayName"],
  optional: ["flash"]
});
