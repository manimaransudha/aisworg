import { createViewModel } from "../utils/viewModel.js";

export const seu_seus_graphVM = createViewModel({
  required: ["title", "seuId", "dataUrl", "seuPageUrl"],
  optional: ["flash"]
});
