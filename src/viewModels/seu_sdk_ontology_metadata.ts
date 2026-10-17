import { createViewModel } from "../utils/viewModel.js";

export const seu_sdk_ontology_metadataVM = createViewModel({
  required: ["title", "list", "listBasePath", "conceptTypes"],
  optional: ["conceptsByType", "existingGroupLabels", "isRoot", "defaultTenantId", "flash"],
});
