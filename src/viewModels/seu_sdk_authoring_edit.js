import { createViewModel } from "../utils/viewModel.js";

// Entity-direct authoring (bug fix correcting CR-014): "deliverable" is
// replaced by "draft" (the entity's own Draft row, or null in "new" mode);
// "canApprove" is dropped — there is no separate review step. "canPublish" now
// means "can run the NEXT single hop" (not always the same verb — separation
// of duties, one verb-holder per hop), and "nextState" names that hop's target
// so the button can say what it's actually about to do. UI redesign (owner:
// "extremely unfriendly"): "fields" (one flat list) is replaced by "groups"
// (Identity/Metadata, Compatibility, Dependencies, Contributions) — see
// formGenerator.groupFieldsForDisplay.
export const seu_sdk_authoring_editVM = createViewModel({
  required: ["title", "kindLabel", "slug", "draft", "groups", "contentJson", "canEdit", "canPublish", "nextState", "nextVerb"],
  optional: ["flash", "errors", "referentialOptions", "packDependencyOptions", "contributionHelp", "verifiableFieldHelp"],
});
