import "dotenv/config";

import { createRequire } from "module";
import { fileURLToPath } from "url";
const require = createRequire(import.meta.url);
const express = require("express");
const session = require("express-session");
const path = require("path");
const cookieParser = require("cookie-parser");



import { logger } from "./utils/logger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { gatekeeper } from "./middleware/gatekeeper.js";
import { buildSessionUser } from "./middleware/auth.js";
import { appConfig } from "./config/appconfig.js";
// import { attachVM } from "./middleware/attachVM.js";
// import { renderView } from "./utils/viewModel.js";
import { configurePassport, passport } from "./domain/auth/passportConfig.js";
import { doubleCsrf } from "csrf-csrf";

import { router as publicRouter } from "./routes/web/public.js";
import { router as authRouter } from "./routes/web/auth.js";
import { router as demoRouter } from "./routes/web/demo.js";
import { router as seuApiRouter } from "./routes/seu/api/index.js";
import { router as seuWebRouter } from "./routes/seu/web/index.js";
import { eventBus } from "./domain/engine/eventBus.js";
import { devActAsAvailable, currentActAs, listTenants, listBadgeTypes, listNounVerbBadgeCodes } from "./dev/actAs.js";
import { userDB } from "./dblayer/userDB.js";
import { ensureBadgeBootstrap, getPlatformBadges } from "./domain/identity/badgeBootstrap.js";
import { getConceptTypeNav } from "./routes/seu/core/ontology.js";
import { resolveNavRouteVisibility } from "./domain/identity/navRouteAccess.js";
import { loadRouteAuthorityCache } from "./domain/identity/routeAuthorityCache.js";
import { routeAuthorityGate } from "./middleware/routeAuthorityGate.js";

// Ch.30 Event Bus redesign — loads event_subscriptions into the in-memory
// routing map once at module load (same unconditional placement the old
// registerAssignmentDelivery() call had, so tests that import `app` directly
// without going through the app.listen() block below still get
// subscriptions loaded, e.g. WorkItemDispatched -> assignmentDelivery).
await eventBus.loadSubscriptions();
await loadRouteAuthorityCache();

const app = express();
const PORT = process.env.PORT || 4800;

app.locals.baseUrl = process.env.BASE_URL || '';

app.set("views", path.join(process.cwd(), "src", "views"));
app.set("view engine", "ejs");

// if (process.env.NODE_ENV !== 'production') {
//     app.use((req, res, next) => {
//         console.log('Incoming path:', req.path, req.url);
//         next();
//     });
// }
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        // console.log('Incoming path:', req.path, req.url);
        logger.debug(`Incoming path: ${req.path} ${req.url}`);
        next();
    });
}

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), "public")));
app.use('/aisworg', express.static(path.join(process.cwd(), "public")));


// Session
const isProd = process.env.NODE_ENV === 'production';
app.use(session({
    secret: process.env.SESSION_SECRET || (() => { throw new Error('SESSION_SECRET env var is not set'); })(),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: isProd, sameSite: isProd ? 'lax' : false, httpOnly: true },
}));

