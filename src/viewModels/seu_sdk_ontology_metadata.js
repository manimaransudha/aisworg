import { createViewModel } from "../utils/viewModel.js";

// Ontology Metadata (Ch.18/CR-096 follow-up) — a dedicated page for
// text_type/ui_grouping, separate from the concept-browsing tabs (owner:
// editing per-category risked the same group drifting to conflicting
// labels). `list`/`listBasePath`: every ui_grouping-bearing concept as one
// flat, searchable/sortable/paginated table — same list convention every
// other admin table in this app uses (parseListParams/paginateList/
// listControls/sortLink), not a bespoke one-off. `conceptTypes`/
// `conceptsByType`: the page's own (concept type -> codes) picker data for
// the "set metadata" form.
export const seu_sdk_ontology_metadataVM = createViewModel({
  required: ["title", "list", "listBasePath", "conceptTypes"],
  optional: ["conceptsByType", "existingGroupLabels", "isRoot", "defaultTenantId", "flash"],
});
