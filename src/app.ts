import "dotenv/config";

import { createRequire } from "module";
import { fileURLToPath } from "url";
const require = createRequire(import.meta.url);
const express = require("express");
const session = require("express-session");
const path = require("path");
const cookieParser = require("cookie-parser");

import type { Request, Response, NextFunction } from "express";

import { logger } from "./utils/logger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { gatekeeper } from "./middleware/gatekeeper.js";
import { buildSessionUser } from "./middleware/auth.js";
import { appConfig } from "./config/appconfig.js";
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
import { listTopLevelDocFolders } from "./domain/sdk/docsTree.js";
import { resolveNavRouteVisibility } from "./domain/identity/navRouteAccess.js";
import { loadRouteAuthorityCache } from "./domain/identity/routeAuthorityCache.js";
import { routeAuthorityGate } from "./middleware/routeAuthorityGate.js";

await eventBus.loadSubscriptions();
await loadRouteAuthorityCache();

const app = express();
const PORT = process.env.PORT || 4800;

app.locals.baseUrl = process.env.BASE_URL || '';

app.set("views", path.join(process.cwd(), "src", "views"));
app.set("view engine", "ejs");

if (process.env.NODE_ENV !== 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
        logger.debug(`Incoming path: ${req.path} ${req.url}`);
        next();
    });
}

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), "public")));
app.use('/aisworg', express.static(path.join(process.cwd(), "public")));

const isProd = process.env.NODE_ENV === 'production';
app.use(session({
    secret: process.env.SESSION_SECRET || (() => { throw new Error('SESSION_SECRET env var is not set'); })(),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: isProd, sameSite: isProd ? 'lax' : false, httpOnly: true },
}));

if (process.env.NODE_ENV === 'test') {
    app.use((req: Request, res: Response, next: NextFunction) => {
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

        const testUserId = req.headers['x-test-user-id'];
        if (testUserId) {
            (async () => {
                const user = await userDB.findById(testUserId as string);
                if (!user) return next(new Error(`x-test-user-id ${testUserId}: no such user`));
                req.session.user = await buildSessionUser(user);
                await ensureBadgeBootstrap(user);
                req.session.user.platformBadges = await getPlatformBadges(String(req.session.user.id));
                next();
            })().catch(next);
            return;
        }

        next();
    });
}

if (isProd) app.set('trust proxy', 1);

configurePassport();
app.use(passport.initialize());

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => process.env.SESSION_SECRET || (() => { throw new Error('SESSION_SECRET env var is not set'); })(),
    getSessionIdentifier: (req: Request) => req.sessionID ?? req.ip ?? '',
    cookieName: 'x-csrf-token',
    cookieOptions: { sameSite: 'lax', secure: isProd, httpOnly: true },
    getCsrfTokenFromRequest: (req: Request) =>
        req.body?._csrf || req.headers['x-csrf-token'],
});

app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.session._t) req.session._t = 1;
    next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/aisworg/demo/') || req.path.startsWith('/aisworg/api/seu/')) return next();
    return doubleCsrfProtection(req, res, next);
});

app.use(async (req: Request, res: Response, next: NextFunction) => {
    res.locals.session = req.session;
    res.locals.activeUser = req.session?.user || null;
    res.locals.csrfToken = generateCsrfToken(req, res);
    res.locals.currentQuery = req.query;
    res.locals.currentPath = req.path;

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
                { method: "GET", path: "/aisworg/seu/capability-definitions" },
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
                { method: "GET", path: "/aisworg/seu/sdk/capability-authoring" },
                { method: "GET", path: "/aisworg/seu/sdk/ontology" },
                { method: "GET", path: "/aisworg/seu/sdk/ontology/metadata" },
                { method: "GET", path: "/aisworg/seu/identity" },
                { method: "GET", path: "/aisworg/seu/events" },
                { method: "GET", path: "/aisworg/seu/version-events" },
                { method: "GET", path: "/aisworg/seu/tenant-admin/users" },
                { method: "GET", path: "/aisworg/seu/data-migrations" },
                { method: "GET", path: "/aisworg/seu/docs" },
            ]);
        }
    } catch (err) {
        logger.warn('[navbar] route authority visibility fetch failed', err as Error);
    }

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
        logger.warn('[navbar] ontology concept types fetch failed', err as Error);
    }

    res.locals.docFolders = [];
    try {
        if (req.session?.user && res.locals.navRouteVisible['GET /aisworg/seu/docs']) {
            res.locals.docFolders = listTopLevelDocFolders();
        }
    } catch (err) {
        logger.warn('[navbar] docs folder listing failed', err as Error);
    }

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
        logger.warn('[dev/actAs] navbar context assembly failed', err as Error);
    }
    next();
});

app.use(gatekeeper);

app.use(routeAuthorityGate());

app.use(requestLogger);

app.use("/aisworg", publicRouter);
app.use("/aisworg/auth", authRouter);
app.use("/aisworg/demo", demoRouter);
app.use("/aisworg/api/seu", seuApiRouter);
app.use("/aisworg/seu", seuWebRouter);

app.get("/aisworg/login", (req: Request, res: Response) => res.redirect('/aisworg/auth/login'));
app.get("/aisworg/logout", (req: Request, res: Response) => res.redirect('/aisworg/auth/logout'));

app.get("/", (req: Request, res: Response) => res.redirect("/aisworg"));

app.use(errorHandler);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const server = app.listen(PORT, async () => {
        await appConfig.init();
        logger.info(`AI SEU running on ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
        logger.info(`Log Level: ${process.env.LOG_LEVEL || "info"}`);
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
            logger.error(`Port ${PORT} already in use — another instance is running. Exiting.`);
            process.exit(1);
        }
        throw err;
    });

    process.on("SIGTERM", () => { logger.info("SIGTERM"); process.exit(0); });
    process.on("SIGINT", () => { logger.info("SIGINT"); process.exit(0); });
}

export default app;
