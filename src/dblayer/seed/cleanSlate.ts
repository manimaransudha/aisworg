// Database Clean Slate — Instructions for the Other Session
// (design/mvp-build-plan/Database Clean Slate — Instructions.md).
//
// Wipes demo/usage data and test-fixture pollution while leaving the
// platform in exactly the state it needs to be in for the SDK UI and every
// governed entity type to work immediately afterward. Run:
//   pnpm db:clean-slate
//
// Reviewed against the live schema before writing this (not assumed from
// the instructions doc alone) — three things the doc didn't account for,
// verified directly against information_schema and real row counts:
//
// 1. The "survive wholesale" vocabulary tables (capabilities, services,
//    authority_rules, policies, quality_gates, metric_definitions) are not
//    actually clean. 817 distinct Pack codes exist, not the 2 base ones —
//    hundreds of test-fixture Packs (sdk-test-pack-flatbadge-*, test-pack-*,
//    test-conflict-*, test-reactivate-supersede-*, plus real ones like
//    domain-ebook-library) have contributed real rows into these tables via
//    a NO ACTION originating_pack_id FK. Deleting every non-base Pack (as
//    the instructions ask) fails outright on the first such row unless
//    these six tables are also filtered down first. Resolved per Sudha's
//    own framing: "keep the ones that are basic which would otherwise cause
//    app breakdown" — keep a row if originating_pack_id IS NULL (the 4 SDK-
//    authoring Capabilities, 2 base Authority Rules — real, seeded directly
//    by migrations, not through a Pack) OR belongs to one of the 2 base
//    Packs; delete everything else. quality_gates is a special case within
//    this: its 105 junk rows (of 107) are attributed to a *real* base Pack
//    id (test fixtures reuse a real pack id for convenience rather than
//    creating throwaway Packs), so the pack-filter doesn't catch them —
//    kept the instructions doc's own name-pattern filter for this one table.
//    metric_definitions was never Pack-attributed at all (all NULL-origin,
//    including its 14 junk rows) — filtered by identifier allow-list
//    instead. transition_definitions is NO LONGER left untouched (CR-006):
//    it accumulates hundreds of test-fixture rows (StdFrom-*/PolFrom-*/
//    policy-waiver-from-*), so it is now WIPED and reseeded fresh from
//    transitionDefinitions.json by seedTransitionDefinitions() (a reseed step
//    below), landing on exactly the seeded graph. The authority rules/policies
//    those rows reference all survive the vocabulary-table filtering above
//    (base-pack-attributed or migration-seeded), so the reseed resolves every
//    code. The verb column is then back-filled by seedAuthorityVocabulary().
//
// 2. dependency_edges (13,326 rows) and ebms (3,347 rows) were missing from
//    the instructions doc's wipe list entirely — both real usage data, both
//    with NO ACTION FKs that block the seus/deliverables/templates/profiles
//    wipe if left behind. Added to the usage-data TRUNCATE.
//
// 3. app_config is not part of this platform — Donchian-channel/trading
//    config for a different application sharing this Postgres schema
//    (seeded in the base schema.sql, not any SEU migration; owned by a
//    different table-owner role than every SEU-platform table). Never
//    touched here — genuinely borrowed infrastructure this platform doesn't
//    manage. NOTE: `users` was ALSO once excluded on this rationale, but that
//    was wrong — `users` lives only in the `aisworg` database and is this
//    platform's own auth table; the other app's accounts are in a SEPARATE
//    `endow` database (Postgres-isolated). Since clean-slate is dev/test-only,
//    users are now wiped in step 1b (the god user re-seeds on next login).
//
// Everything runs inside one transaction — an unexpected FK conflict (e.g.
// from a table added by a migration since this script was last reviewed;
// see the instructions doc's own "keeping this in sync" triggers) rolls
// back cleanly instead of leaving the database half-wiped.
import "dotenv/config";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { seedSdkAuthoringBootstrap } from "./seedSdkAuthoringBootstrap.js";
import { seedIdentityBaseline } from "./seedIdentityBaseline.js";
import { seedTransitionDefinitions } from "./seedTransitionDefinitions.js";
import { seedAuthorityVocabulary } from "./seedAuthorityVocabulary.js";
import { AUTHORING_SCOPE_PACK_CODE } from "../../domain/sdk/authoringScope.js";

