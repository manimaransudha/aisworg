import { createViewModel } from "../utils/viewModel.js";

// Edit action for a single transition definition (owner: "View, Retire and
// Add are there. Edit is missing") — createsObligation/category only.
export const seu_sdk_authority_editVM = createViewModel({
  required: ["title", "detail"],
  optional: ["flash"],
});
