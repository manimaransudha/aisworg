import { createViewModel } from "../utils/viewModel.js";

export const quickview_indexVM = createViewModel({
  required: ["title"],
  // CR-103 — the same GET /quickview route now renders one of two templates
  // depending on the viewer's role: the original "Commissioned SEUs" list
  // (list/listBasePath) for everyone else, or the new Participant home
  // content (participantHome) for role === 'general'. Only "title" is
  // actually required regardless of branch.
  optional: ["flash", "listBasePath", "list", "participantHome"]
});
