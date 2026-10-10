import { createRequire } from "node:module";
import { tenantsDB } from "../tenantsDB.js";
import { participantsMasterDB } from "../participantsMasterDB.js";
import { ontologyDB, type OntologyViewer } from "../ontologyDB.js";
import { bulkInsert } from "../../utils/db.js";
import { resolveOnboardingAdapter, listRegisteredOnboardingTypes } from "../../adapters/participantOnboardingRegistry.js";
import { logger } from "../../utils/logger.js";
import type { OnboardedParticipant } from "../../adapters/participantOnboardingAdapter.js";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

const TENANT_CODES = ["demo"];
const PARTICIPANTS_PER_TENANT_PER_TYPE = 5;

const CONCURRENCY = 8;

interface CanonicalSets {
  participantTypes: Set<string>;
  capabilityCodes: Set<string>;
  categoryPackDimensions: Set<string>;
  dimensionValues: Map<string, Set<string>>;
  behaviourContextPolicies: Set<string>;
  proficiencyLevels: Set<string>;
  authorisedRoles: Set<string>;
}

async function codesOf(conceptType: string, viewer: OntologyViewer): Promise<Set<string>> {
  const { data, error } = await ontologyDB.findConceptsByType(conceptType, viewer);
  console.log(`[codesOf] conceptType=${conceptType} viewer=${JSON.stringify(viewer)} error=${error ? String(error) : "none"} rows=${data?.length ?? "undefined"}`);
  return new Set((data ?? []).map((c) => c.code));
}

async function loadCanonicalSets(viewer: OntologyViewer): Promise<CanonicalSets> {
  const [participantTypes, capabilityCodes, categoryPackDimensions, behaviourContextPolicies, proficiencyLevels, authorisedRoles] = await Promise.all([
    codesOf("participant-types", viewer),
    codesOf("capability-name", viewer),
    codesOf("category:pack", viewer),
    codesOf("behaviour-context-policy", viewer),
    codesOf("proficiency-level", viewer),
    codesOf("authorised-role", viewer),
  ]);
  const dimensionValues = new Map<string, Set<string>>();
  await Promise.all(
    [...categoryPackDimensions].map(async (dimension) => {
      dimensionValues.set(dimension.toLowerCase(), await codesOf(dimension.toLowerCase(), viewer));
    })
  );
  return { participantTypes, capabilityCodes, categoryPackDimensions, dimensionValues, behaviourContextPolicies, proficiencyLevels, authorisedRoles };
}

function assertCanonicalLocal(conceptType: string, value: string, allowed: Set<string>): void {
  if (!allowed.has(value)) {
    throw new Error(`"${value}" is not a canonical ${conceptType} concept. Allowed: ${[...allowed].join(", ") || "(none registered)"}`);
  }
}

function validateOnboarded(type: string, onboarded: OnboardedParticipant, canon: CanonicalSets): void {
  assertCanonicalLocal("participant-types", type, canon.participantTypes);
  for (const code of onboarded.capabilities) assertCanonicalLocal("capability-name", code, canon.capabilityCodes);
  for (const [dimension, entries] of Object.entries(onboarded.competency)) {
    assertCanonicalLocal("category:pack", dimension, canon.categoryPackDimensions);
    const valueSet = canon.dimensionValues.get(dimension.toLowerCase()) ?? new Set();
    for (const entry of entries) {
      assertCanonicalLocal(dimension.toLowerCase(), entry.code, valueSet);
      assertCanonicalLocal("proficiency-level", entry.proficiency, canon.proficiencyLevels);
    }
  }
  for (const entry of onboarded.behaviourContext) assertCanonicalLocal("behaviour-context-policy", entry.policy, canon.behaviourContextPolicies);
  for (const entry of onboarded.authorisedRole) assertCanonicalLocal("authorised-role", entry.role, canon.authorisedRoles);
}

async function runWithConcurrency<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function runOne(): Promise<void> {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, runOne));
}

export async function seedParticipantsMaster(): Promise<void> {
  let created = 0;
  let usersCreated = 0;
  const types = listRegisteredOnboardingTypes();
  const humanPasswordHash = await bcrypt.hash("password", 12);

  for (const code of TENANT_CODES) {
    const { data: tenant } = await tenantsDB.findByCode(code);
    if (!tenant) {
      logger.error(`[seedParticipantsMaster] tenant "${code}" not found — run seedIdentityBaseline first`);
      continue;
    }

    const viewer: OntologyViewer = { isRoot: false, tenantId: tenant.id };
    const canon = await loadCanonicalSets(viewer);

    for (const type of types) {
      const adapter = resolveOnboardingAdapter(type);
      const seeds = Array.from({ length: PARTICIPANTS_PER_TENANT_PER_TYPE }, (_, i) => i);
      const rows: Parameters<typeof participantsMasterDB.createMany>[0] = [];
      const humanEmails: (string | null)[] = [];

      await runWithConcurrency(seeds, async (i) => {
        const onboarded = await adapter.onboard({ tenantId: tenant.id, tenantLabel: tenant.name, seed: i });
        validateOnboarded(type, onboarded, canon);

        rows.push({
          tenantId: tenant.id,
          type,
          displayName: onboarded.displayName,
          capabilities: onboarded.capabilities,
          competency: onboarded.competency,
          cost: onboarded.cost,
          behaviourContext: onboarded.behaviourContext,
          authorisedRole: onboarded.authorisedRole,
          isActive: true,
          userId: onboarded.userId ?? null,
        });
        humanEmails.push(type === "Human" ? `human-${i + 1}@${code.toLowerCase()}.com` : null);
      });

      if (type === "Human") {
        const userRows = rows.map((row, idx) => [
          humanEmails[idx],
          row.displayName,
          "local",
          true,
          false,
          "Tenant",
          tenant.id,
          humanPasswordHash,
        ]);
        const { rows: insertedUsers } = await bulkInsert(
          "users",
          ["email", "name", "auth_provider", "is_active", "is_protected", "type", "tenant_id", "password_hash"],
          userRows
        );
        const createdUsers = insertedUsers as unknown as Array<{ email: string; id: string }>;
        usersCreated += createdUsers.length;
        const userIdByEmail = new Map<string, string>(createdUsers.map((u) => [u.email, u.id]));
        rows.forEach((row, idx) => {
          row.userId = userIdByEmail.get(humanEmails[idx] as string) ?? null;
        });
      }

      const { data, error } = await participantsMasterDB.createMany(rows);
      if (error) throw error;
      created += data.length;
    }
  }

  logger.info(`[seedParticipantsMaster] seeded ${created} participants_master rows across ${TENANT_CODES.length} tenants x ${types.length} Participant Types (${usersCreated} Human rows also got a real login user, password "password").`);
}
