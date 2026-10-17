import { createViewModel } from "../utils/viewModel.js";

export const seu_deliverable_definitions_indexVM = createViewModel({
  required: ["title", "list"],
  optional: ["flash", "listBasePath", "platformTenantId", "states", "activeStatus", "canCopy"]
});