// Real gap found running the Ebook Library demo walkthrough on a database
// this script had already cleaned: AUTHORING_SCOPE_PACK_CODE
// ("sdk-authoring-scope") is the placeholder Pack ensureAuthoringBadge
// validates new Creator/Approver grants against (014_sdk_authoring.sql's own
// seed) — contributes nothing (`contributions: {}`), so it was never a
// vocabulary source, but it's still a real, load-bearing row. Missing it
// didn't break this run only because root's grants predate the reset and
// short-circuit the check; any genuinely new identity's first SDK UI action
// would hit a hard failure without it.
const BASE_PACK_CODES = ["platform-core-engineering", "technology-nodejs", AUTHORING_SCOPE_PACK_CODE];
const BOOTSTRAP_TEMPLATE_CODES = ["sdk-authoring-pack", "sdk-authoring-template", "sdk-authoring-profile", "sdk-authoring-transition-definition"];
const BOOTSTRAP_PROFILE_CODES = BOOTSTRAP_TEMPLATE_CODES.map((c) => `${c}-profile`);
const REAL_QUALITY_GATE_CODES = ["qg-deliverable-in-progress-to-approved", "qg-deliverable-approved-to-baselined"];
const REAL_METRIC_IDENTIFIERS = [
  "deliverable-cycle-time",
  "quality-gate-latency",
  "command-generation-rate",
  "dispatch-latency",
  "work-item-duration",
  "knowledge-growth",
  "evidence-generation",
  "rework-rate",
  "deliverable-acceptance-rate",
];

