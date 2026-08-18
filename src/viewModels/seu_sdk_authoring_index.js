import { createViewModel } from "../utils/viewModel.js";

// Entity-direct authoring (bug fix correcting CR-014): "sessions" (Deliverable
// authoring sessions) is replaced by "tabs" — one per verb the entity's noun
// actually has (data-driven, "however many verbs there are"), each carrying
// its own `rows` (Draft/Validated/Active/… rows currently at that stage,
// scoped to the logged-in actor except the live Active catalog) — see
// web/sdkAuthoring.ts's buildAuthoringTabs.
export const seu_sdk_authoring_indexVM = createViewModel({
  required: ["title", "kindLabel", "slug", "showDrafts", "tabs", "canCreate"],
  optional: ["flash", "definitions", "listBasePath", "canWriteAuthority", "activeNouns", "mappingByNoun"],
});
