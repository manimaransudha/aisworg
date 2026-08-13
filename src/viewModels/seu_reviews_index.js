import { createViewModel } from "../utils/viewModel.js";

export const seu_reviews_indexVM = createViewModel({
  required: ["title", "seuId", "list", "deliverables"],
  optional: ["flash", "listBasePath"]
});
