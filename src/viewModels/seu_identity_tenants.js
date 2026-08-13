import { createViewModel } from "../utils/viewModel.js";

export const seu_identity_tenantsVM = createViewModel({
  required: ["title", "list"],
  optional: ["flash", "listBasePath"],
});
