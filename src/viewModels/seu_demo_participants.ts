import { createViewModel } from "../utils/viewModel.js";

export const seu_demo_participantsVM = createViewModel({
  required: ["title", "list"],
  optional: ["flash", "listBasePath", "participantHome", "actionBase", "obligationCategoryOptions", "obligationSeverityOptions"]
});
