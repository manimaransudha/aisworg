import { createViewModel } from "../utils/viewModel.js";

export const seu_seus_indexVM = createViewModel({
  required: ["title", "list"],
  optional: ["flash", "listBasePath"]
});
