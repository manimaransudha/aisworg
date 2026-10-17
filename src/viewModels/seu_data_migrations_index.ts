import { createViewModel } from "../utils/viewModel.js";

export const seu_data_migrations_indexVM = createViewModel({
  required: ["title", "list"],
  optional: ["flash"]
});
