import { createViewModel } from "../utils/viewModel.js";

export const seu_sdk_ontology_approvalsVM = createViewModel({
  required: ["title", "list", "listBasePath"],
  optional: ["flash"],
});
