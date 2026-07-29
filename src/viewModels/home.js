
import { createViewModel } from "../utils/viewModel.js";

export const homeVM = createViewModel({
    required: ["title"],
    optional: ["flash"]
});
