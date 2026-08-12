import { createViewModel } from "../utils/viewModel.js";

export const seu_reviews_indexVM = createViewModel({
  required: ["title", "seuId", "reviews", "deliverables"],
  optional: ["flash"]
});
