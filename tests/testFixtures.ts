// Shared test-only fixture — NOT part of any production seed pipeline
// (seedSeu.ts, cleanSlate.ts). Several tests were written against
// template-web-application/profile-default-development, which used to be
// seeded ambiently by seedSeu.ts; db:clean-slate deliberately no longer
// recreates them (the intended path post-reset is authoring through the SDK
// UI, not a pre-seeded demo — see Database Clean Slate — Instructions.md).
// That's the right call for the real database, but it left these tests
// depending on ambient state nothing guarantees anymore.
//
// Fix: reuse the exact original seed data (web-application.template.json /
// default-development.profile.json — never deleted, only the DB rows were)
// via one idempotent, test-scoped helper, instead of each test file
// re-deriving its own throwaway Template and losing the specific shape
// (dependsOnCapabilityServiceCodes wiring, mandatoryPackCodes) some of these
// tests are specifically about. Safe to call from many test files/processes
// concurrently (upsert, not create) and safe to leave in place after a real
// db:clean-slate run — it recreates itself the next time tests run, the
// same way seedSdkAuthoringBootstrap.ts does for the SDK's own bootstrap
// rows.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import type { ProfileRow, TemplateDeliverableSeed, TemplateRow } from "../src/dblayer/seuTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "src", "dblayer", "seed", "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

interface TemplateSeed {
  code: string;
  name: string;
  requiredCapabilityCodes: string[];
  mandatoryPackCodes: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
}

interface ProfileSeed {
  code: string;
  name: string;
  baseTemplateCode: string;
  environment: string;
  configParameters: Record<string, unknown>;
  optionalPackCodes?: string[];
}

let cached: Promise<{ template: TemplateRow; profile: ProfileRow }> | null = null;

export function ensureWebAppTemplateFixture(): Promise<{ template: TemplateRow; profile: ProfileRow }> {
  // Memoized per test process — repeat calls within the same file (or via
  // Promise identity across files that happen to share a process) don't
  // re-run the upserts, but a second process (a separate `node --test` file
  // run) safely re-upserts the same rows.
  if (!cached) cached = seed();
  return cached;
}

async function seed(): Promise<{ template: TemplateRow; profile: ProfileRow }> {
  const templateSeed = loadJson<TemplateSeed>("web-application.template.json");
  const profileSeed = loadJson<ProfileSeed>("default-development.profile.json");

  const { data: template, error: templateErr } = await templatesDB.upsert({
    code: templateSeed.code,
    name: templateSeed.name,
    deliverableCatalogue: templateSeed.deliverableCatalogue,
  });
  if (templateErr || !template) throw templateErr ?? new Error(`template upsert failed: ${templateSeed.code}`);

  const { data: capabilities } = await capabilitiesDB.findByCodes(templateSeed.requiredCapabilityCodes);
  const capabilityIdByCode = new Map((capabilities ?? []).map((c) => [c.code, c.id]));
  const requiredCapabilityIds = templateSeed.requiredCapabilityCodes.map((code) => {
    const id = capabilityIdByCode.get(code);
    if (!id) throw new Error(`template ${templateSeed.code} requires unknown capability ${code}`);
    return id;
  });
  await templatesDB.setRequiredCapabilities(template.id, requiredCapabilityIds);
  await templatesDB.setMandatoryPacks(template.id, templateSeed.mandatoryPackCodes);

  const { data: profile, error: profileErr } = await profilesDB.upsert({
    code: profileSeed.code,
    name: profileSeed.name,
    baseTemplateId: template.id,
    environment: profileSeed.environment,
    configParameters: profileSeed.configParameters,
  });
  if (profileErr || !profile) throw profileErr ?? new Error(`profile upsert failed: ${profileSeed.code}`);
  await profilesDB.setOptionalPacks(profile.id, profileSeed.optionalPackCodes ?? []);

  return { template, profile };
}
