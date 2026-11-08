import type { Request, Response } from "express";

// Handler for API routes that are unused and untested, and so considered not implemented.
// Their route_authority rows are removed, so routeAuthorityGate denies the request first. This answers where the gate lets a request through.
export function notImplemented(_req: Request, res: Response): void {
  res.status(501).json({ error: "Not implemented" });
}
