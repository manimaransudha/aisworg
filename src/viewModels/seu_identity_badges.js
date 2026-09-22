import { createViewModel } from "../utils/viewModel.js";

export const seu_identity_badgesVM = createViewModel({
  required: ["title", "list", "authorisedBadgeCodes", "currentUserEmail"],
  optional: ["flash", "listBasePath", "tenantFilterOptions", "activeTenant"],
});
