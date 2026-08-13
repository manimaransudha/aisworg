import { createViewModel } from "../utils/viewModel.js";

export const seu_sdk_schema_registry_indexVM = createViewModel({
  required: ["title", "kinds", "list"],
  optional: ["flash", "listBasePath"],
});
