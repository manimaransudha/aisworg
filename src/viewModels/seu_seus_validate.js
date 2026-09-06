import { createViewModel } from "../utils/viewModel.js";

// CR-092 Part 6 — the "Queue to validate" report page (owner: "The
// validation view/form is what should show all the conflicting packs /
// parameters / instructions"). objectiveId/selections/compositionReport are
// always set by the GET route (stashed by the validate-commission POST,
// core/web/objectives.ts) before this view ever renders.
export const seu_seus_validateVM = createViewModel({
  required: ["title", "objectiveId", "selections", "compositionReport"],
  optional: ["flash"]
});
