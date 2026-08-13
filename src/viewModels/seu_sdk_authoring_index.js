import { createViewModel } from "../utils/viewModel.js";

export const seu_sdk_authoring_indexVM = createViewModel({
  required: ["title", "kindLabel", "slug", "sessions", "canCreate"],
  optional: ["flash", "definitions", "listBasePath", "canWriteAuthority", "activeNouns", "mappingByNoun"],
});
