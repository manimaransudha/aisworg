import { createViewModel } from "../utils/viewModel.js";

export const seu_sdk_authority_indexVM = createViewModel({
  required: ["title", "activeTab", "tabLabel", "list", "listBasePath"],
  optional: ["flash", "canWrite", "activeNouns", "activeVerbs"],
});
