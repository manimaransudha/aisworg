const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const MAX_BUMP_ATTEMPTS = 1000;

export function semverError(field: string, value: string | null | undefined): string | null {
  return SEMVER_RE.test(value ?? "") ? null : `${field} must be semver (x.y.z), got: "${value}"`;
}

export function isSemver(value: string | null | undefined): boolean {
  return SEMVER_RE.test(value ?? "");
}

export function bumpPatch(fromVersion: string): string {
  const err = semverError("version", fromVersion);
  if (err) throw new Error(err);
  const [major, minor, patch] = fromVersion.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

export function nextUnusedPatchVersion(fromVersion: string, taken: ReadonlySet<string>): string {
  let candidate = fromVersion;
  for (let attempts = 0; attempts < MAX_BUMP_ATTEMPTS; attempts++) {
    candidate = bumpPatch(candidate);
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`could not find an unused version after bumping from ${fromVersion}`);
}

export async function nextAvailablePatchVersion(fromVersion: string, isTaken: (candidate: string) => Promise<boolean> | boolean): Promise<string> {
  let candidate = fromVersion;
  for (let attempts = 0; attempts < MAX_BUMP_ATTEMPTS; attempts++) {
    candidate = bumpPatch(candidate);
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error(`could not find an unused version after bumping from ${fromVersion}`);
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
