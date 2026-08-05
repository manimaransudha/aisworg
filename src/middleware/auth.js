import { logger } from '../utils/logger.js';

const ROLE_LEVEL = { general: 1, power: 2, super: 3 };

/**
 * Builds a session user object from a DB user row.
 * Always called after role override has been applied.
 */
export function buildSessionUser(user) {
  return {
    id:         user.id,
    email:      user.email,
    name:       user.name,
    avatar_url: user.avatar_url || null,
    role:       user.role,
    is_active:  user.is_active !== false,
  };
}

/**
 * requireRole(minRole) — Express middleware factory.
 * Redirects to login if not authenticated, 403 if role insufficient.
 */
export function requireRole(minRole) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) {
      // Non-GET requests are AJAX/API calls — return JSON 401 so the browser can
      // redirect itself, rather than sending HTML that callers try to JSON.parse.
      if (req.method !== 'GET') {
        return res.status(401).json({ success: false, message: 'Session expired — please log in again.' });
      }
      logger.debug(`[requireRole] Not logged in — redirect to login (path: ${req.path})`);
      return res.redirect('/aisworg/login');
    }
    // ─── TESTING BYPASS — remove this block to revert ───────────────────────
    // For testing convenience only, not part of the design (Phase 10's badge
    // model is deliberately a separate axis from this legacy role check —
    // see the design doc's §5 correction). Holding the root badge passes any
    // requireRole() check too, so "root" really does mean full access to
    // everything while testing, not just badge-gated surfaces. Delete this
    // block to go back to requireRole() reading only users.role, unrelated
    // to badges.
    if ((user.platformBadges ?? []).includes('root')) return next();
    // ─── end testing bypass ──────────────────────────────────────────────────

    const userLevel = ROLE_LEVEL[user.role] ?? 0;
    const needLevel = ROLE_LEVEL[minRole] ?? 99;
    if (userLevel >= needLevel) return next();

    logger.warn(`[requireRole] ${user.email} (${user.role}) tried to access ${req.path} — needs ${minRole}`);
    req.session.flash = { type: 'error', message: "You don't have permission to access that page." };
    const back = req.headers.referer || '/aisworg';
    return res.redirect(back);
  };
}

/** Convenience: any logged-in user. */
export const requireLogin = requireRole('general');
