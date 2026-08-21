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
// 1a. Found later (owner, 2026-08-20, after a stray platform-core-
//    engineering@1.0.1 duplicate — created by earlier ad hoc reactivation
//    testing, never in scope for wipe/reseed — accumulated 506 junk policies
//    plus 460/575 junk compliance_frameworks/compliance_requirements, none
//    caught by any filter here): policies has the exact same "attributed to
//    a real base Pack" special case quality_gates already has — extended
//    with its own real-code allow-list (REAL_POLICY_CODES). compliance_
//    frameworks/compliance_requirements are wiped unconditionally — no real
//    seed data exists for either today (unlike capabilities/authority_rules,
//    a NULL originating_pack_id here means "dry-run fixture," not "real
//    migration-seeded vocabulary"). The stray duplicate Pack row itself was
//    deleted directly (not a clean-slate concern — clean-slate never creates
//    a *second* row for a base Pack; that only happens via manual/test
//    reactivation this script was never involved in).
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
// 4. schema_definitions (the "schema registry") was missing from the wipe
//    entirely. createSchemaVersion is INSERT-only, so every schema version
//    authored via the SDK UI persists forever — a real dev DB carried 157
//    stale versions above the migration-seeded baseline (156 of them for
//    TransitionDefinition). A minimum-clean DB holds exactly version 1 per
//    kind (seeded idempotently by 014/015/016); step 2e now trims to that.
//
// Everything runs inside one transaction — an unexpected FK conflict (e.g.
// from a table added by a migration since this script was last reviewed;
// see the instructions doc's own "keeping this in sync" triggers) rolls
// back cleanly instead of leaving the database half-wiped.
import "dotenv/config";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { seedIdentityBaseline } from "./seedIdentityBaseline.js";
import { seedTransitionDefinitions } from "./seedTransitionDefinitions.js";
import { seedAuthorityVocabulary } from "./seedAuthorityVocabulary.js";
import { seedCapabilityPatternPacks } from "./seedCapabilityPatternPacks.js";
import { seedSdlcPhasePacks } from "./seedSdlcPhasePacks.js";
import { seedSdlcStandardTemplates } from "./seedSdlcStandardTemplates.js";