// if (process.env.NODE_ENV !== 'production') {
//     app.use((req, res, next) => {
//         if (req.session && !req.session.user) {
//             req.session.user = {
//                 id: 1,
//                 email: 'manimaransudha@gmail.com',
//                 name: 'Sudha Manimaran',
//                 role: 'super',
//                 is_active: true
//             };
//         }
//         next();
//     });
// }
// Auto-login shim — scoped to NODE_ENV === 'test' only, not the broader
// '!== production' this used to run under. Real dev/local usage now goes
// through actual Google OAuth like production does; this exists purely so
// tests/acceptance.e2e.test.ts and tests/web-flow.e2e.test.ts (14 tests,
// real HTTP requests via fetch-cookie, no scriptable login flow available —
// this platform only supports Google OAuth) can authenticate unattended.
if (process.env.NODE_ENV === 'test') {
    app.use((req, res, next) => {
        const path = req.path;
        const isPublic =
            path === '/favicon.ico' ||
            path.startsWith('/css/') ||
            path.startsWith('/js/') ||
            path.startsWith('/images/') ||
            path.startsWith('/fonts/') ||
            path.startsWith('/aisworg/auth/') ||
            path.startsWith('/aisworg/login') ||
            path.startsWith('/aisworg/logout');

        if (isPublic || !req.session || req.session.user) return next();

        // (owner: "root was used in legacy test suite as we did not build
        // the demarcation between tenants etc.") — root bypasses every
        // tenant/badge check by design, so a suite that only ever logs in as
        // root cannot exercise the real denial paths those checks exist for.
        // An e2e test that needs a genuine, scoped, non-root identity sends
        // this header (its own cookie jar/session, set once before its first
        // request) naming a real seeded user row; everyone else keeps
        // getting the original hardcoded root shim below, unchanged.
        const testUserId = req.headers['x-test-user-id'];
        if (testUserId) {
            (async () => {
                const user = await userDB.findById(Number(testUserId));
                if (!user) return next(new Error(`x-test-user-id ${testUserId}: no such user`));
                req.session.user = buildSessionUser(user);
                await ensureBadgeBootstrap(user);
                req.session.user.platformBadges = await getPlatformBadges(String(user.id));
                next();
            })().catch(next);
            return;
        }

        req.session.user = {
            id: 1,
            email: 'manimaransudha@gmail.com',
            name: 'Sudha Manimaran',
            role: 'super',
            is_active: true,
            // Phase 10 (badge model): this shim bypasses the real login
            // flow entirely, so ensureBadgeBootstrap/getPlatformBadges
            // (routes/web/auth.js) never run for it. Hardcoded here to
            // match the root badge_grants row 012_badge_model.sql seeds
            // for this same fixed dev identity (holder_id '1') — without
            // this, requirePlatformBadge('root') denies every request
            // from this identity silently (no flash message, redirects
            // back to referer), which looks like "nothing happens" on
            // click rather than an actual permission error.
            platformBadges: ['root'],
            // CR-004: the shim identity is the platform (root) user.
            type: 'Platform',
            tenant_id: null

        };
        next();
    });
}

// Trust nginx reverse proxy (needed for secure cookies and correct IP logging)
if (isProd) app.set('trust proxy', 1);

// Passport (initialize only — no passport.session(); we manage req.session.user ourselves)
configurePassport();
app.use(passport.initialize());

// // Redirect all legacy /finanaly paths to /aisworg using 307 redirect
// app.use((req, res, next) => {
//     if (req.url.startsWith('/finanaly')) {
//         const target = req.url.replace('/finanaly', '/aisworg');
//         return res.redirect(307, target);
//     }
//     next();
// });

// CSRF — double-submit cookie pattern (csrf-csrf v4)
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => process.env.SESSION_SECRET,
    getSessionIdentifier: (req) => req.sessionID ?? req.ip,
    cookieName: 'x-csrf-token',
    cookieOptions: { sameSite: 'lax', secure: isProd, httpOnly: true },
    getCsrfTokenFromRequest: (req) =>
        req.body?._csrf || req.headers['x-csrf-token'],
});

// Touch the session so express-session saves it and keeps sessionID stable across
// the GET→POST pair — required for CSRF token validation on unauthenticated pages
// like /login where saveUninitialized:false would otherwise give each request a
// fresh (non-persisted) sessionID, causing HMAC mismatches.
app.use((req, res, next) => {
    if (!req.session._t) req.session._t = 1;
    next();
});

// Apply CSRF validation to all state-changing requests.
// // /finanaly/demo/* is exempted — those routes are called from static HTML that
// // cannot embed a CSRF token, and they are already protected by session auth.
// /aisworg/demo/* is exempted — those routes are called from static HTML that
// cannot embed a CSRF token, and they are already protected by session auth.
// /aisworg/api/seu/* is exempted for the same reason — it's a session-authenticated
// JSON API meant to be called by any client (curl, test scripts, future non-browser
// integrations), not a browser form that can carry a CSRF token (MVP Build Plan §2.3).
app.use((req, res, next) => {
    if (req.path.startsWith('/aisworg/demo/') || req.path.startsWith('/aisworg/api/seu/')) return next();
    return doubleCsrfProtection(req, res, next);
});


