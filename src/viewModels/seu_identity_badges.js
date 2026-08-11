import { createViewModel } from "../utils/viewModel.js";

export const seu_identity_badgesVM = createViewModel({
  required: ["title", "badgeTypes", "grants", "tenants"],
  optional: ["flash"],
});
