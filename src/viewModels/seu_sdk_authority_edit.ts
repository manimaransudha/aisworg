import { createViewModel } from "../utils/viewModel.js";

export const seu_sdk_authority_editVM = createViewModel({
  required: ["title", "detail"],
  optional: ["flash"],
});
