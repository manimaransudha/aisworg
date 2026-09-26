import { createViewModel } from "../utils/viewModel.js";

// CR-113 item 6 — the Ontology Approvals tab: every Draft concept, across
// every concept_type, one flat searchable/sortable/paginated table (same
// list convention every other admin table in this app uses), gated on
// ontology_approve via route_authority. Accept/Reject are the tab's own two
// outcomes of the same process — no separate reject badge.
export const seu_sdk_ontology_approvalsVM = createViewModel({
  required: ["title", "list", "listBasePath"],
  optional: ["flash"],
});
