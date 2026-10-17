import { createViewModel } from "../utils/viewModel.js";

export const seu_route_authority_editVM = createViewModel({
  required: ["title", "row", "badgeCodes", "roleCodes"],
  optional: ["flash"],
});
