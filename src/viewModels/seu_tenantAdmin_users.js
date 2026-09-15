import { createViewModel } from "../utils/viewModel.js";

export const seu_tenantAdmin_usersVM = createViewModel({
  required: ["title", "list", "grantableBadges"],
  optional: ["flash", "listBasePath"],
});
