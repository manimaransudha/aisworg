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
  }
}
