import type { Request, Response } from "express";

export function flashError(req: Request, res: Response, redirectPath: string, message: string) {
  req.session.flash = { type: "error", message };
  res.redirect(redirectPath);
}

export function flashSuccess(req: Request, res: Response, redirectPath: string, message: string) {
  req.session.flash = { type: "success", message };
  res.redirect(redirectPath);
}

export function getFlash(req: Request) {
  const flash = req.session.flash || null;
  delete req.session.flash;
  return flash;
}

export function stashFormInput(req: Request, data: Record<string, unknown>) {
  req.session.formInput = data;
}

export function takeFormInput(req: Request): Record<string, unknown> | null {
  const data = req.session.formInput || null;
  delete req.session.formInput;
  return data;
}
