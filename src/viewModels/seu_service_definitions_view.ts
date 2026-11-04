import { createViewModel } from "../utils/viewModel.js";

export const seu_service_definitions_viewVM = createViewModel({
  required: ["title", "service", "capability", "labels"],
  optional: ["flash", "deliverableIds"]
});
