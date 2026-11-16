import { createViewModel } from "../utils/viewModel.js";

export const seu_quality_gate_definitions_viewVM = createViewModel({
  required: ["title", "qualityGate", "labels"],
  optional: ["flash"]
});
