import { logger } from "./logger.js";

export function createViewModel(config) {
  const { required = [], optional = [] } = config;

  return function validate(data) {
    const missing = required.filter((key) => !(key in data));

    if (missing.length > 0) {
      throw new Error(
        `Missing required ViewModel keys: ${missing.join(", ")}`
      );
    }

    return data;
  };
}

export function renderView(req, res, viewPath, viewModel) {
  try {
    const start = Date.now();
    res.render(viewPath, viewModel);
    logger.debug(`[ViewModel] Render ${viewPath} took ${Date.now() - start}ms`);
  } catch (error) {
    logger.error(`Error rendering view ${viewPath}:`, error);
    res.status(500).send("Error rendering page");
  }
}
