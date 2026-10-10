import "express";

declare module "express-serve-static-core" {
  interface Request {
    vm: {
      req: Record<string, unknown>;
      opt: Record<string, unknown>;
    };
    tenantScope?: { isRoot: boolean; tenantId: string | null };
  }
}
