import { createRequire } from 'module';
const require  = createRequire(import.meta.url);
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

import { passport }    from '../../domain/auth/passportConfig.js';
import { userDB }      from '../../dblayer/userDB.js';
import { tenantsDB }   from '../../dblayer/tenantsDB.js';
import { emailService } from '../../domain/auth/emailService.js';
import { buildSessionUser } from '../../middleware/auth.js';
import { ensureBadgeBootstrap, getPlatformBadges } from '../../domain/identity/badgeBootstrap.js';
import { logger }      from '../../utils/logger.js';
import { parseListParams, paginateList } from '../../utils/listQuery.js';
import { rateLimit }   from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs:         4 * 60 * 60 * 1000,
  limit:            3,
  standardHeaders:  'draft-8',
  legacyHeaders:    false,
  message:          { error: 'Too many login attempts. Please try again in 4 hours.' },
  skipSuccessfulRequests: true,
});

const SUPERUSER_EMAIL = (process.env.SUPERUSER_EMAIL || '').toLowerCase();

function postLoginRedirectPath(user) {
  return (user?.platformBadges ?? []).includes('root') ? '/aisworg/seu/identity' : '/aisworg/quickview';
}

router.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect(postLoginRedirectPath(req.session.user));
  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  res.render('auth/login', {
    title:         'Sign in to SEU Studio',
    googleEnabled,
    error:         req.session.flash?.error || null,
    info:          req.session.flash?.info  || null,
  });
  delete req.session.flash;
});

router.post('/login', loginLimiter, (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      if (info?.message === 'disabled') return res.redirect('/aisworg/auth/disabled');
      req.session.flash = { error: info?.message || 'Invalid credentials.' };
      return res.redirect('/aisworg/login');
    }

    req.session.user = await buildSessionUser(user);
    await ensureBadgeBootstrap(user);
    req.session.user.platformBadges = await getPlatformBadges(String(req.session.user.id));
    logger.info(`[Auth] Local login: ${user.email} (${user.role})`);
    return res.redirect(postLoginRedirectPath(req.session.user));
  })(req, res, next);
});

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/aisworg/login' }),
  async (req, res) => {
    if (!req.user) return res.redirect('/aisworg/auth/disabled');
    req.session.user = await buildSessionUser(req.user);
    await ensureBadgeBootstrap(req.user);
    req.session.user.platformBadges = await getPlatformBadges(String(req.session.user.id));
    logger.info(`[Auth] Google login: ${req.user.email} (${req.user.role})`);
    res.redirect(postLoginRedirectPath(req.session.user));
  }
);

router.get('/logout', (req, res) => {
  const email = req.session?.user?.email;
  req.session.destroy(() => {
    logger.info(`[Auth] Logout: ${email || 'unknown'}`);
    res.redirect('/aisworg');
  });
});

router.get('/disabled', (req, res) => {
  res.render('auth/disabled', { title: 'Account Disabled' });
});

router.get('/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect('/aisworg/login');

  const user = await userDB.findByVerificationToken(token);
  if (!user) {
    req.session.flash = { error: 'Verification link is invalid or has expired.' };
    return res.redirect('/aisworg/login');
  }

  res.render('auth/verify', { title: 'Set Your Password', token, email: user.email, error: null });
});

router.post('/verify', loginLimiter, async (req, res) => {
  const { token, password, password_confirm } = req.body;

  if (!token) return res.redirect('/aisworg/login');

  const user = await userDB.findByVerificationToken(token);
  if (!user) {
    req.session.flash = { error: 'Verification link is invalid or has expired.' };
    return res.redirect('/aisworg/login');
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

  req.session.user = await buildSessionUser(activated);
  await ensureBadgeBootstrap(activated);
  req.session.user.platformBadges = await getPlatformBadges(String(req.session.user.id));
  logger.info(`[Auth] Account activated: ${activated.email} (${activated.role})`);
  res.redirect(postLoginRedirectPath(req.session.user));
});

router.get('/forgot-password', (req, res) => {
  if (req.session?.user) return res.redirect(postLoginRedirectPath(req.session.user));
  const flash = req.session.flash || {};
  delete req.session.flash;
  res.render('auth/forgot-password', {
    title: 'Forgot Password',
    info:  flash.info  || null,
    error: flash.error || null,
  });
});

router.post('/forgot-password', loginLimiter, async (req, res) => {
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
          req.session.flash = { info: `SMTP not configured — reset link: ${result.link}` };
          return res.redirect('/aisworg/auth/forgot-password');
        }
      }
    }
    req.session.flash = { info: GENERIC };
    return res.redirect('/aisworg/auth/forgot-password');
  } catch (err) {
    logger.error('[Auth] POST /forgot-password error:', err);
    req.session.flash = { info: GENERIC };
    return res.redirect('/aisworg/auth/forgot-password');
  }
});

router.get('/reset-password', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect('/aisworg/login');
  const user = await userDB.findByVerificationToken(token);
  if (!user) {
    req.session.flash = { error: 'Password reset link is invalid or has expired.' };
    return res.redirect('/aisworg/login');
  }
  res.render('auth/reset-password', { title: 'Reset Your Password', token, email: user.email, error: null });
});

