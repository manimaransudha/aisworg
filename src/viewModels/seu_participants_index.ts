import { createViewModel } from "../utils/viewModel.js";

export const seu_participants_indexVM = createViewModel({
  required: ["title", "list"],
  optional: ["flash", "listBasePath", "participantTypes", "activeType", "tenantNameById"]
});
