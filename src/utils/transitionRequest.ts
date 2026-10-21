import type { Request, Response } from "express";

/**
 * Reads `targetState` from a transition request body. When it is missing or blank,
 * responds 400 and returns null; the caller returns without further response.
 */
export function readTargetState(req: Request, res: Response): string | null {
  const { targetState } = req.body ?? {};
  if (typeof targetState !== "string" || !targetState.trim()) {
    res.status(400).json({ error: "targetState is required" });
    return null;
  }
  return targetState;
}
