// CR-098 — cleanSlate calls the onboarding adapter registry
// (src/adapters/participantOnboardingRegistry.ts), not a hardcoded generator
// — owner: "clean-slate has to call the adapter. But the adapter has to be
// an 'adapter'. For every client deployment this will change to integrate
// with their specific details." This file is pure orchestration: for every
// tenant and every registered Participant Type, resolve that type's adapter,
// ask it to onboard 500 participants, and write each one to participants_master.
//
// 50 per tenant PER Participant Type (owner: "the 150 rows... is human
// participants seed. Similarly other participant types have to be seeded
// across the tenants") — originally 3 demo tenants x 4 types x 50 = 600
// participants_master rows.
//
// Update — "platform"/"demo"/"default" added (owner: "Add Default Tenant"
// (and "Demo", and "Platform") to tenant codes"). Found live: a SEU
// commissioned under "Default Tenant" had zero eligible Participants for
// every Capability, completely independent of any competency filtering —
// that tenant (along with "demo"/"platform") had never been given any
// participants_master rows at all, only the 3 "AI-Native" demo tenants
// were. Now 6 tenants x 4 types x 500 = 12,000 participants_master rows
// (raised from 50 — the Ontology-backed capability-name/domain/technology
// vocabulary mockOnboardingData.ts now cycles through is much larger than
// the old hardcoded 23-code list, so 50 seeds no longer reached every code).
//
// Owner: don't pay createParticipantMaster's assertCanonicalCategory cost
// (a live DB round trip per field, ~9-10 per row) on every one of these rows
// — the mocks already only ever produce codes sourced straight from the
// Ontology (mockOnboardingData.ts), so per-row live validation is redundant
// here. Instead: load each canonical set ONCE per tenant (loadCanonicalSets
// below) and check membership against those in-memory sets, then write
// straight through participantsMasterDB.create — bypassing
// createParticipantMaster (and assertCanonicalCategory) entirely for this
// bulk path only. Every other caller (real onboarding adapters via routes,
// admin actions) still goes through createParticipantMaster's live,
// always-current validation unchanged.
import { tenantsDB } from "../tenantsDB.js";
import { participantsMasterDB } from "../participantsMasterDB.js";
import { ontologyDB, type OntologyViewer } from "../ontologyDB.js";
import { resolveOnboardingAdapter, listRegisteredOnboardingTypes } from "../../adapters/participantOnboardingRegistry.js";
import { logger } from "../../utils/logger.js";
import type { OnboardedParticipant } from "../../adapters/participantOnboardingAdapter.js";

// const TENANT_CODES = ["platform", "demo", "default", "Athens", "Babylon", "Cambodia"];
const TENANT_CODES = ["default"];
const PARTICIPANTS_PER_TENANT_PER_TYPE = 500;

// Still bounded — participantsMasterDB.create is one query per row (the
// per-field Ontology round trips are gone), but 12,000 rows sequential is
// still slower than needed, and this keeps the pool from starving cleanSlate's
// surrounding steps (utils/db.js MAX_CONNECTIONS).
const CONCURRENCY = 8;

interface CanonicalSets {
  participantTypes: Set<string>;
  capabilityCodes: Set<string>;
  categoryPackDimensions: Set<string>;
  dimensionValues: Map<string, Set<string>>; // lower-cased dimension -> its concept type's codes
  behaviourContextPolicies: Set<string>;
}

async function codesOf(conceptType: string, viewer: OntologyViewer): Promise<Set<string>> {
  const { data } = await ontologyDB.findConceptsByType(conceptType, viewer);
  return new Set((data ?? []).map((c) => c.code));
}

// Mirrors exactly what createParticipantMaster's assertCanonicalCategory
// calls would have looked up (core/ontology.ts / core/participantsMaster.ts)
// — same 4 concept types, fetched once instead of once per participant.
async function loadCanonicalSets(viewer: OntologyViewer): Promise<CanonicalSets> {
  const [participantTypes, capabilityCodes, categoryPackDimensions, behaviourContextPolicies] = await Promise.all([
    codesOf("participant-types", viewer),
    codesOf("capability-name", viewer),
    codesOf("category:pack", viewer),
    codesOf("behaviour-context-policy", viewer),
  ]);
  const dimensionValues = new Map<string, Set<string>>();
  await Promise.all(
    [...categoryPackDimensions].map(async (dimension) => {
      dimensionValues.set(dimension.toLowerCase(), await codesOf(dimension.toLowerCase(), viewer));
    })
  );
  return { participantTypes, capabilityCodes, categoryPackDimensions, dimensionValues, behaviourContextPolicies };
}

function assertCanonicalLocal(conceptType: string, value: string, allowed: Set<string>): void {
  if (!allowed.has(value)) {
    throw new Error(`"${value}" is not a canonical ${conceptType} concept. Allowed: ${[...allowed].join(", ") || "(none registered)"}`);
  }
}

function validateOnboarded(type: string, onboarded: OnboardedParticipant, canon: CanonicalSets): void {
  assertCanonicalLocal("participant-types", type, canon.participantTypes);
  for (const code of onboarded.capabilities) assertCanonicalLocal("capability-name", code, canon.capabilityCodes);
  for (const [dimension, values] of Object.entries(onboarded.competency)) {
    assertCanonicalLocal("category:pack", dimension, canon.categoryPackDimensions);
    const valueSet = canon.dimensionValues.get(dimension.toLowerCase()) ?? new Set();
    for (const value of values) assertCanonicalLocal(dimension.toLowerCase(), value, valueSet);
  }
  for (const entry of onboarded.behaviourContext) assertCanonicalLocal("behaviour-context-policy", entry.policy, canon.behaviourContextPolicies);
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
  const types = listRegisteredOnboardingTypes();

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

      await runWithConcurrency(seeds, async (i) => {
        // tenant.name, not the raw lookup `code` — reads correctly in the
        // generated displayName ("Platform Human Participant 1 (...)", not
        // "platform Human Participant 1 (...)") now that lowercase codes
        // (platform/demo/default) are in the mix alongside the proper-noun
        // ones (Athens/Babylon/Cambodia).
        const onboarded = await adapter.onboard({ tenantId: tenant.id, tenantLabel: tenant.name, seed: i });
        validateOnboarded(type, onboarded, canon);

        rows.push({
          tenantId: tenant.id,
          type,
          displayName: onboarded.displayName,
          capabilities: onboarded.capabilities,
          competency: onboarded.competency,
          behaviourContext: onboarded.behaviourContext,
          isActive: true,
          userId: onboarded.userId ?? null,
        });
      });

      const { data, error } = await participantsMasterDB.createMany(rows);
      if (error) throw error;
      created += data.length;
    }
  }

  logger.info(`[seedParticipantsMaster] seeded ${created} participants_master rows across ${TENANT_CODES.length} tenants x ${types.length} Participant Types.`);
}
