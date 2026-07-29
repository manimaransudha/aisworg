import { flashError, flashSuccess } from "../utils/flash.js";

export const redirects = {
  dashboard: {
    error: (req, res, msg) => flashError(req, res, "/aisworg", msg),
    success: (req, res, msg) => flashSuccess(req, res, "/aisworg", msg),
  },
  stocks: {
    error: (req, res, msg) => flashError(req, res, "/aisworg/stocks", msg),
    success: (req, res, msg) => flashSuccess(req, res, "/aisworg/stocks", msg),
  },
};
