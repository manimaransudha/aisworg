import { createViewModel } from "../utils/viewModel.js";

export const seu_templates_viewVM = createViewModel({
  required: ["title", "template", "groups", "content", "labels", "refs", "parameterSources"],
  optional: ["flash", "graph"]
});
