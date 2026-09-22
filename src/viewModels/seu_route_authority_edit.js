import { createViewModel } from "../utils/viewModel.js";

// `row` is null on the "new" form, the existing RouteAuthorityRow on edit.
export const seu_route_authority_editVM = createViewModel({
  required: ["title", "row", "badgeCodes", "roleCodes"],
  optional: ["flash"],
});
