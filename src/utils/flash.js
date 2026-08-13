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

/**
 * Stash the user's submitted form input across a validation-error redirect, so
 * the re-rendered form can pre-fill it (they shouldn't have to retype). Cleared
 * on the next read via takeFormInput. Pair with flashError.
 */
export function stashFormInput(req, data) {
  req.session.formInput = data;
}

/**
 * Read and clear any stashed form input (see stashFormInput). Returns null when
 * there is none — i.e. a fresh GET, not a bounce-back from a failed submit.
 */
export function takeFormInput(req) {
  const data = req.session.formInput || null;
  delete req.session.formInput;
  return data;
}
