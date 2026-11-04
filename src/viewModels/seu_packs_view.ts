import { createViewModel } from "../utils/viewModel.js";

export const seu_packs_viewVM = createViewModel({
  required: ["title", "pack", "groups", "content", "labels", "refs", "policies"],
  optional: ["flash", "renderMarkdown"]
});
