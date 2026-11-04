import { createViewModel } from "../utils/viewModel.js";

export const seu_profiles_indexVM = createViewModel({
  required: ["title", "list"],
  optional: ["flash", "listBasePath", "categories", "activeCategory", "platformTenantId", "tenantNameById", "states", "activeStatus", "canCopy"]
});
