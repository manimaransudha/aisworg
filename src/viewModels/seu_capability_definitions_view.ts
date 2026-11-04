import { createViewModel } from "../utils/viewModel.js";

export const seu_capability_definitions_viewVM = createViewModel({
  required: ["title", "capability", "labels"],
  optional: ["flash", "activeServiceId"]
});
