import { createViewModel } from "../utils/viewModel.js";

export const seu_objectives_indexVM = createViewModel({
  required: ["title", "list", "mode"],
  optional: ["flash", "listBasePath", "roots", "childTiers"]
});
