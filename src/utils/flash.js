/**
 * Flash error message and redirect
 */
export function flashError(req, res, redirectPath, message) {
  req.session.flash = { type: "error", message };
  res.redirect(redirectPath);
}

/**
 * Flash success message and redirect
 */
export function flashSuccess(req, res, redirectPath, message) {
  req.session.flash = { type: "success", message };
  res.redirect(redirectPath);
}

/**
 * Get and clear flash message
 */
export function getFlash(req) {
  const flash = req.session.flash || null;
  delete req.session.flash;
  return flash;
}
