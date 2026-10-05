import { createViewModel } from "../utils/viewModel.js";

export const seu_versionEvents_indexVM = createViewModel({
  required: ["title", "list", "filters"],
  optional: ["flash"]
});
