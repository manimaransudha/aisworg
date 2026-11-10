import { createViewModel } from "../utils/viewModel.js";

export const seu_profiles_viewVM = createViewModel({
  required: ["title", "profile", "groups", "content", "labels", "refs", "parameterSources", "parameterCapabilities", "parameters"],
  optional: ["flash"]
});