router.post('/reset-password', loginLimiter, async (req, res) => {
  const { token, password, password_confirm } = req.body;
  if (!token) return res.redirect('/aisworg/login');

  const user = await userDB.findByVerificationToken(token);
  if (!user) {
    req.session.flash = { error: 'Password reset link is invalid or has expired.' };
    return res.redirect('/aisworg/login');
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
  req.session.flash = { info: 'Password reset successfully. Please sign in.' };
  return res.redirect('/aisworg/login');
});

router.get('/users', async (req, res) => {
  try {
    const managed = await userDB.listManaged(SUPERUSER_EMAIL);
    const params = parseListParams(req.query, { sortable: ['user', 'provider', 'role', 'lastlogin'], defaultSort: 'user', defaultDir: 'asc' });
    const list = paginateList(managed, params, {
      searchFields: [(u) => u.email, (u) => u.name, (u) => u.role, (u) => u.auth_provider],
      sortFields: { user: (u) => u.name || u.email, provider: (u) => u.auth_provider, role: (u) => u.role, lastlogin: (u) => u.last_login },
    });
    res.render('auth/users', {
      title:       'User Management',
      activePage:  'user-management',
      list,
      listBasePath: '/aisworg/auth/users',
      currentUser: req.session.user,
      flash:       req.session.flash || null,
    });
    delete req.session.flash;
  } catch (err) {
    logger.error('[Auth] GET /users error:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/users/create', async (req, res) => {
  try {
    const { email, name, role } = req.body;
    if (!email || !role) {
      req.session.flash = { error: 'Email and role are required.' };
      return res.redirect('/aisworg/auth/users');
    }
    if (!['power', 'tenant_super', 'super'].includes(role)) {
      req.session.flash = { error: 'Invalid role.' };
      return res.redirect('/aisworg/auth/users');
    }
    if (email.toLowerCase() === SUPERUSER_EMAIL) {
      req.session.flash = { error: 'Cannot create account for the protected superuser.' };
      return res.redirect('/aisworg/auth/users');
    }

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const { data: platformTenant } = await tenantsDB.findByCode('platform');
    await userDB.createLocalPending({ email, name: name || email, role, verification_token: token, verification_expires: expires, type: 'Platform', tenant_id: platformTenant?.id ?? null });
    const result = await emailService.sendVerification({ to: email, name: name || email, token });

    if (result.link) {
      req.session.flash = { info: `Account created. SMTP not configured — verification link: ${result.link}` };
    } else {
      req.session.flash = { info: `Account created. Verification email sent to ${email}.` };
    }
    return res.redirect('/aisworg/auth/users');
  } catch (err) {
    logger.error('[Auth] POST /users/create error:', err);
    req.session.flash = { error: err.message };
    return res.redirect('/aisworg/auth/users');
  }
});

router.post('/users/role', async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!['general', 'power', 'tenant_super', 'super'].includes(role)) {
      req.session.flash = { error: 'Invalid role.' };
      return res.redirect('/aisworg/auth/users');
    }
    if (email?.toLowerCase() === SUPERUSER_EMAIL) {
      req.session.flash = { error: 'Cannot modify the protected superuser.' };
      return res.redirect('/aisworg/auth/users');
    }
    await userDB.updateRole(email, role);
    req.session.flash = { info: `Role updated for ${email}.` };
    return res.redirect('/aisworg/auth/users');
  } catch (err) {
    logger.error('[Auth] POST /users/role error:', err);
    req.session.flash = { error: err.message };
    return res.redirect('/aisworg/auth/users');
  }
});

router.post('/users/toggle', async (req, res) => {
  try {
    const { email, action } = req.body;
    if (email?.toLowerCase() === SUPERUSER_EMAIL) {
      req.session.flash = { error: 'Cannot modify the protected superuser.' };
      return res.redirect('/aisworg/auth/users');
    }
    const is_active = action === 'enable';
    await userDB.setActive(email, is_active);
    req.session.flash = { info: `${email} ${is_active ? 'enabled' : 'disabled'}.` };
    return res.redirect('/aisworg/auth/users');
  } catch (err) {
    logger.error('[Auth] POST /users/toggle error:', err);
    req.session.flash = { error: err.message };
    return res.redirect('/aisworg/auth/users');
  }
});

router.post('/users/resend', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await userDB.findByEmail(email);
    if (!user || user.auth_provider !== 'local') {
      req.session.flash = { error: 'User not found or not a local account.' };
      return res.redirect('/aisworg/auth/users');
    }

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await userDB.createLocalPending({ email, name: user.name, role: user.role, verification_token: token, verification_expires: expires, type: user.type, tenant_id: user.tenant_id });
    const result = await emailService.sendVerification({ to: email, name: user.name, token });

    if (result.link) {
      req.session.flash = { info: `SMTP not configured — link: ${result.link}` };
    } else {
      req.session.flash = { info: `Verification email resent to ${email}.` };
    }
    return res.redirect('/aisworg/auth/users');
  } catch (err) {
    logger.error('[Auth] POST /users/resend error:', err);
    req.session.flash = { error: err.message };
    return res.redirect('/aisworg/auth/users');
  }
});

export { router };
