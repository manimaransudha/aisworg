import { createViewModel } from "../utils/viewModel.js";

export const seu_seus_validateVM = createViewModel({
  required: ["title", "objectiveId", "seu"],
  optional: ["flash", "pending", "failed", "failureReason", "passed"]
});
