import { createViewModel } from "../utils/viewModel.js";

export const seu_sdk_schema_registry_reviewVM = createViewModel({
  required: ["title", "entityKind", "schemaJson", "report"],
  optional: ["flash"],
});
