import { createViewModel } from "../utils/viewModel.js";

// CR-114 rewrite — the flat CR-017 `fields` list (generateFields() over the
// meta-schema) was replaced by the recursive widget-tree editor (`doc` +
// its kind lists); this required-key list was never updated to match,
// leaving every render of this page failing attachVM's check.
export const seu_sdk_schema_registry_newVM = createViewModel({
  required: ["title", "entityKind", "entityKindLocked", "doc", "topLevelKinds", "itemKinds", "blankWidget", "allKinds"],
  optional: ["flash"]
});
