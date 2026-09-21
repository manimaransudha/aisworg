
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { attachVM } from "../../middleware/attachVM.js";
import { requireRole } from "../../middleware/auth.js";
import { renderView } from "../../utils/viewModel.js";
import { getFlash } from "../../utils/flash.js";
// import { isConnectionError } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { parseListParams, paginateList } from "../../utils/listQuery.js";
import { appConfig } from "../../config/appconfig.js";
// import { redirects } from "../../middleware/redirects.js";
import { getArchitectureLayers, getDashboardCounts } from "../seu/core/dashboard.js";
import { getSeuQuickview } from "../seu/core/seus.js";
import { getParticipantHomeView, completeMyWorkItem, raiseMyObligation } from "../seu/core/participantHome.js";
import { flashError, flashSuccess } from "../../utils/flash.js";
import { listConceptsForType } from "../seu/core/ontology.js";

/** GET / — the SEU Commissioning Platform's home page: the architecture layers + live counts. */
router.get("/", requireRole('general'), attachVM("seu/dashboard"), async (req, res, next) => {
  try {
    const [layers, counts] = await Promise.all([getArchitectureLayers(), getDashboardCounts()]);
    req.vm.req.title = "SEU Platform";
    req.vm.req.layers = layers;
    req.vm.req.counts = counts;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/dashboard", req.vm);
  } catch (err) {
    logger.error("[Home] GET / error:", err);
    next(err);
  }
});

/** GET /settings — display app settings */
router.get("/settings", requireRole('super'), attachVM("settings/index"), async (req, res, next) => {
  try {
    const configData = await appConfig.getAll();

    // Group configs by category
    const grouped = {};
    for (const row of configData) {
      if (!grouped[row.category]) {
        grouped[row.category] = [];
      }
      grouped[row.category].push(row);
    }

    req.vm.req.title = "App Settings";
    req.vm.req.grouped = grouped;
    req.vm.opt.saved = req.session?.flash?.saved || null;
    req.vm.opt.error = req.session?.flash?.error || null;
    if (req.session?.flash) {
      delete req.session.flash;
    }

    return renderView(req, res, "settings/index", req.vm);
  } catch (err) {
    logger.error("[Settings] GET error:", err);
    next(err);
  }
});

/** POST /settings/:key — update a setting */
router.post("/settings/:key", requireRole('super'), async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      if (!req.session.flash) req.session.flash = {};
      req.session.flash.error = "Value is required.";
      return res.redirect("/aisworg/settings");
    }

    await appConfig.set(key, value);
    await appConfig.reload();

    if (!req.session.flash) req.session.flash = {};
    req.session.flash.saved = key;
    return res.redirect("/aisworg/settings");
  } catch (err) {
    logger.error(`[Settings] POST error for key=${req.params.key}:`, err);
    if (!req.session.flash) req.session.flash = {};
    req.session.flash.error = err.message;
    return res.redirect("/aisworg/settings");
  }
});

/** GET /quickview — post-login landing. CR-103: what's shown depends on the
 * viewer's own users.role — for 'general' this is their own Participant home
 * (their participants_master identity + every SEU they're a Participant on,
 * scoped to their own work); every other role keeps the original
 * "Commissioned SEUs" progress list. */
