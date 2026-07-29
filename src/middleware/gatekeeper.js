import { logger } from '../utils/logger.js';

const PUBLIC_EXACT = new Set([
  '/aisworg',
  '/aisworg/',
  '/favicon.ico',
]);


const PUBLIC_PREFIX = [
  '/css/',
  '/js/',
  '/images/',
  '/fonts/',
  '/aisworg/auth/',   // login, logout, OAuth callbacks, verify
  '/aisworg/login',  // backwards-compat redirect
  '/aisworg/logout', // backwards-compat redirect
];

function isPublic(path) {
  if (PUBLIC_EXACT.has(path)) return true;
  if (PUBLIC_PREFIX.some(p => path.startsWith(p))) return true;
  return false;
}

export const gatekeeper = (req, res, next) => {
  const path = req.path;
  const user = req.session?.user;

  logger.debug(`[Gatekeeper] ${path} | user: ${user?.email || 'none'} (${user?.role || '-'})`);

  if (isPublic(path)) return next();

  if (!user) {
    logger.debug(`[Gatekeeper] Unauthenticated — redirect to login (${path})`);
    return res.redirect('/aisworg/login');
  }

  if (user.is_active === false) {
    return res.redirect('/aisworg/auth/disabled');
  }

  next();
};
