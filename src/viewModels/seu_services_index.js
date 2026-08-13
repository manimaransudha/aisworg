import { createViewModel } from "../utils/viewModel.js";

export const seu_services_indexVM = createViewModel({
  required: ["title", "list"],
  optional: ["flash", "listBasePath"]
});
