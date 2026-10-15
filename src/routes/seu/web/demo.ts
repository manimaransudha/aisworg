import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { readFileSync } from "node:fs";
import path from "node:path";
import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { renderMarkdown } from "../../../domain/sdk/markdownRender.js";
import { requireTenantScope } from "../../../middleware/requireTenantScope.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { DEMO_TENANT_NAME } from "../../../dblayer/constants.js";
import type { TenantRow } from "../../../dblayer/seuTypes.js";
import { getDemoActor } from "../../../dblayer/seed/demo/demoBadges.js";
import { listAllScenarios, listAllowedScenarios, listPlaybooks, runScenario, setScenarioEnabled, stepPlaybook, resetDemo } from "../core/demoSimulator.js";

// Every demo route is reachable only from the Demo tenant (root is always in reach).
const demoTenantOnly = requireTenantScope.forParam<TenantRow>("demo", () => tenantsDB.findByName(DEMO_TENANT_NAME), (tenant) => tenant.id, { notFoundRedirect: "/aisworg/seu" });
router.use("/demo", (req: Request, res: Response, next: NextFunction) => {
  void demoTenantOnly(req, res, next, "demo");
});

const landingPath = "/aisworg/seu/demo";
const rootPath = "/aisworg/seu/demo/root";

async function renderDemo(req: Request, res: Response, next: NextFunction, root: boolean): Promise<void> {
  try {
    const { tenantId } = await getDemoActor();
    const scenarios = root ? await listAllScenarios(tenantId) : await listAllowedScenarios(tenantId);
    const basePath = root ? rootPath : landingPath;
    const params = parseListParams(req.query, { sortable: ["sortOrder", "code", "kind", "title", "severity"], defaultSort: "sortOrder", defaultDir: "asc" });
    req.vm.req.title = root ? "Demo Root" : "Demo";
    req.vm.req.root = root;
    req.vm.req.about = renderMarkdown(readFileSync(path.join(process.cwd(), "src", "dry-run-suite", "demoLanding.md"), "utf8"));
    req.vm.req.playbooks = await listPlaybooks(tenantId);
    req.vm.req.list = paginateList(scenarios, params, {
      searchFields: [(s) => s.code, (s) => s.title, (s) => s.kind, (s) => s.description],
      sortFields: {
        sortOrder: (s) => s.sort_order,
        code: (s) => s.code,
        kind: (s) => s.kind,
        title: (s) => s.title,
        severity: (s) => s.severity,
      },
    });
    req.vm.opt.listBasePath = basePath;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/demo/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/demo] GET error", err as Error);
    next(err);
  }
}

router.get("/demo", attachVM("seu/demo/index"), (req: Request, res: Response, next: NextFunction) => renderDemo(req, res, next, false));
router.get("/demo/root", attachVM("seu/demo/index"), (req: Request, res: Response, next: NextFunction) => renderDemo(req, res, next, true));

function backFor(req: Request): string {
  return req.body?.from === "root" ? rootPath : landingPath;
}

router.post("/demo/reset", async (req: Request, res: Response) => {
  const backTo = backFor(req);
  try {
    await resetDemo();
    return flashSuccess(req, res, backTo, "Demo data was reset to the seeded base state.");
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/reset error", err as Error);
    return flashError(req, res, backTo, `Reset failed: ${(err as Error).message}`);
  }
});

router.post("/demo/scenarios/:code/run", async (req: Request, res: Response) => {
  const backTo = backFor(req);
  const result = await runScenario(String(req.params.code), { allowDisabled: backTo === rootPath });
  return result.ok ? flashSuccess(req, res, backTo, result.message) : flashError(req, res, backTo, result.message);
});

router.post("/demo/playbooks/:code/step", async (req: Request, res: Response) => {
  const backTo = backFor(req);
  try {
    const index = Number.parseInt(String(req.body?.index ?? "0"), 10);
    const result = await stepPlaybook(String(req.params.code), Number.isFinite(index) && index >= 0 ? index : 0);
    const progress = result.nextIndex === null ? "Playbook finished." : `Next step is ${result.nextIndex + 1}.`;
    return result.ok ? flashSuccess(req, res, backTo, `${result.message} ${progress}`) : flashError(req, res, backTo, result.message);
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/playbooks/:code/step error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/demo/root/scenarios/:code/enabled", async (req: Request, res: Response) => {
  try {
    await setScenarioEnabled(String(req.params.code), req.body?.enabled === "true");
    return flashSuccess(req, res, rootPath, `Scenario "${String(req.params.code)}" ${req.body?.enabled === "true" ? "enabled" : "disabled"}.`);
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/root/scenarios/:code/enabled error", err as Error);
    return flashError(req, res, rootPath, (err as Error).message);
  }
});

export { router };
