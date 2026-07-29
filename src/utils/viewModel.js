// src/utils/viewModel.js
import { logger } from "./logger.js";

/**
 * Creates a ViewModel validator
 * @param {Object} config - Configuration with required and optional keys
 * @returns {Function} Validator function
 */
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

/**
 * Renders a view with validated ViewModel
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {string} viewPath - Path to view
 * @param {Object} viewModel - ViewModel data
 */
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
