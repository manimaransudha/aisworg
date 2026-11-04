import { createViewModel } from "../utils/viewModel.js";

export const seu_demo_indexVM = createViewModel({
  required: ["title", "list", "scenarios", "areaContent", "root", "areas", "area"],
  optional: ["flash", "listBasePath", "kinds", "noteKind", "stepsTab", "stepsTabName", "stepOptions", "renderMarkdown", "renderInlineMarkdown"]
});
