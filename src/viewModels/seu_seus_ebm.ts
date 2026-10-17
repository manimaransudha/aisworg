import { createViewModel } from "../utils/viewModel.js";

export const seu_seus_ebmVM = createViewModel({
  required: ["title", "ebmView"],
  optional: ["flash"]
});
