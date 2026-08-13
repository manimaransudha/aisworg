import { createViewModel } from "../utils/viewModel.js";

export const seu_identity_usersVM = createViewModel({
  required: ["title", "list", "tenants"],
  optional: ["flash", "listBasePath"],
});
