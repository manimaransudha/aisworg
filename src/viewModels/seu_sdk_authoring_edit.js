import { createViewModel } from "../utils/viewModel.js";

export const seu_sdk_authoring_editVM = createViewModel({
  required: ["title", "kindLabel", "slug", "draft", "groups", "contentJson", "canEdit", "canPublish", "nextState", "nextVerb"],
  optional: ["flash", "errors", "referentialOptions", "packDependencyOptions", "producingCapabilityPacks", "deliverableLabels", "requiredCapabilityNames", "capabilityCoverageGaps", "capabilityCoverageExcess", "templateOptions", "ontologyOptions", "contributionHelp", "verifiableFieldHelp", "possibleNextStates", "checklistOptions", "policyOptions", "packComments", "packCodeVersions"],
});
