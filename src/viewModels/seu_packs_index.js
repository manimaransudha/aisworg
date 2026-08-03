import { createViewModel } from "../utils/viewModel.js";

export const seu_packs_indexVM = createViewModel({
  required: ["title", "packs"],
  optional: ["flash"]
});
