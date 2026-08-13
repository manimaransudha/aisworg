import { createViewModel } from "../utils/viewModel.js";

// CR-007 Step 2 — view-detail for a single transition definition.
export const seu_sdk_authority_detailVM = createViewModel({
  required: ["title", "detail"],
  optional: ["flash"],
});
