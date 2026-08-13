import { createViewModel } from "../utils/viewModel.js";

// CR-006 Stage 1b — the noun × verb authority surface (Work outcome / Work
// process / Mapping tabs). `list` is the active tab's paginated ListResult;
// `activeTab` selects which columns render.
export const seu_sdk_authority_indexVM = createViewModel({
  required: ["title", "activeTab", "tabLabel", "list", "listBasePath"],
  optional: ["flash", "canWrite", "activeNouns", "activeVerbs"],
});
