import { createViewModel } from "../utils/viewModel.js";

export const seu_roles_indexVM = createViewModel({
  required: ["title", "list"],
  optional: ["flash", "listBasePath", "roleCode"]
});
