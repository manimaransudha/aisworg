import { createRequire } from 'module';
const require  = createRequire(import.meta.url);
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

import { passport }    from '../../domain/auth/passportConfig.js';
import { userDB }      from '../../dblayer/userDB.js';
import { tenantsDB }   from '../../dblayer/tenantsDB.js';
import { DEMO_TENANT_NAME } from '../../dblayer/constants.js';
import { emailService } from '../../domain/auth/emailService.js';
import { buildSessionUser } from '../../middleware/auth.js';
import { ensureBadgeBootstrap, getPlatformBadges } from '../../domain/identity/badgeBootstrap.js';
import { logger }      from '../../utils/logger.js';
import { getFlash }    from '../../utils/flash.js';
import { redirects }   from '../../middleware/redirects.js';
import { parseListParams, paginateList } from '../../utils/listQuery.js';
import { rateLimit }   from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import type { UserRow } from '../../dblayer/userDB.js';
import { requireActorId } from "../../domain/identity/heldBadges.js";

const loginLimiter = rateLimit({
  windowMs:         4 * 60 * 60 * 1000,
  limit:            3,
  standardHeaders:  'draft-8',
  legacyHeaders:    false,
  message:          { error: 'Too many login attempts. Please try again in 4 hours.' },
  skipSuccessfulRequests: true,
});

const SUPERUSER_EMAIL = (process.env.SUPERUSER_EMAIL || '').toLowerCase();

function postLoginRedirectPath(user: { platformBadges?: string[] } | undefined) {
  return (user?.platformBadges ?? []).includes('root') ? '/aisworg/seu/identity' : '/aisworg/quickview';
}

router.get('/login', (req: Request, res: Response) => {
  if (req.session?.user) return res.redirect(postLoginRedirectPath(req.session.user));
  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const flash = getFlash(req);
  res.render('auth/login', {
    title:         'Sign in to SEU Studio',
    googleEnabled,
    error:         flash?.type === 'error' ? flash.message : null,
    info:          flash?.type === 'success' ? flash.message : null,
  });
});

router.post('/login', loginLimiter, (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', async (err: unknown, user: UserRow | false, info?: { message?: string }) => {
    if (err) return next(err);

    if (!user) {
      if (info?.message === 'disabled') return res.redirect('/aisworg/auth/disabled');
      return redirects.auth.login.error(req, res, info?.message || 'Invalid credentials.');
    }

    req.session.user = await buildSessionUser(user);
    await ensureBadgeBootstrap(user);
    req.session.user.platformBadges = await getPlatformBadges(requireActorId(req));
    logger.info(`[Auth] Local login: ${user.email}`);
    return res.redirect(postLoginRedirectPath(req.session.user));
  })(req, res, next);
});

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/aisworg/login' }),
  async (req: Request, res: Response) => {
    const googleUser = (req as Request & { user?: UserRow }).user;
    if (!googleUser) return res.redirect('/aisworg/auth/disabled');
    req.session.user = await buildSessionUser(googleUser);
    await ensureBadgeBootstrap(googleUser);
    req.session.user.platformBadges = await getPlatformBadges(requireActorId(req));
    logger.info(`[Auth] Google login: ${googleUser.email}`);
    const isRoot = (req.session.user.platformBadges ?? []).includes('root');
    if (!isRoot) {
      const { data: demoTenant, error } = await tenantsDB.findByName(DEMO_TENANT_NAME);
      if (error) throw error;
      if (demoTenant && demoTenant.id === googleUser.tenant_id) return res.redirect('/aisworg/seu/dashboard/demo');
    }
    res.redirect(postLoginRedirectPath(req.session.user));
  }
);

router.get('/logout', (req: Request, res: Response) => {
  const email = req.session?.user?.email;
  req.session.destroy(() => {
    logger.info(`[Auth] Logout: ${email || 'unknown'}`);
    res.redirect('/aisworg');
  });
});

router.get('/disabled', (req: Request, res: Response) => {
  res.render('auth/disabled', { title: 'Account Disabled' });
});

router.get('/verify', async (req: Request, res: Response) => {
  const token = req.query.token;
  if (typeof token !== 'string' || !token) return res.redirect('/aisworg/login');

  const user = await userDB.findByVerificationToken(token);
  if (!user) {
    return redirects.auth.verify.error(req, res, 'Verification link is invalid or has expired.');
  }

  res.render('auth/verify', { title: 'Set Your Password', token, email: user.email, error: null });
});

router.post('/verify', loginLimiter, async (req: Request, res: Response) => {
  const { token, password, password_confirm } = req.body;

  if (!token) return res.redirect('/aisworg/login');

  const user = await userDB.findByVerificationToken(token);
  if (!user) {
    return redirects.auth.verify.error(req, res, 'Verification link is invalid or has expired.');
  }

  if (!password || password.length < 8) {
    return res.render('auth/verify', {
      title: 'Set Your Password', token, email: user.email,
      error: 'Password must be at least 8 characters.',
    });
  }

  if (password !== password_confirm) {
    return res.render('auth/verify', {
      title: 'Set Your Password', token, email: user.email,
      error: 'Passwords do not match.',
    });
  }

  const hash = await bcrypt.hash(password, 12);
  const activated = await userDB.activateWithPassword(user.email, hash);
  if (!activated) throw new Error(`[Auth] activateWithPassword returned no row for ${user.email}`);

  req.session.user = await buildSessionUser(activated);
  await ensureBadgeBootstrap(activated);
  req.session.user.platformBadges = await getPlatformBadges(requireActorId(req));
  logger.info(`[Auth] Account activated: ${activated.email}`);
  res.redirect(postLoginRedirectPath(req.session.user));
});

