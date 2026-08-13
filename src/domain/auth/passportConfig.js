import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const passport        = require('passport');
const GoogleStrategy  = require('passport-google-oauth20').Strategy;
const LocalStrategy   = require('passport-local').Strategy;
const bcrypt          = require('bcryptjs');

import { userDB }  from '../../dblayer/userDB.js';
import { tenantsDB } from '../../dblayer/tenantsDB.js';
import { logger }  from '../../utils/logger.js';

const SUPERUSER_EMAIL = (process.env.SUPERUSER_EMAIL || '').toLowerCase();

function applyRoleOverride(user) {
  if (SUPERUSER_EMAIL && user.email.toLowerCase() === SUPERUSER_EMAIL) {
    user.role = 'super';
  }
  return user;
}

export function configurePassport() {
  // Passport session serialization is not used — we manage req.session.user ourselves.
  // Only passport.initialize() is needed, not passport.session().

  // ── Google OAuth strategy ──────────────────────────────────────────────────
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  `${process.env.BASE_URL || ''}/aisworg/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) return done(new Error('No email from Google'));

          let user;
          try {
            user = await userDB.findByEmail(email);
          } catch (dbErr) {
            // Retry once on connection timeout (Neon cold-start)
            if (dbErr.message?.includes('timeout') || dbErr.message?.includes('terminated')) {
              logger.warn('[Auth] DB cold-start on Google callback — retrying once');
              user = await userDB.findByEmail(email);
            } else {
              throw dbErr;
            }
          }

          if (!user) {
            // CR-004: the SUPERUSER is the platform identity; every other Google
            // self-signup lands active in the operational 'demo' sandbox tenant
            // (frictionless play), never Platform.
            const isSuper = SUPERUSER_EMAIL && email.toLowerCase() === SUPERUSER_EMAIL;
            const homeCode = isSuper ? 'platform' : 'demo';
            const { data: home } = await tenantsDB.findByCode(homeCode);
            user = await userDB.create({
              email,
              name:          profile.displayName,
              avatar_url:    profile.photos?.[0]?.value || null,
              role:          'general',
              auth_provider: 'google',
              provider_id:   profile.id,
              is_active:     true,
              type:          isSuper ? 'Platform' : 'Tenant',
              tenant_id:     home?.id ?? null,
            });
            logger.info(`[Auth] New Google user created: ${email} (${isSuper ? 'Platform' : 'Tenant/demo'})`);
          } else {
            await userDB.updateLastLogin(email);
          }

          applyRoleOverride(user);

          if (!user.is_active) {
            return done(null, false, { message: 'disabled' });
          }

          return done(null, user);
        } catch (err) {
          logger.error('[Auth] Google strategy error:', err);
          return done(err);
        }
      }
    ));
    logger.info('[Auth] Google OAuth strategy registered.');
  } else {
    logger.warn('[Auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google login disabled.');
  }

  // ── Local strategy (email + password) ─────────────────────────────────────
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await userDB.findByEmail(email.toLowerCase());

        if (!user || user.auth_provider !== 'local') {
          return done(null, false, { message: 'Invalid email or password.' });
        }

        if (!user.password_hash) {
          return done(null, false, { message: 'Account not yet activated. Check your verification email.' });
        }

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
          return done(null, false, { message: 'Invalid email or password.' });
        }

        applyRoleOverride(user);

        if (!user.is_active) {
          return done(null, false, { message: 'disabled' });
        }

        await userDB.updateLastLogin(user.email);
        return done(null, user);
      } catch (err) {
        logger.error('[Auth] Local strategy error:', err);
        return done(err);
      }
    }
  ));

  return passport;
}

export { passport };
