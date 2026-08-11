// Dry-run suite harness: a zero-dependency HTTP client (with a cookie jar and
// CSRF helper) plus a tiny test runner. Standalone Node (global fetch) — it does
// not import anything from the platform repo, so it lives in the vault and drives
// a running instance purely over HTTP, exactly as a real external client would.
//
// This file is transport + reporting only. It has no knowledge of the platform's
// domain; that lives in platform.mjs (the API contract) and edge.mjs (the
// tenant-side simulation that a real adapter later replaces).

const BASE = process.env.SUITE_BASE_URL || "http://127.0.0.1:4900/aisworg";

export const urls = {
  base: BASE,
  api: (p) => `${BASE}/api/seu${p}`,
  web: (p) => `${BASE}/seu${p}`,
};

// ---- cookie jar (session + CSRF secret) --------------------------------------
const jar = new Map();

function applyCookies(headers) {
  if (jar.size === 0) return;
  headers["cookie"] = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(res) {
  let setCookies = [];
  if (typeof res.headers.getSetCookie === "function") setCookies = res.headers.getSetCookie();
  else {
    const sc = res.headers.get("set-cookie");
    if (sc) setCookies = [sc];
  }
  for (const sc of setCookies) {
    const pair = sc.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

// ---- HTTP --------------------------------------------------------------------
// Returns { status, body, text, location, headers }. `body` is parsed JSON when
// the response is JSON, else the raw text. Redirects are NOT followed (manual) so
// the web form flow can read the Location header.
export async function http(method, fullUrl, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  applyCookies(headers);
  let body;
  if (opts.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.form).toString();
  }
  const res = await fetch(fullUrl, { method, headers, body, redirect: "manual" });
  storeCookies(res);
  const text = await res.text();
  const ct = res.headers.get("content-type") || "";
  let parsed = text;
  if (ct.includes("application/json")) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  }
  return { status: res.status, body: parsed, text, location: res.headers.get("location"), headers: res.headers };
}

// Scrape the CSRF token off a rendered web page (the web form routes require it;
// the /api/seu mount is CSRF-exempt). Mirrors the repo's own web e2e helper.
export async function csrfFor(webPath) {
  const r = await http("GET", `${BASE}${webPath}`);
  const m = (r.text || "").match(/name="_csrf" value="([^"]+)"/);
  if (!m) throw new Error(`no _csrf token found on ${webPath} (status ${r.status}) — is the server up and NODE_ENV=test?`);
  return m[1];
}

// ---- runner ------------------------------------------------------------------
const stats = { pass: 0, fail: 0 };
const failures = [];
const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };

class Abort extends Error {}

export function section(title) {
  console.log(`\n${C.b}${title}${C.x}`);
}

// Soft assertion step: records pass/fail and lets the scenario continue.
export async function check(label, fn) {
  try {
    await fn();
    stats.pass++;
    console.log(`  ${C.g}✓${C.x} ${label}`);
  } catch (e) {
    stats.fail++;
    failures.push({ label, message: e.message });
    console.log(`  ${C.r}✗ ${label}${C.x}\n      ${C.d}${firstLine(e.message)}${C.x}`);
  }
}

// Hard setup step: on failure, aborts the current scenario (its later steps can't
// run) but the overall suite continues to the next scenario.
export async function must(label, fn) {
  try {
    const v = await fn();
    stats.pass++;
    console.log(`  ${C.g}✓${C.x} ${label}`);
    return v;
  } catch (e) {
    stats.fail++;
    failures.push({ label: `${label} [setup]`, message: e.message });
    console.log(`  ${C.r}✗ ${label} — setup failed, scenario aborted${C.x}\n      ${C.d}${firstLine(e.message)}${C.x}`);
    throw new Abort();
  }
}

export async function scenario(name, fn) {
  section(name);
  try {
    await fn();
  } catch (e) {
    if (!(e instanceof Abort)) {
      stats.fail++;
      failures.push({ label: `${name} [unexpected]`, message: e.message });
      console.log(`  ${C.r}✗ unexpected error: ${firstLine(e.message)}${C.x}`);
    }
  }
}

export function note(msg) {
  console.log(`  ${C.y}•${C.x} ${C.d}${msg}${C.x}`);
}

export function summary() {
  console.log(`\n${C.b}Summary:${C.x} ${C.g}${stats.pass} passed${C.x}, ${stats.fail ? C.r : C.d}${stats.fail} failed${C.x}`);
  if (failures.length) {
    console.log(`${C.b}Failures:${C.x}`);
    for (const f of failures) console.log(`  ${C.r}✗${C.x} ${f.label} — ${C.d}${firstLine(f.message)}${C.x}`);
  }
  if (stats.fail) process.exitCode = 1;
  return { ...stats };
}

function firstLine(s) {
  return String(s || "").split("\n")[0];
}
