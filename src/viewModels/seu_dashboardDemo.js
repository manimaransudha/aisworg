import { createViewModel } from "../utils/viewModel.js";

export const seu_dashboardDemoVM = createViewModel({
  required: ["title", "about"],
  optional: ["flash"]
});
