import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const passport        = require('passport');
const GoogleStrategy  = require('passport-google-oauth20').Strategy;
const LocalStrategy   = require('passport-local').Strategy;
const bcrypt          = require('bcryptjs');

import { userDB }  from '../../dblayer/userDB.js';
import { tenantsDB } from '../../dblayer/tenantsDB.js';
import {participantsMasterDB} from '../../dblayer/participantsMasterDB.js';
import {DEMO_TENANT_NAME} from '../../dblayer/constants.js';
import { logger }  from '../../utils/logger.js';

const SUPERUSER_EMAIL = (process.env.SUPERUSER_EMAIL || '').toLowerCase();

function applyRoleOverride(user) {
  if (SUPERUSER_EMAIL && user.email.toLowerCase() === SUPERUSER_EMAIL) {
    user.role = 'super';
    user.tenant_id = '';
  }
  return user;
}

export function configurePassport() {

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
            if (dbErr.message?.includes('timeout') || dbErr.message?.includes('terminated')) {
              logger.warn('[Auth] DB cold-start on Google callback — retrying once');
              user = await userDB.findByEmail(email);
            } else {
              throw dbErr;
            }
          }

          if (!user) {

            const isSuper = SUPERUSER_EMAIL && email.toLowerCase() === SUPERUSER_EMAIL;

            const home = isSuper
              ? await tenantsDB.ensurePlatformTenant()
              : await tenantsDB.findByName(DEMO_TENANT_NAME);
            if (home.error) return done(home.error);
            const homeTenantId = isSuper ? home.data : home.data.id;

            user = await userDB.create({
              email,
              name:          profile.displayName,
              avatar_url:    profile.photos?.[0]?.value || null,
              auth_provider: 'google',
              provider_id:   profile.id,
              is_active:     true,
              type:          isSuper ? 'Platform' : 'Tenant',
              tenant_id: homeTenantId
            });
            logger.info(`[Auth] New Google user created: (${isSuper ? 'Platform' : 'Tenant/demo'})`);
          } else {
            await userDB.updateLastLogin(email);
          }
          const {data: existingParticipant, error: participantLookupErr} = await participantsMasterDB.findByUserId(user.id);
          if (participantLookupErr) return done(participantLookupErr);
          if (!existingParticipant) {
            const isSuper = SUPERUSER_EMAIL && user.email.toLowerCase() === SUPERUSER_EMAIL;
            let participantTenantId;
            if (isSuper) {
              const {data, error} = await tenantsDB.ensurePlatformTenant();
              if (error) return done(error);
              participantTenantId = data;
            } else {
              const {data, error} = await tenantsDB.findByName(DEMO_TENANT_NAME);
              if (error) return done(error);
              participantTenantId = data.id;
            }

            const {error: participantCreateErr} = await participantsMasterDB.create({
              tenantId: participantTenantId,
              type: 'Human',
              displayName: user.name || user.email,
              authorisedRole: isSuper ? [{role: 'superuser', effective_till: '9999-12-31', seu_ids: []}] : [],
              authorisedBadges: isSuper ? [{badge: 'root', effective_till: '9999-12-31', seu_ids: []}] : [],
              userId: user.id,
            });
            if (participantCreateErr) return done(participantCreateErr);
          }

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

  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await userDB.findByEmail(email.toLowerCase());

        if (!user || user.auth_provider !== 'local') {
          return done(null, false, { message: 'Invalid email or password.' });
        }

        if (!user.password_hash) {
          if (process.env.NODE_ENV !== 'production') {
            const hash = await bcrypt.hash(password, 12);
            const activated = await userDB.activateWithPassword(user.email, hash);
            if (activated) {
              applyRoleOverride(activated);
              if (!activated.is_active) {
                return done(null, false, { message: 'disabled' });
              }
              await userDB.updateLastLogin(activated.email);
              return done(null, activated);
            }
          }
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
