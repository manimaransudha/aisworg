import { createViewModel } from "../utils/viewModel.js";

export const seu_docs_indexVM = createViewModel({
  required: ["title", "folders"],
  optional: [],
});
