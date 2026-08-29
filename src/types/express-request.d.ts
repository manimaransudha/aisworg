// Ambient augmentation for req.vm, set at runtime by middleware/attachVM.js's
// ViewModel Architecture (coding_principles.md). No runtime effect; only makes
// req.vm.req.* / req.vm.opt.* type-check in new TS web controllers.
import "express";

declare module "express-serve-static-core" {
  interface Request {
    vm: {
      req: Record<string, unknown>;
      opt: Record<string, unknown>;
    };
    // CR-076 — set at runtime by middleware/requireTenant.ts. Resolver, not a
    // gate: never denies, just attaches this request's tenant scope so a
    // list route can filter its own DB query with it (owner: "the db level
    // checks are okay" — this only supplies the value that check filters on).
    tenantScope?: { isRoot: boolean; tenantId: string | null };
  }
}
