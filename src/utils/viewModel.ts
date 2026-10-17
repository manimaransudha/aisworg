import type { Request, Response } from "express";
import { logger } from "./logger.js";

export function createViewModel(config: { required?: string[]; optional?: string[] }) {
  const { required = [], optional = [] } = config;

  return function validate(data: Record<string, unknown>) {
    const missing = required.filter((key: string) => !(key in data));

    if (missing.length > 0) {
      throw new Error(
        `Missing required ViewModel keys: ${missing.join(", ")}`
      );
    }

    return data;
  };
}

export function renderView(req: Request, res: Response, viewPath: string, viewModel: object) {
  try {
    const start = Date.now();
    res.render(viewPath, viewModel);
    logger.debug(`[ViewModel] Render ${viewPath} took ${Date.now() - start}ms`);
  } catch (error) {
    logger.error(`Error rendering view ${viewPath}:`, error);
    res.status(500).send("Error rendering page");
  }
}
