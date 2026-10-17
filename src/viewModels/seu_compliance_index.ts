import { createViewModel } from "../utils/viewModel.js";

export const seu_compliance_indexVM = createViewModel({
  required: ["title", "seuId", "evaluation", "waivers"],
  optional: ["flash"]
});
