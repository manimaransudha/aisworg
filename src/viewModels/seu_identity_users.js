import { createViewModel } from "../utils/viewModel.js";

export const seu_identity_usersVM = createViewModel({
  required: ["title", "users"],
  optional: ["flash"],
});
