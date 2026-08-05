import { createViewModel } from "../utils/viewModel.js";

export const seu_identity_indexVM = createViewModel({
  required: ["title", "tenants", "badgeTypes", "grants", "users"],
  optional: ["flash"],
});
