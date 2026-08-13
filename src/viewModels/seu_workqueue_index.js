import { createViewModel } from "../utils/viewModel.js";

export const seu_workqueue_indexVM = createViewModel({
  required: ["title", "seuId", "list"],
  optional: ["flash", "listBasePath"]
});
