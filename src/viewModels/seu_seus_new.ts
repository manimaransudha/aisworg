import { createViewModel } from "../utils/viewModel.js";

export const seu_seus_newVM = createViewModel({
  required: ["title"],
  optional: ["flash", "fromObjective", "commissionableObjectives"]
});
