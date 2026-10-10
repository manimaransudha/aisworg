import type { Request } from "express";

export function safeBack(req: Request, fallback = "/aisworg"): string {
  const ref = req.headers.referer;
  if (!ref) return fallback;
  try {
    const base = `${req.protocol}://${req.headers.host ?? "localhost"}`;
    const refPath = new URL(ref, base).pathname;
    const curPath = new URL(req.originalUrl, base).pathname;
    return refPath === curPath ? fallback : ref;
  } catch {
    return fallback;
  }
}