// Expose session.user, CSRF token, market-cap map, series map, F&O map and portfolio map to all views
// app.use(async (req, res, next) => {
//     res.locals.session = req.session;
//     res.locals.activeUser = req.session?.user || null;
//     res.locals.csrfToken = generateCsrfToken(req, res);     
// });
app.use(async (req, res, next) => {
    res.locals.session = req.session;
    res.locals.activeUser = req.session?.user || null;
    res.locals.csrfToken = generateCsrfToken(req, res);
    res.locals.currentQuery = req.query;
    res.locals.currentPath = req.path;

    // CR-110 — navbar link visibility for EVERY nav link, keyed off each
    // link's own target route in route_authority, replacing the old
    // hardcoded role-literal gates (navbar.ejs's _isGeneral, and this file's
    // own Ontology role/root check) entirely. Computed here, not per-route,
    // since the navbar renders on every page. A link with no route_authority
    // row is NOT visible (fail-closed, same as the gate).
    res.locals.navRouteVisible = {};
    try {
        if (req.session?.user) {
            res.locals.navRouteVisible = await resolveNavRouteVisibility(req, [
                { method: "GET", path: "/aisworg" },
                { method: "GET", path: "/aisworg/quickview" },
                { method: "GET", path: "/aisworg/seu/objectives" },
                { method: "GET", path: "/aisworg/seu/seus" },
                { method: "GET", path: "/aisworg/seu/services" },
                { method: "GET", path: "/aisworg/seu/attention" },
                { method: "GET", path: "/aisworg/seu/telemetry" },
                { method: "GET", path: "/aisworg/seu/knowledge/capital" },
                { method: "GET", path: "/aisworg/seu/capabilities" },
                { method: "GET", path: "/aisworg/seu/participants" },
                { method: "GET", path: "/aisworg/seu/packs" },
                { method: "GET", path: "/aisworg/seu/templates" },
                { method: "GET", path: "/aisworg/seu/profiles" },
                { method: "GET", path: "/aisworg/seu/deliverable-definitions" },
                { method: "GET", path: "/aisworg/seu/service-definitions" },
                { method: "GET", path: "/aisworg/seu/policy-definitions" },
                { method: "GET", path: "/aisworg/seu/sdk/schema-registry" },
                { method: "GET", path: "/aisworg/seu/sdk/pack-authoring" },
                { method: "GET", path: "/aisworg/seu/sdk/template-authoring" },
                { method: "GET", path: "/aisworg/seu/sdk/profile-authoring" },
                { method: "GET", path: "/aisworg/seu/sdk/transition-definition-authoring" },
                { method: "GET", path: "/aisworg/seu/sdk/deliverable-authoring" },
                { method: "GET", path: "/aisworg/seu/sdk/service-authoring" },
                { method: "GET", path: "/aisworg/seu/sdk/policy-authoring" },
                { method: "GET", path: "/aisworg/seu/sdk/ontology" },
                { method: "GET", path: "/aisworg/seu/sdk/ontology/metadata" },
                { method: "GET", path: "/aisworg/seu/identity" },
                { method: "GET", path: "/aisworg/seu/events" },
                { method: "GET", path: "/aisworg/seu/tenant-admin/users" },
            ]);
        }
    } catch (err) {
        logger.warn('[navbar] route authority visibility fetch failed', err);
    }

    // Ontology's navbar dropdown lists concept-type GROUPS as sub-options
    // (owner: "the sublists grouped... ai-provider-preference, development-
    // methodology etc as a SEU Configurations") — fetched here (not
    // per-route) since the navbar renders on every page, not just the
    // Ontology page itself. Cheap over a small admin table; only fetched
    // when the Ontology link itself is visible (route_authority-driven,
    // above) so a user without the ontology badge never pays this query.
    // ontologyConceptTypeGroups lets the navbar highlight a group's own
    // entry as active when the resolved concept_type
    // (res.locals.currentQuery.type, set precisely by web/ontology.ts's own
    // GET handler) is one of that group's members.
    res.locals.ontologyConceptTypes = [];
    res.locals.ontologyConceptTypeGroups = {};
    try {
        const su = req.session?.user;
        if (su && res.locals.navRouteVisible['GET /aisworg/seu/sdk/ontology']) {
            const isRoot = (su.platformBadges || []).includes('root');
            const nav = await getConceptTypeNav({ isRoot, tenantId: su.tenant_id ?? null });
            res.locals.ontologyConceptTypes = nav.topLevel;
            res.locals.ontologyConceptTypeGroups = nav.groupMembers;
        }
    } catch (err) {
        logger.warn('[navbar] ontology concept types fetch failed', err);
    }

    // CR-001 — dev-only "Act As" switcher (design/Change Requests.md). Only
    // assembled when the feature is live for this caller (dev + not off + the
    // single god identity); otherwise res.locals.devActAs stays null and the
    // navbar renders nothing. In production this is always null.
    res.locals.devActAs = null;
    try {
        if (devActAsAvailable(req)) {
            const current = currentActAs(req) || { tenantId: null, badgeType: 'root' };
            const tenants = await listTenants();
            const badgeTypes = await listBadgeTypes(current.tenantId);
            const nounVerbBadgeCodes = await listNounVerbBadgeCodes();
            res.locals.devActAs = { current, tenants, badgeTypes, nounVerbBadgeCodes };
        }
    } catch (err) {
        logger.warn('[dev/actAs] navbar context assembly failed', err);
    }
    next();
});

