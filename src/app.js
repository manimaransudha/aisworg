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
import { requireRole } from "./middleware/auth.js";
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
if (process.env.NODE_ENV !== 'production') {
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

        if (!isPublic && req.session && !req.session.user) {
            req.session.user = {
                id: 1,
                email: 'manimaransudha@gmail.com',
                name: 'Sudha Manimaran',
                role: 'super',
                is_active: true
            };
        }
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
    next();
});

// Gatekeeper — enforces login for all non-public routes
app.use(gatekeeper);

app.use(requestLogger);

// ── Public routes ─────────────────────────────────────────────────────────────
app.use("/aisworg", publicRouter);
app.use("/aisworg/auth", authRouter);
app.use("/aisworg/demo", requireRole('general'), demoRouter);
app.use("/aisworg/api/seu", requireRole('general'), seuApiRouter);
app.use("/aisworg/seu", requireRole('general'), seuWebRouter);

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
