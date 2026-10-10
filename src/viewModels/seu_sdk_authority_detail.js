import { createViewModel } from "../utils/viewModel.js";

export const seu_sdk_authority_detailVM = createViewModel({
  required: ["title", "detail"],
  optional: ["flash", "canWriteAuthority"],
});
