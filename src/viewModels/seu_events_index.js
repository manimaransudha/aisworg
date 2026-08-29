import { createViewModel } from "../utils/viewModel.js";

export const seu_events_indexVM = createViewModel({
  required: ["title", "list", "filters"],
  optional: ["flash"]
});
