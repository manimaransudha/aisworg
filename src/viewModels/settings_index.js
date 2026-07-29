import { createViewModel } from "../utils/viewModel.js";

export const settings_indexVM = createViewModel({
  required: ["title", "grouped"],
  optional: ["flash", "saved", "error"]
});
