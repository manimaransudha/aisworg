import { createViewModel } from "../utils/viewModel.js";

export const seu_sdk_schema_registry_detailVM = createViewModel({
  required: ["title", "schema"],
  optional: ["flash"],
});
