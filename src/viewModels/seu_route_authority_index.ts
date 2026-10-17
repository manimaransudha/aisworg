import { createViewModel } from "../utils/viewModel.js";

export const seu_route_authority_indexVM = createViewModel({
  required: ["title", "list"],
  optional: ["flash", "listBasePath"],
});
