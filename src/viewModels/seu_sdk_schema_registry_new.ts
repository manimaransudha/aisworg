import { createViewModel } from "../utils/viewModel.js";

export const seu_sdk_schema_registry_newVM = createViewModel({
  required: ["title", "entityKind", "entityKindLocked", "doc", "topLevelKinds", "itemKinds", "blankWidget", "allKinds"],
  optional: ["flash"]
});