// The "sdk-authoring-scope" placeholder Pack row (014_sdk_authoring.sql's own
// seed) is retired (owner, 2026-08-20 — deleted directly, along with the
// stray platform-core-engineering@1.0.1 duplicate and its ~1,500 rows of
// accumulated test-fixture policies/compliance frameworks/requirements
// wrongly attributed to it: "delete. they are seed data. we have better seed
// data now"). AUTHORING_SCOPE_PACK_CODE (domain/sdk/authoringScope.ts) is
// still a real, live constant — core/deliverables.ts compares a badge
// grant's scope_id against it directly as a string sentinel, no DB row
// required — but nothing needs a real Pack row to exist under that code any
// more (ensureAuthoringBadge, which used to validate against it, doesn't
// exist in the codebase any more either — the Creator/Approver badge family
// it guarded was itself retired by migration 043).
const BASE_PACK_CODES = ["platform-core-engineering", "technology-nodejs"];
const REAL_QUALITY_GATE_CODES = ["qg-deliverable-in-progress-to-approved", "qg-deliverable-approved-to-baselined"];
// Same special case as quality_gates (header comment) — policies' junk rows
// are ALSO attributed to a real base Pack (platform-core-engineering), not a
// throwaway one, so the pack-filter below doesn't catch them either. Found,
// 2026-08-20: 506 test-fixture policies (test-policy-blocking-*,
// test-standard-policy-*) had accumulated on one base-pack row and another
// 44 on the other, none caught by any existing filter. These 12 are the
// platform-core-engineering.pack.json's own real, seeded set.
const REAL_POLICY_CODES = [
  "policy-commission-baseline",
  "policy-deliverable-transition-baseline",
  "policy-objective-transition-baseline",
  "policy-obligation-transition-baseline",
  "policy-evidence-transition-baseline",
  "policy-knowledge-transition-baseline",
  "policy-decision-transition-baseline",
  "policy-knowledgescope-transition-baseline",
  "policy-attentionitem-transition-baseline",
  "policy-externalinteraction-transition-baseline",
  "policy-pack-transition-baseline",
  "policy-participant-transition-baseline",
];
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
    // wiped) FKs into templates/profiles, and deleting a Template/Profile
    // while a stale ebms row still referenced it would otherwise fail.
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

    // Step 1c — badge_grants. Bug fix (real regression, hit 3 times): a grant
    // is meaningless without the holder it names, but badge_grants.holder_id
    // is a polymorphic column (not an FK to users), so step 1b's CASCADE never
    // touches it — every grant survived a "clean slate" untouched. Combined
    // with RESTART IDENTITY resetting the users serial, a freshly-created user
    // could be assigned an id a PRE-RESET grant still names and silently
    // inherit authority (sometimes `root`) it never earned — exactly the
    // accountability failure this platform's own noun×verb model exists to
    // prevent. Same discipline step 5 already applies to transition_definitions
    // below ("wipe the accumulated graph, reseed fresh, self-healing"): wipe
    // every grant here; steps 4/6 (identity baseline + authority vocab
    // back-fill) reseed the real fixture grants fresh afterward.
    // CASCADE: commands.acting_badge_grant_id FKs into badge_grants —
    // Postgres's TRUNCATE FK-check is structural, not content-based, so this
    // is required even though step 1 (above) already emptied commands.
    await client.query("TRUNCATE TABLE badge_grants RESTART IDENTITY CASCADE");
    // Restore the ONE row this truncate takes out that nothing downstream
    // reseeds: 012_badge_model.sql's own idempotent `holder_id '1' -> root`
    // grant, which only runs during `migrate:seu` (not on every clean-slate)
    // — the step 1b comment above already documents every other piece of code
    // that assumes this row survives (NODE_ENV=test's auto-login shim acts as
    // actorId "1" directly, with no real login/badgeBootstrap to (re)grant it).
    // Without this, root's bypass vanishes and every test/dev session that
    // relies on it fails `authority_denied` platform-wide. Same exact INSERT
    // migration 012 uses.
    await client.query(`
      INSERT INTO badge_grants (holder_type, holder_id, badge_type)
      SELECT 'User', '1', 'root'
      WHERE NOT EXISTS (SELECT 1 FROM badge_grants WHERE holder_id = '1' AND badge_type = 'root')
    `);
    logger.info("[db:clean-slate] step 1c — truncated badge_grants (RESTART IDENTITY) and restored the holder '1' root grant; fixture grants reseeded in step 4.");

    // Step 2a — every Profile, then every Template (profiles first:
    // profiles.base_template_id -> templates is NO ACTION, so a surviving
    // profile would block deleting the template it points at if templates
    // went first). Cascades template_capabilities, template_packs,
    // profile_packs automatically (real ON DELETE CASCADE FKs, confirmed
    // against the schema). dependency_definitions (CR-039, migration 072;
    // CR-043, migration 074) does NOT cascade any more — its owner is
    // polymorphic (Template/Pack/Profile), which Postgres can't express as a
    // real FK, so Template/Profile-owned rows are deleted explicitly here
    // before their owner goes; Pack-owned rows are handled in step 2c below,
    // alongside non-base Pack deletion. Every Template's own rows are
    // re-materialised fresh from its own authored dependencyGraph by
    // seedSdlcStandardTemplates()'s own call to materialiseDependencyGraph in
    // step 7 anyway. No bootstrap-code exclusion any more: the SDK
    // authoring bootstrap Templates/Profiles were themselves deleted as
    // vestigial (owner, 2026-08-19 — sdkAuthoring.ts's own header already
    // called them out as unused by entity-direct authoring; the SDK UI's
    // "Create" action works directly off a fresh Draft row, not a lookup
    // against one of these) — nothing survives step 2a needing protection
    // any more. Matches the README's own claim: "a clean-slate database has
    // no commissionable Template."
    const dependencyDefsForTemplatesProfilesDeleted = await client.query(
      "DELETE FROM dependency_definitions WHERE owning_entity_type IN ('Template', 'Profile')"
    );
    const profilesDeleted = await client.query("DELETE FROM profiles");
    const templatesDeleted = await client.query("DELETE FROM templates");
    logger.info(
      `[db:clean-slate] step 2a — deleted ${dependencyDefsForTemplatesProfilesDeleted.rowCount} Template/Profile-owned dependency_definitions rows, ${profilesDeleted.rowCount} profiles, ${templatesDeleted.rowCount} templates.`
    );

    // Step 2b — vocabulary rows attributed to a non-base Pack. Order matters:
    // services must go before capabilities (services.providing_capability_id
    // is NO ACTION); quality_gates AND policies use a name-pattern/allow-list
    // filter instead of the pack filter alone (see header comment — their
    // junk rows are attributed to a real base Pack, not a throwaway one, so
    // the pack filter wouldn't catch them). originating_pack_id IS NULL rows
    // are always kept — real, migration-seeded vocabulary (the 4 SDK-
    // authoring Capabilities, 2 base Authority Rules), not Pack-attributable
    // junk.
    const qgDeleted = await client.query("DELETE FROM quality_gates WHERE code != ALL($1::text[])", [REAL_QUALITY_GATE_CODES]);
    const policiesDeleted = await client.query(
      `DELETE FROM policies
       WHERE originating_pack_id IS NOT NULL
         AND NOT (originating_pack_id IN (SELECT id FROM packs WHERE code = ANY($1::text[])) AND code = ANY($2::text[]))`,
      [BASE_PACK_CODES, REAL_POLICY_CODES]
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
    // compliance_requirements/compliance_frameworks (Ch.27, Phase 15) — found,
    // 2026-08-20, alongside the policies fix above: 575/460 junk rows had
    // accumulated on a base Pack id the same way, and the rest (the dry-run
    // suite's own "dryrun-fw-*" fixtures) carry NO Pack attribution at all
    // (originating_pack_id IS NULL) — unlike capabilities/authority_rules,
    // NULL here does NOT mean "real, migration-seeded": no seed file declares
    // any real Compliance Framework today, so there is nothing to protect.
    // Wiped unconditionally, same discipline transition_definitions' own
    // wipe uses — requirements before frameworks (FK). No reseed step exists
    // for either (nothing real to reseed); compliance_waivers/
    // compliance_evaluations are already empty by this point (CASCADEd from
    // step 1's own seus truncate).
    const complianceReqDeleted = await client.query("DELETE FROM compliance_requirements");
    const complianceFwDeleted = await client.query("DELETE FROM compliance_frameworks");
    logger.info(
      `[db:clean-slate] step 2b — deleted ${qgDeleted.rowCount} junk quality_gates, ${policiesDeleted.rowCount} policies, ${authorityRulesDeleted.rowCount} authority_rules, ${servicesDeleted.rowCount} services, ${capabilitiesDeleted.rowCount} capabilities, ${metricsDeleted.rowCount} metric_definitions, ${complianceReqDeleted.rowCount} compliance_requirements, ${complianceFwDeleted.rowCount} compliance_frameworks.`
    );

    // Step 2c — non-base Packs. Safe now: every table with a NO ACTION FK
    // into packs (authority_rules, capabilities, metric_definitions,
    // policies, quality_gates, services) has already been filtered above.
    // template_packs/profile_packs store the Pack's code as plain text, not
    // an FK (013_template_profile_pack_by_code.sql) — Pack deletion was
    // never blocked by them. dependency_definitions rows owned by a
    // non-base Pack (CR-043's polymorphic owner — no real FK, so these
    // would otherwise orphan silently rather than block or cascade) are
    // cleaned up first, same as step 2a does for Template/Profile owners —
    // no real Pack-owned rows exist today (nothing authors them yet), but
    // this keeps the invariant true once something does.
    const dependencyDefsForPacksDeleted = await client.query(
      "DELETE FROM dependency_definitions WHERE owning_entity_type = 'Pack' AND owning_entity_id NOT IN (SELECT id FROM packs WHERE code = ANY($1::text[]))",
      [BASE_PACK_CODES]
    );
    const packsDeleted = await client.query("DELETE FROM packs WHERE code != ALL($1::text[])", [BASE_PACK_CODES]);
    logger.info(`[db:clean-slate] step 2c — deleted ${dependencyDefsForPacksDeleted.rowCount} non-base-Pack-owned dependency_definitions rows, ${packsDeleted.rowCount} non-base packs.`);

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

    // Step 2e — the schema registry (schema_definitions). createSchemaVersion is
    // INSERT-only (never updates/deletes), so every schema version authored via
    // the SDK UI adds a row and lingers forever — test/dry-run authoring leaves
    // dozens-to-hundreds of stale versions (156 TransitionDefinition versions
    // observed on a real dev DB). The migration-seeded minimum is exactly version
    // 1 per kind (014/015/016, idempotent), which is what a "clean" DB should
    // hold. Trim back to it: delete every version > 1. FK-safe — the only table
    // referencing schema_definitions is deliverable_authoring_content, truncated
    // in step 1.
    const schemaVersionsDeleted = await client.query("DELETE FROM schema_definitions WHERE version > 1");
    logger.info(`[db:clean-slate] step 2e — trimmed ${schemaVersionsDeleted.rowCount} authored schema_definitions versions (kept version 1 per kind).`);

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

  // Step 3 — restore the identity baseline (tenants + users) captured from a
  // live dump, so a reset lands on a known identity state rather than an empty
  // auth table. Idempotent upserts; advances the users serial past the seeded
  // ids. Runs after the wipe (step 1b truncated users, step 2d the tenants).
  await seedIdentityBaseline();

  // Step 4 — CR-006 transition definitions: wipe the accumulated graph (incl.
  // test-fixture pollution) and reseed the fresh set from transitionDefinitions
  // .json. Atomic wipe+reseed inside the module. Must run BEFORE the vocabulary
  // seed, which back-fills `verb` onto these fresh rows.
  await seedTransitionDefinitions();

  // Step 5 — CR-006 authority vocabulary (nouns/verbs/mapping) + back-fill the
  // verb per transition. Atomic wipe+reseed; depends on step 4's fresh rows.
  await seedAuthorityVocabulary();

  // Step 6 — EPF/OpenUP capability-pattern Packs (owner, 2026-08-17). Must run
  // AFTER steps 4/5: publishing each Pack drives it through transitionEngine
  // (Draft -> Validated -> Published -> Active), which needs Pack's own
  // transition_definitions rows (step 4) and their back-filled verb (step 5)
  // to resolve — a real Pack publish always needs this ordering, not specific
  // to these six. Rerun-safe (publishPack is a no-op on an already-published
  // (code,version)).
  await seedCapabilityPatternPacks();

  // Step 7 — SDLC-phase Packs (owner, 2026-08-19: "design/fragments/sdlc-
  // templates-main ... map this into pack"). Same ordering reasoning as step
  // 6 — needs transition_definitions (step 4) and the back-filled verb (step
  // 5) to drive Draft -> Validated -> Published -> Active. Rerun-safe.
  await seedSdlcPhasePacks();

  // Step 8 — the 9 standard Templates (+ default Profiles), one per real
  // template-categories Ontology concept, drawing on step 7's Packs plus
  // platform-core-engineering. Must run AFTER step 7 (needs its Packs'
  // Capabilities to exist) — templatesDB.upsert/profilesDB.upsert are raw
  // upserts, not transitionEngine-driven, so no dependency on steps 4/5
  // themselves. Rerun-safe (upsert semantics).
  await seedSdlcStandardTemplates();

  logger.info("[db:clean-slate] done. Sanity-check next: hit /aisworg/seu/sdk/pack-authoring (Create starts a fresh Draft directly — no bootstrap Template needed) and /aisworg/seu/telemetry (zero Deliverables measured) as a real user.");
}

run()
  .catch((err) => {
    logger.error("[db:clean-slate] failed", err as Error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
