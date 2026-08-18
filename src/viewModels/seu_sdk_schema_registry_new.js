import { createViewModel } from "../utils/viewModel.js";

// CR-017 — the form-based schema authoring page. `fields` is a generateFields()
// result over the meta-schema (entityKind + the field list).
export const seu_sdk_schema_registry_newVM = createViewModel({
  required: ["title", "fields"],
  optional: ["flash"]
});
