import { createViewModel } from "../utils/viewModel.js";

// design/mvp-build-plan/SEU Composition.md, 2026-09-07 — Validate Request's
// own liveness output only (owner: "That was supposed to only show the
// liveness of the information"); Compose EBM's own output moved to
// seu_seus_compose.js/compose.ejs.
export const seu_seus_validateVM = createViewModel({
  required: ["title", "objectiveId", "seu"],
  optional: ["flash", "pending", "failed", "failureReason", "passed"]
});
