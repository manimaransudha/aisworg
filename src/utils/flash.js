export function flashError(req, res, redirectPath, message) {
  req.session.flash = { type: "error", message };
  res.redirect(redirectPath);
}

export function flashSuccess(req, res, redirectPath, message) {
  req.session.flash = { type: "success", message };
  res.redirect(redirectPath);
}

export function getFlash(req) {
  const flash = req.session.flash || null;
  delete req.session.flash;
  return flash;
}

export function stashFormInput(req, data) {
  req.session.formInput = data;
}

export function takeFormInput(req) {
  const data = req.session.formInput || null;
  delete req.session.formInput;
  return data;
}
