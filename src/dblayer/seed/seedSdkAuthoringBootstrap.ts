// Database Clean Slate — Instructions ("The one real finding that shapes
// everything below"). Neither run.ts's migrations nor seedSeu.ts create the
// four bootstrap Templates/Profiles the SDK UI's "Create" action depends on
// (sdkAuthoring.ts's startAuthoring looks them up by code and throws if
// missing) — they were created ad hoc while that authoring surface was being
// built, with no repeatable seed path. This closes that gap permanently:
// upsert semantics (templatesDB.upsert/profilesDB.upsert), safe to run any
// time, not just once — standalone, same "not part of the regular pipeline"
// shape as seedEbookLibraryPilot.ts. Reuses sdkAuthoring.ts's own exported
// constants (BOOTSTRAP_TEMPLATE_CODE, bootstrapProfileCode,
// AUTHORING_CAPABILITY_CODE, AUTHORING_CATEGORY) so this can't drift from
// what sdkAuthoring.ts actually looks up.
//
// Run standalone: npx tsx src/dblayer/seed/seedSdkAuthoringBootstrap.ts
// Also called as step 3 of cleanSlate.ts.
import "dotenv/config";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { templatesDB } from "../templatesDB.js";
import { profilesDB } from "../profilesDB.js";
import { BOOTSTRAP_TEMPLATE_CODE, bootstrapProfileCode, AUTHORING_CAPABILITY_CODE, AUTHORING_CATEGORY } from "../../routes/seu/core/sdkAuthoring.js";
import type { SchemaDefinitionEntityKind } from "../seuTypes.js";

const KINDS: SchemaDefinitionEntityKind[] = ["Pack", "Template", "Profile", "TransitionDefinition"];

export async function seedSdkAuthoringBootstrap(): Promise<void> {
  for (const kind of KINDS) {
    const templateCode = BOOTSTRAP_TEMPLATE_CODE[kind];
    // Matches the shape of the 8 rows this replaces exactly (confirmed
    // against the live rows before writing this): one Deliverable Catalogue
    // entry, code = lowercased kind + "-definition" (e.g. "pack-definition",
    // "transitiondefinition-definition" — the raw kind name, not
    // hand-spaced), producing the kind's own authoring Capability.
    const { data: template, error: templateErr } = await templatesDB.upsert({
      code: templateCode,
      name: `${kind} Authoring (bootstrap)`,
      deliverableCatalogue: [
        {
          code: `${kind.toLowerCase()}-definition`,
          name: `${kind} Definition`,
          category: AUTHORING_CATEGORY[kind],
          producingCapabilityCode: AUTHORING_CAPABILITY_CODE[kind],
        },
      ],
    });
    if (templateErr || !template) throw templateErr ?? new Error(`bootstrap template upsert failed: ${templateCode}`);
    logger.info(`[seed:sdk-authoring-bootstrap] template ${template.code} -> ${template.id}`);

    const profileCode = bootstrapProfileCode(kind);
    const { data: profile, error: profileErr } = await profilesDB.upsert({
      code: profileCode,
      name: `${kind} Authoring (bootstrap profile)`,
      baseTemplateId: template.id,
      environment: "platform",
    });
    if (profileErr || !profile) throw profileErr ?? new Error(`bootstrap profile upsert failed: ${profileCode}`);
    logger.info(`[seed:sdk-authoring-bootstrap] profile ${profile.code} -> ${profile.id}`);
  }
  logger.info("[seed:sdk-authoring-bootstrap] done.");
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedSdkAuthoringBootstrap()
    .catch((err) => {
      logger.error("[seed:sdk-authoring-bootstrap] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
