import { createViewModel } from "../utils/viewModel.js";

export const seu_quality_gate_definitions_indexVM = createViewModel({
  required: ["title", "list"],
  optional: ["flash", "listBasePath", "platformTenantId", "tenantNameById", "states", "activeStatus", "canCopy"]
});
