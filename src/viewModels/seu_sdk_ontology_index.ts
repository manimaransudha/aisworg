import { createViewModel } from "../utils/viewModel.js";

export const seu_sdk_ontology_indexVM = createViewModel({
  required: ["title", "conceptTypes", "activeType", "list", "listBasePath"],
  optional: ["flash", "isRoot", "renderMarkdown", "compositionSources", "existingGroupLabels"],
});
