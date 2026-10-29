import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { redirects } from "../../../middleware/redirects.js";
import { emailService } from "../../../domain/auth/emailService.js";
import { logger } from "../../../utils/logger.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { requireTenantScope } from "../../../middleware/requireTenantScope.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { DEMO_TENANT_NAME, DEMO_AREAS } from "../../../dblayer/constants.js";
import type { TenantRow } from "../../../dblayer/seuTypes.js";
import { getDemoActor } from "../../../dblayer/seed/demo/demoBadges.js";
import { listAllScenarios, listPlaybooks, runScenario, setScenarioEnabled, stepPlaybook, resetDemo } from "../core/demoSimulator.js";

// Every demo route is reachable only from the Demo tenant (root is always in reach).
const demoTenantOnly = requireTenantScope.forParam<TenantRow>("demo", () => tenantsDB.findByName(DEMO_TENANT_NAME), (tenant) => tenant.id);
router.use("/demo", (req: Request, res: Response, next: NextFunction) => {
  void demoTenantOnly(req, res, next, "demo");
});

const landingPath = "/aisworg/seu/demo";
const rootPath = "/aisworg/seu/demo/root";

async function renderDemo(req: Request, res: Response, next: NextFunction, root: boolean): Promise<void> {
  try {
    const { tenantId } = await getDemoActor();
    const area = DEMO_AREAS.find((a) => a === req.query.category) ?? DEMO_AREAS[0];
    const catalogue = await listAllScenarios(tenantId);
    const scenarios = (root ? catalogue : catalogue.filter((s) => s.enabled)).filter((s) => s.area === area);
    const byCode = new Map(catalogue.map((s) => [s.code, s]));
    const basePath = root ? rootPath : landingPath;
    const params = parseListParams(req.query, { sortable: ["sortOrder", "code", "kind", "title", "severity"], defaultSort: "sortOrder", defaultDir: "asc" });
    req.vm.req.title = root ? "Demo Root" : "Demo";
    req.vm.req.root = root;
    req.vm.req.playbooks = (await listPlaybooks(tenantId)).filter((p) => p.area === area).map((p) => ({
      code: p.code,
      title: p.title,
      progress: p.progress,
      steps: p.steps.map((code) => byCode.get(code)).filter((s): s is NonNullable<typeof s> => !!s).map((s) => ({ title: s.title, annotation: s.annotation })),
    }));
    req.vm.req.areas = DEMO_AREAS;
    req.vm.req.area = area;
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
    req.vm.req.list.category = area;
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
  const base = req.body?.from === "root" ? rootPath : landingPath;
  const area = DEMO_AREAS.find((a) => a === req.body?.category);
  return area ? `${base}?category=${area}` : base;
}

router.post("/demo/reset", async (req: Request, res: Response) => {
  const backTo = backFor(req);
  try {
    await resetDemo();
    return redirects.seu.demo.success(req, res, "Demo data was reset to the seeded base state.", backTo);
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/reset error", err as Error);
    return redirects.seu.demo.error(req, res, `Reset failed: ${(err as Error).message}`, backTo);
  }
});

router.post("/demo/contact", async (req: Request, res: Response) => {
  const backTo = backFor(req);
  try {
    const message = String(req.body?.message ?? "").trim();
    if (!message) return redirects.seu.demo.error(req, res, "Enter a message before sending.", backTo);
    const to = (process.env.SUPERUSER_EMAIL || "").split(",").map((e) => e.trim()).filter(Boolean);
    if (to.length === 0) throw new Error("No superuser email is configured.");
    const user = req.session.user;
    await emailService.sendDemoContact({ to, fromName: user.name ?? "", fromEmail: user.email, message });
    return redirects.seu.demo.success(req, res, "Thank you. We will be in touch.", backTo);
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/contact error", err as Error);
    return redirects.seu.demo.error(req, res, `Message could not be sent: ${(err as Error).message}`, backTo);
  }
});

router.post("/demo/scenarios/:code/run", async (req: Request, res: Response) => {
  const backTo = backFor(req);
  const result = await runScenario(String(req.params.code), { allowDisabled: backTo.startsWith(rootPath) });
  return result.ok ? redirects.seu.demo.success(req, res, result.message, backTo) : redirects.seu.demo.error(req, res, result.message, backTo);
});

router.post("/demo/playbooks/:code/step", async (req: Request, res: Response) => {
  const backTo = backFor(req);
  try {
    const result = await stepPlaybook(String(req.params.code));
    return result.ok ? redirects.seu.demo.success(req, res, result.finished ? `${result.message} All steps are done.` : result.message, backTo) : redirects.seu.demo.error(req, res, result.message, backTo);
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/playbooks/:code/step error", err as Error);
    return redirects.seu.demo.error(req, res, (err as Error).message, backTo);
  }
});

router.post("/demo/root/scenarios/:code/enabled", async (req: Request, res: Response) => {
  try {
    await setScenarioEnabled(String(req.params.code), req.body?.enabled === "true");
    return redirects.seu.demoRootScenariosEnabled.success(req, res, `Scenario "${String(req.params.code)}" ${req.body?.enabled === "true" ? "enabled" : "disabled"}.`);
  } catch (err) {
    logger.error("[web/seu/demo] POST /demo/root/scenarios/:code/enabled error", err as Error);
    return redirects.seu.demoRootScenariosEnabled.error(req, res, (err as Error).message);
  }
});

export { router };
