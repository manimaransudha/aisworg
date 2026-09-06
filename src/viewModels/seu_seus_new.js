import { createViewModel } from "../utils/viewModel.js";

// Bug fix (owner, 2026-09-06: "If the commissioning happens from SEU, then
// Objective also has to be picked") — the old freeform statement/Capability
// checklist (capabilities/statement/selectedCodes) is retired from this
// page entirely; the no-?objectiveId= mode now shows commissionableObjectives
// (a picker over real, already-decomposed Objectives) instead, and the
// ?objectiveId= mode shows fromObjective's own commissioningOptions (a
// capability -> Templates -> Profiles tree), same as before.
export const seu_seus_newVM = createViewModel({
  required: ["title"],
  optional: ["flash", "fromObjective", "commissionableObjectives"]
});
