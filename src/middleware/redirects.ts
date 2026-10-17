import type { Request, Response } from "express";
import { flashError, flashSuccess } from "../utils/flash.js";

export const redirects = {
  dashboard: {
    error: (req: Request, res: Response, msg: string) => flashError(req, res, "/aisworg", msg),
    success: (req: Request, res: Response, msg: string) => flashSuccess(req, res, "/aisworg", msg),
  },
  stocks: {
    error: (req: Request, res: Response, msg: string) => flashError(req, res, "/aisworg/stocks", msg),
    success: (req: Request, res: Response, msg: string) => flashSuccess(req, res, "/aisworg/stocks", msg),
  },
};
