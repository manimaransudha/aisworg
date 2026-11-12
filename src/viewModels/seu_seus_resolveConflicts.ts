import { createViewModel } from "../utils/viewModel.js";

export const seu_seus_resolveConflictsVM = createViewModel({
  required: ["title", "objectiveId", "selections", "tabs", "selectedTable", "list", "settledResult", "leftOut"],
  optional: ["flash", "listBasePath", "seuId", "allResolved", "capabilityInfo", "resultColumns", "asTable", "comparedKinds", "resultLinks", "cells"]
});
