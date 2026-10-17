import { createViewModel } from "../utils/viewModel.js";

export const seu_objectives_detailVM = createViewModel({
  required: ["title", "detail"],
  optional: ["flash"]
});
