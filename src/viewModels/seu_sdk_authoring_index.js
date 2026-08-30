import { createViewModel } from "../utils/viewModel.js";

// Entity-direct authoring (bug fix correcting CR-014): "sessions" (Deliverable
// authoring sessions) was replaced by per-verb "tabs", which the owner's own
// "similar to Objectives" redesign then replaced again — one flat `rows` list
// of the viewer's own authored rows (any status), each carrying whatever
// governed-transition action buttons the viewer currently holds the badge
// for (rows[].actions) — see web/sdkAuthoring.ts's myAuthoredRowsWithActions
// and core/sdkAuthoring.ts's computeRowActions.
export const seu_sdk_authoring_indexVM = createViewModel({
  required: ["title", "kindLabel", "slug", "showDrafts", "rows", "canCreate"],
  optional: ["flash", "definitions", "listBasePath", "canWriteAuthority", "activeNouns", "mappingByNoun"],
});
