import { createViewModel } from "../utils/viewModel.js";

export const seu_packs_indexVM = createViewModel({
  required: ["title", "list"],
  optional: ["flash", "listBasePath", "categories", "activeCategory", "states", "activeStatus"]
});
