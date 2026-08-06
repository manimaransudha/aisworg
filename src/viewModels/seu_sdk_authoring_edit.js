import { createViewModel } from "../utils/viewModel.js";

export const seu_sdk_authoring_editVM = createViewModel({
  required: ["title", "kindLabel", "slug", "deliverable", "fields", "contentJson", "canEdit", "canApprove", "canPublish"],
  optional: ["flash", "errors", "referentialOptions"],
});