// Every table hanging off seus/deliverables/objectives/participants, in one
// multi-table TRUNCATE ... CASCADE — Postgres resolves the full dependency
// closure across every table named in a single statement regardless of
// individual FK delete_rule or the order listed here, and CASCADE only
// pulls in tables that reference these — verified against the full FK dump
// that nothing outside this set does.
const USAGE_DATA_TABLES = [
  "quality_gate_evaluations",
  "work_items",
  "commands",
  "events",
  "external_interactions",
  "attention_items",
  "decisions",
  "knowledge_items",
  "evidence",
  "obligations",
  "capability_fulfilments",
  "seu_capabilities",
  "participants",
  "dependency_edges",
  "deliverable_authoring_content",
  "deliverables",
  "ebms",
  "objective_capabilities",
  "objectives",
  "seus",
];

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Step 1 — usage/instance data. Must run before step 2: ebms (just
    // wiped) FKs into templates/profiles, and deleting a non-bootstrap
    // Template/Profile while a stale ebms row still referenced it would
    // otherwise fail.
    await client.query(`TRUNCATE TABLE ${USAGE_DATA_TABLES.join(", ")} CASCADE`);
    logger.info(`[db:clean-slate] step 1 — truncated ${USAGE_DATA_TABLES.length} usage-data tables.`);

    // Step 1b — users. clean-slate is a dev/test-only reset (never run in
    // production), so every account goes: real usage data, not a fixture. The
    // god identity (SUPERUSER_EMAIL) is re-created automatically on the next
    // login — passportConfig upserts the row and badgeBootstrap grants it root
    // — so nothing needs preserving here. RESTART IDENTITY resets the serial so
    // that first login comes back as id 1, matching the NODE_ENV=test
    // auto-login shim and the holder_id '1' root grant 012_badge_model seeds.
    // CASCADE covers the requested_by / user_id FKs (objectives, seus, commands,
    // participants, attestations) — all already emptied in step 1. NOTE: this
    // `users` table lives ONLY in the `aisworg` database; the other app's users
    // are in a SEPARATE `endow` database (Postgres-isolated), so wiping here
    // cannot touch them — the older "shared infrastructure" note (below, on
    // app_config) does NOT apply to users.
    await client.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
    logger.info("[db:clean-slate] step 1b — truncated users (RESTART IDENTITY); god user re-created on next login.");

    // Step 2a — non-bootstrap Profiles, then Templates (profiles first:
    // profiles.base_template_id -> templates is NO ACTION, so a surviving
    // non-bootstrap profile would block deleting the template it points at
    // if templates went first). Cascades template_capabilities,
    // template_packs, profile_packs automatically (real ON DELETE CASCADE
    // FKs, confirmed against the schema).
    const profilesDeleted = await client.query("DELETE FROM profiles WHERE code != ALL($1::text[])", [BOOTSTRAP_PROFILE_CODES]);
    const templatesDeleted = await client.query("DELETE FROM templates WHERE code != ALL($1::text[])", [BOOTSTRAP_TEMPLATE_CODES]);
    logger.info(`[db:clean-slate] step 2a — deleted ${profilesDeleted.rowCount} non-bootstrap profiles, ${templatesDeleted.rowCount} non-bootstrap templates.`);

    // Step 2b — vocabulary rows attributed to a non-base Pack. Order matters:
    // services must go before capabilities (services.providing_capability_id
    // is NO ACTION); quality_gates uses a name-pattern filter instead of the
    // pack filter (see header comment — its junk rows are attributed to a
    // real base Pack, not a throwaway one, so the pack filter wouldn't catch
    // them). originating_pack_id IS NULL rows are always kept — real,
    // migration-seeded vocabulary (the 4 SDK-authoring Capabilities, 2 base
    // Authority Rules), not Pack-attributable junk.
    const qgDeleted = await client.query("DELETE FROM quality_gates WHERE code != ALL($1::text[])", [REAL_QUALITY_GATE_CODES]);
    const policiesDeleted = await client.query(
      "DELETE FROM policies WHERE originating_pack_id IS NOT NULL AND originating_pack_id NOT IN (SELECT id FROM packs WHERE code = ANY($1::text[]))",
      [BASE_PACK_CODES]
    );
    const authorityRulesDeleted = await client.query(
      "DELETE FROM authority_rules WHERE originating_pack_id IS NOT NULL AND originating_pack_id NOT IN (SELECT id FROM packs WHERE code = ANY($1::text[]))",
      [BASE_PACK_CODES]
    );
    const servicesDeleted = await client.query(
      "DELETE FROM services WHERE originating_pack_id IS NOT NULL AND originating_pack_id NOT IN (SELECT id FROM packs WHERE code = ANY($1::text[]))",
      [BASE_PACK_CODES]
    );
    const capabilitiesDeleted = await client.query(
      "DELETE FROM capabilities WHERE originating_pack_id IS NOT NULL AND originating_pack_id NOT IN (SELECT id FROM packs WHERE code = ANY($1::text[]))",
      [BASE_PACK_CODES]
    );
    const metricsDeleted = await client.query("DELETE FROM metric_definitions WHERE identifier != ALL($1::text[])", [REAL_METRIC_IDENTIFIERS]);
    logger.info(
      `[db:clean-slate] step 2b — deleted ${qgDeleted.rowCount} junk quality_gates, ${policiesDeleted.rowCount} policies, ${authorityRulesDeleted.rowCount} authority_rules, ${servicesDeleted.rowCount} services, ${capabilitiesDeleted.rowCount} capabilities, ${metricsDeleted.rowCount} metric_definitions.`
    );

    // Step 2c — non-base Packs. Safe now: every table with a NO ACTION FK
    // into packs (authority_rules, capabilities, metric_definitions,
    // policies, quality_gates, services) has already been filtered above.
    // template_packs/profile_packs store the Pack's code as plain text, not
    // an FK (013_template_profile_pack_by_code.sql) — Pack deletion was
    // never blocked by them.
    const packsDeleted = await client.query("DELETE FROM packs WHERE code != ALL($1::text[])", [BASE_PACK_CODES]);
    logger.info(`[db:clean-slate] step 2c — deleted ${packsDeleted.rowCount} non-base packs.`);

    // Step 2d — non-reserved Tenants (and everything FK-bound to them). The
    // reserved tenants are fixtures that must survive: 'default' (commissioning
    // fallback), plus CR-004's 'platform' (Platform-user home) and 'demo'
    // (Google-OAuth sandbox). Extra tenants come from the dry-run suite or
    // manual creation and otherwise linger in every tenant dropdown. All tenant
    // FKs are RESTRICT (no ON DELETE CASCADE), so each dependent is cleared
    // first, in FK order, before the tenants themselves. Rows scoped to the
    // reserved tenants survive (config).
    const RESERVED_TENANT_CODES = ["default", "platform", "demo"];
    const { rows: reservedRows } = await client.query("SELECT id FROM tenants WHERE code = ANY($1::text[])", [RESERVED_TENANT_CODES]);
    const reservedIds = reservedRows.map((r) => r.id as string);
    if (!reservedIds.length) {
      throw new Error("no reserved tenant found — migrations seed 'default'/'platform'/'demo'; refusing to wipe the tenants table without a survivor. Rolling back.");
    }
    await client.query("DELETE FROM tenant_contracts WHERE tenant_id <> ALL($1::uuid[])", [reservedIds]);
    await client.query("DELETE FROM execution_targets WHERE tenant_id IS NOT NULL AND tenant_id <> ALL($1::uuid[])", [reservedIds]);
    await client.query("DELETE FROM tenant_concept_aliases WHERE tenant_id <> ALL($1::uuid[])", [reservedIds]);
    // Tenant-added badge variants/tiers (Layer-2/3) reference a tenant; the
    // Platform-recommended defaults (tenant_id IS NULL) are vocabulary and stay.
    await client.query("DELETE FROM badge_tiers WHERE tenant_id IS NOT NULL AND tenant_id <> ALL($1::uuid[])", [reservedIds]);
    await client.query("DELETE FROM badge_types WHERE tenant_id IS NOT NULL AND tenant_id <> ALL($1::uuid[])", [reservedIds]);
    const tenantsDeleted = await client.query("DELETE FROM tenants WHERE id <> ALL($1::uuid[])", [reservedIds]);
    logger.info(`[db:clean-slate] step 2d — deleted ${tenantsDeleted.rowCount} non-reserved tenants (+ their contracts, execution targets, aliases, badge variants).`);

    // NOTE (CR-006): transition_definitions and the authority vocabulary
    // (nouns/verbs/mapping) are NOT wiped here in the main transaction — the
    // reseed steps below own them, each rebuilding fresh with an atomic
    // wipe+reseed of its own (so the app-critical transition graph is never
    // left empty between a wipe and its reseed).

    // Sanity check before committing (per the instructions doc's own step 4
    // discipline, moved earlier so a real problem rolls back instead of
    // landing): composition only ever includes Active Packs — if neither
    // base Pack has a surviving Active version, every future commissioning
    // silently excludes it instead of failing loudly.
    const { rows: activeBasePacks } = await client.query("SELECT code FROM packs WHERE code = ANY($1::text[]) AND status = 'Active'", [BASE_PACK_CODES]);
    const activeCodes = new Set(activeBasePacks.map((r) => r.code as string));
    const missingActive = BASE_PACK_CODES.filter((c) => !activeCodes.has(c));
    if (missingActive.length > 0) {
      throw new Error(`no Active version survived for: ${missingActive.join(", ")} — composition would silently exclude ${missingActive.length === 1 ? "it" : "them"} for every future commissioning. Rolling back.`);
    }

    await client.query("COMMIT");
    logger.info("[db:clean-slate] committed.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Step 3 — self-healing bootstrap reseed (upsert semantics, safe even
  // though step 2a already excluded these codes by construction).
  await seedSdkAuthoringBootstrap();

  // Step 4 — restore the identity baseline (tenants + users) captured from a
  // live dump, so a reset lands on a known identity state rather than an empty
  // auth table. Idempotent upserts; advances the users serial past the seeded
  // ids. Runs after the wipe (step 1b truncated users, step 2d the tenants).
  await seedIdentityBaseline();

  // Step 5 — CR-006 transition definitions: wipe the accumulated graph (incl.
  // test-fixture pollution) and reseed the fresh set from transitionDefinitions
  // .json. Atomic wipe+reseed inside the module. Must run BEFORE the vocabulary
  // seed, which back-fills `verb` onto these fresh rows.
  await seedTransitionDefinitions();

  // Step 6 — CR-006 authority vocabulary (nouns/verbs/mapping) + back-fill the
  // verb per transition. Atomic wipe+reseed; depends on step 5's fresh rows.
  await seedAuthorityVocabulary();
  logger.info("[db:clean-slate] done. Sanity-check next: hit /aisworg/seu/sdk/pack-authoring (bootstrap Templates survived) and /aisworg/seu/telemetry (zero Deliverables measured) as a real user.");
}

run()
  .catch((err) => {
    logger.error("[db:clean-slate] failed", err as Error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
