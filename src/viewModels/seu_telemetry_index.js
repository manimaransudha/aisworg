import { createViewModel } from "../utils/viewModel.js";

export const seu_telemetry_indexVM = createViewModel({
  required: ["title", "flowMetrics", "governanceMetrics"],
  optional: ["flash"]
});
