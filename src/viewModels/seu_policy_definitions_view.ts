import { createViewModel } from "../utils/viewModel.js";

export const seu_policy_definitions_viewVM = createViewModel({
  required: ["title", "policy", "groups", "content", "labels"],
  optional: ["flash", "renderMarkdown"]
});