// Gatekeeper — enforces login for all non-public routes
app.use(gatekeeper);

// CR-110 — global route-authority gate, replacing every per-route
// requireBadge/requireRole call with one route_authority table lookup.
app.use(routeAuthorityGate());

app.use(requestLogger);

// ── Public routes ─────────────────────────────────────────────────────────────
app.use("/aisworg", publicRouter);
app.use("/aisworg/auth", authRouter);
app.use("/aisworg/demo", demoRouter);
// CR-006 — the functional SEU surface is NOT role-gated: authentication is the
// gatekeeper's job (enforces login for every non-public route), and authority
// is badge-based per action (noun_verb). The legacy requireRole('general') here
// was a no-op (general is the floor role) and misrepresented role as an
// authority axis, so it's removed. (`role` remains only for home/demo landing.)
app.use("/aisworg/api/seu", seuApiRouter);
app.use("/aisworg/seu", seuWebRouter);

// ── Super-only routes ─────────────────────────────────────────────────────────
// app.use("/aisworg/super", requireRole('super'), superRouter);

app.get("/aisworg/login", (req, res) => res.redirect('/aisworg/auth/login'));
app.get("/aisworg/logout", (req, res) => res.redirect('/aisworg/auth/logout'));

app.get("/", (req, res) => res.redirect("/aisworg"));

app.use(errorHandler);

// Only auto-listen when this file is the process entry point (`pnpm start` /
// `pnpm dev`, both run `tsx src/app.js` directly). When imported as a module —
// e.g. the M5 acceptance test importing `app` to boot it on an ephemeral port —
// listening is the importer's responsibility, so tests don't collide with a
// dev server already bound to PORT.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    app.listen(PORT, async () => {
        await appConfig.init();
        logger.info(`AI SEU running on ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
        logger.info(`Log Level: ${process.env.LOG_LEVEL || "info"}`);
    });

    process.on("SIGTERM", () => { logger.info("SIGTERM"); process.exit(0); });
    process.on("SIGINT", () => { logger.info("SIGINT"); process.exit(0); });
}

export default app;
