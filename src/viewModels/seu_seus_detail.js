import { createViewModel } from "../utils/viewModel.js";

export const seu_seus_detailVM = createViewModel({
  required: ["title", "detail"],
  optional: ["flash"]
});
