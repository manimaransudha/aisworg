import { createViewModel } from "../utils/viewModel.js";

export const seu_docs_browseVM = createViewModel({
  required: ["title", "breadcrumb"],
  optional: ["folders", "files", "html"],
});
