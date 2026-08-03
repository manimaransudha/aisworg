import { createViewModel } from "../utils/viewModel.js";

export const seu_dashboardVM = createViewModel({
  required: ["title", "layers", "counts"],
  optional: ["flash"]
});