router.get('/forgot-password', (req: Request, res: Response) => {
  if (req.session?.user) return res.redirect(postLoginRedirectPath(req.session.user));
  const flash = getFlash(req);
  res.render('auth/forgot-password', {
    title: 'Forgot Password',
    info:  flash?.type === 'success' ? flash.message : null,
    error: flash?.type === 'error' ? flash.message : null,
  });
});

router.post('/forgot-password', loginLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;
  const GENERIC = 'If that email is registered, a reset link has been sent.';
  try {
    if (email) {
      const token   = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      const user    = await userDB.setResetToken(email, token, expires);
      if (user) {
        const result = await emailService.sendPasswordReset({ to: user.email, name: user.name, token });
        if (result.link) {
          return redirects.auth.forgotPassword.success(req, res, `SMTP not configured — reset link: ${result.link}`);
        }
      }
    }
    return redirects.auth.forgotPassword.success(req, res, GENERIC);
  } catch (err) {
    logger.error('[Auth] POST /forgot-password error:', err);
    return redirects.auth.forgotPassword.success(req, res, GENERIC);
  }
});

router.get('/reset-password', async (req: Request, res: Response) => {
  const token = req.query.token;
  if (typeof token !== 'string' || !token) return res.redirect('/aisworg/login');
  const user = await userDB.findByVerificationToken(token);
  if (!user) {
    return redirects.auth.resetPassword.error(req, res, 'Password reset link is invalid or has expired.');
  }
  res.render('auth/reset-password', { title: 'Reset Your Password', token, email: user.email, error: null });
});

router.post('/reset-password', loginLimiter, async (req: Request, res: Response) => {
  const { token, password, password_confirm } = req.body;
  if (!token) return res.redirect('/aisworg/login');

  const user = await userDB.findByVerificationToken(token);
  if (!user) {
    return redirects.auth.resetPassword.error(req, res, 'Password reset link is invalid or has expired.');
  }

  if (!password || password.length < 8) {
    return res.render('auth/reset-password', {
      title: 'Reset Your Password', token, email: user.email,
      error: 'Password must be at least 8 characters.',
    });
  }
  if (password !== password_confirm) {
    return res.render('auth/reset-password', {
      title: 'Reset Your Password', token, email: user.email,
      error: 'Passwords do not match.',
    });
  }

  const hash = await bcrypt.hash(password, 12);
  await userDB.activateWithPassword(user.email, hash);
  logger.info(`[Auth] Password reset: ${user.email}`);
  return redirects.auth.resetPassword.success(req, res, 'Password reset successfully. Please sign in.');
});

router.get('/users', async (req: Request, res: Response) => {
  try {
    const managed = await userDB.listManaged(SUPERUSER_EMAIL);
    const params = parseListParams(req.query, { sortable: ['user', 'provider', 'lastlogin'], defaultSort: 'user', defaultDir: 'asc' });
    const list = paginateList(managed, params, {
      searchFields: [(u) => u.email, (u) => u.name, (u) => u.auth_provider],
      sortFields: { user: (u) => u.name || u.email, provider: (u) => u.auth_provider, lastlogin: (u) => u.last_login },
    });
    res.render('auth/users', {
      title:       'User Management',
      activePage:  'user-management',
      list,
      listBasePath: '/aisworg/auth/users',
      currentUser: req.session.user,
      flash:       getFlash(req),
    });
  } catch (err) {
    logger.error('[Auth] GET /users error:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/users/create', async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return redirects.auth.users.error(req, res, 'Email is required.');
    }
    if (email.toLowerCase() === SUPERUSER_EMAIL) {
      return redirects.auth.users.error(req, res, 'Cannot create account for the protected superuser.');
    }

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const { data: platformTenant } = await tenantsDB.findByCode('platform');
    if (!platformTenant) throw new Error("[Auth] platform tenant not found");
    await userDB.createLocalPending({ email, name: name || email, verification_token: token, verification_expires: expires, type: 'Platform', tenant_id: platformTenant.id });
    const result = await emailService.sendVerification({ to: email, name: name || email, token });

    return redirects.auth.users.success(req, res, result.link
      ? `Account created. SMTP not configured — verification link: ${result.link}`
      : `Account created. Verification email sent to ${email}.`);
  } catch (err) {
    logger.error('[Auth] POST /users/create error:', err);
    return redirects.auth.users.error(req, res, err instanceof Error ? err.message : String(err));
  }
});

router.post('/users/toggle', async (req: Request, res: Response) => {
  try {
    const { email, action } = req.body;
    if (email?.toLowerCase() === SUPERUSER_EMAIL) {
      return redirects.auth.users.error(req, res, 'Cannot modify the protected superuser.');
    }
    const is_active = action === 'enable';
    await userDB.setActive(email, is_active);
    return redirects.auth.users.success(req, res, `${email} ${is_active ? 'enabled' : 'disabled'}.`);
  } catch (err) {
    logger.error('[Auth] POST /users/toggle error:', err);
    return redirects.auth.users.error(req, res, err instanceof Error ? err.message : String(err));
  }
});

router.post('/users/resend', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await userDB.findByEmail(email);
    if (!user || user.auth_provider !== 'local') {
      return redirects.auth.users.error(req, res, 'User not found or not a local account.');
    }

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await userDB.createLocalPending({ email, name: user.name, verification_token: token, verification_expires: expires, type: user.type, tenant_id: user.tenant_id });
    const result = await emailService.sendVerification({ to: email, name: user.name, token });

    return redirects.auth.users.success(req, res, result.link
      ? `SMTP not configured — link: ${result.link}`
      : `Verification email resent to ${email}.`);
  } catch (err) {
    logger.error('[Auth] POST /users/resend error:', err);
    return redirects.auth.users.error(req, res, err instanceof Error ? err.message : String(err));
  }
});

export { router };
