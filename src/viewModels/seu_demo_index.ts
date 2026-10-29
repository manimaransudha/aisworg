import { createViewModel } from "../utils/viewModel.js";

export const seu_demo_indexVM = createViewModel({
  required: ["title", "list", "playbooks", "root", "areas", "area"],
  optional: ["flash", "listBasePath"]
});
