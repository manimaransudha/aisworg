import { createViewModel } from "../utils/viewModel.js";

export const seu_identity_badgesVM = createViewModel({
  required: ["title", "badgeTypes", "list", "tenants"],
  optional: ["flash", "listBasePath", "activeTab"],
});
