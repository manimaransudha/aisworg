
import { createViewModel } from "../utils/viewModel.js";

export const auth_loginVM = createViewModel({
    required: ["title"],
    optional: ["error", "flash"]
});
