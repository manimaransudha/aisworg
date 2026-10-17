import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

interface HttpError extends Error {
  code?: string;
  status?: number;
  statusCode?: number;
}

export function errorHandler(err: HttpError, req: Request, res: Response, _next: NextFunction) {
  if (err.code === 'EBADCSRFTOKEN' || err.status === 403 && err.message === 'invalid csrf token') {
    logger.warn(`[CSRF] token invalid — redirecting to login (${req.method} ${req.path})`);
    return res.redirect('/aisworg/auth/login');
  }

  logger.error(`Error: ${err.message}`, err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
}