router.get("/quickview", requireRole('general'), attachVM("quickview/index"), async (req, res, next) => {
  try {
    if (req.session?.user?.role === "general") {
      req.vm.req.title = "My Work";
      req.vm.req.participantHome = await getParticipantHomeView(req.session.user.id);
      // Owner: "In the UI are the entities dropdown tied to ontology?" — the
      // Raise Obligation form's Category/Severity options were a hardcoded
      // array; category:obligation and category:obligation-severity are
      // both real, live Ontology concept types (same ones the SDK authoring
      // form already uses for Pack-side Obligation Definitions).
      const isRoot = (req.session.user.platformBadges ?? []).includes("root");
      const tenantId = req.session.user.tenant_id ?? null;
      const [obligationCategories, obligationSeverities] = await Promise.all([
        listConceptsForType("category:obligation", { isRoot, tenantId }, false),
        listConceptsForType("category:obligation-severity", { isRoot, tenantId }, false),
      ]);
      req.vm.req.obligationCategoryOptions = [...new Set(obligationCategories.map((c) => c.code))].sort();
      req.vm.req.obligationSeverityOptions = [...new Set(obligationSeverities.map((c) => c.code))].sort();
      req.vm.opt.flash = getFlash(req);
      return renderView(req, res, "quickview/participant", req.vm);
    }

    req.vm.req.title = "Commissioned SEUs";
    const seus = await getSeuQuickview();
    const params = parseListParams(req.query, { sortable: ["objective", "state", "created"], defaultSort: "created", defaultDir: "desc" });
    req.vm.req.list = paginateList(seus, params, {
      searchFields: [(s) => s.objectiveStatement, (s) => s.lifecycleState],
      sortFields: { objective: (s) => s.objectiveStatement, state: (s) => s.lifecycleState, created: (s) => s.createdAt },
    });
    req.vm.opt.listBasePath = "/aisworg/quickview";
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "quickview/index", req.vm);
  } catch (err) {
    logger.error("[QuickView] GET error:", err);
    next(err);
  }
});

/** POST /quickview/work-items/:workItemId/complete — CR-109 Build Plan §7:
 * a Participant reports a result on their OWN Work Item, from their own "My
 * Work" page. Ownership is re-checked inside completeMyWorkItem (core/
 * participantHome.js) against the caller's own participants_master identity
 * — never trusted off the form alone. */
router.post("/quickview/work-items/:workItemId/complete", requireRole('general'), async (req, res) => {
  const backTo = "/aisworg/quickview";
  const { outcome, reference } = req.body ?? {};
  if (typeof outcome !== "string" || !["done", "failed", "blocked"].includes(outcome)) {
    return flashError(req, res, backTo, "Outcome must be done, failed or blocked.");
  }
  try {
    const result = await completeMyWorkItem({
      userId: req.session.user.id,
      workItemId: String(req.params.workItemId),
      outcome,
      reference: typeof reference === "string" && reference.trim() !== "" ? reference : null,
    });
    if (!result.ok) {
      return flashError(req, res, backTo, `Could not record result: ${result.detail}`);
    }
    if (result.outcome === "done") {
      return flashSuccess(req, res, backTo, `Result recorded — Deliverable moved "${result.appliedTransition.fromState}" → "${result.appliedTransition.toState}".`);
    }
    return flashSuccess(req, res, backTo, `Reported "${result.outcome}" — the transition was not applied and an Attention Item was raised.`);
  } catch (err) {
    logger.error("[QuickView] POST work-item complete error:", err);
    return flashError(req, res, backTo, err.message);
  }
});

/** POST /quickview/seus/:seuId/obligations — owner: "Remove the add form on
 * the SEU detail page. The Participant should have an Obligation form...
 * the obligation has to be on the SEU that the participant is assigned to,
 * on a deliverable within the SEU." Ownership (this Deliverable is actually
 * assigned to the caller's own Participant engagement on this SEU) is
 * re-checked inside raiseMyObligation (core/participantHome.js), same
 * discipline as the Work Item completion route above — never trusted off
 * the form alone. */
router.post("/quickview/seus/:seuId/obligations", requireRole('general'), async (req, res) => {
  const backTo = "/aisworg/quickview";
  const { deliverableId, category, title, description, severity, completionCriteria } = req.body ?? {};
  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return flashError(req, res, backTo, "Deliverable, category and title are required.");
  }
  try {
    const result = await raiseMyObligation({
      userId: req.session.user.id,
      seuId: String(req.params.seuId),
      deliverableId,
      category,
      title,
      description,
      severity,
      completionCriteria,
    });
    if (!result.ok) {
      return flashError(req, res, backTo, result.detail);
    }
    return flashSuccess(req, res, backTo, `Obligation "${result.obligation.title}" created (${result.obligation.category}, ${result.obligation.severity}).`);
  } catch (err) {
    logger.error("[QuickView] POST obligations error:", err);
    return flashError(req, res, backTo, err.message);
  }
});

export { router };
