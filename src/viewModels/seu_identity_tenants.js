import { createViewModel } from "../utils/viewModel.js";

export const seu_identity_tenantsVM = createViewModel({
  required: ["title", "tenants"],
  optional: ["flash"],
});
