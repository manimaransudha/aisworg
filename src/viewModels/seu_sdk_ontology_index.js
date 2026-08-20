import { createViewModel } from "../utils/viewModel.js";

// Ontology Management (Ch.18) — concept_types as tabs, each tab a paginated
// list of that type's concepts (code/label/status), same shape as the
// Authority nouns/verbs surface it mirrors.
export const seu_sdk_ontology_indexVM = createViewModel({
  required: ["title", "conceptTypes", "activeType", "list", "listBasePath"],
  optional: ["flash", "isRoot"],
});
