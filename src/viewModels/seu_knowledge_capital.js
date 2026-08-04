import { createViewModel } from "../utils/viewModel.js";

export const seu_knowledge_capitalVM = createViewModel({
  required: ["title", "engineeringCapital"],
  optional: ["flash"]
});
