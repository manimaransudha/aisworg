import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { PLATFORM_TENANT_ID } from "./constants.js";
import { schemaDefinitionsDB } from "./schemaDefinitionsDB.js";
import { validateProfileWriteAgainstSchema } from "../routes/seu/core/profileWriteValidator.js";
import type { DbResult, ProfileRow } from "./seuTypes.js";

// Also owns profile_packs — Profile owns everything selectable/optional on top
// of the Template's mandatory set (Build Plan §5 item 6).
//
// Profile identity foundation (owner, 2026-08-19): "19.2 and 19.3 has to be
// fixed similar to pack and template" — (code, profile_version, tenant_id) is
// the real identity now (migration 064), mirroring templatesDB.ts's own
// CR-024/CR-026 shape exactly. category (also migration 064) is Profile's
// own §8 field, kept separate from `code` (see the migration's own comment
// on why) — not part of identity, just another authored column.
export const profilesDB = {
  // CR-091 Part 2/Part 3 — configParameters/category both dropped from every
  // write path below. Neither the profiles.config_parameters nor
  // profiles.category DATABASE COLUMN is touched by this (owner: "do not
  // delete. But do not use them") — they simply stop being written to by any
  // new row from here on; existing historical values sit there untouched.
  // `status` defaults to 'Active' HERE, explicitly — not by relying on the
  // column's own DEFAULT (which is 'Draft' as of migration 185b, matching
  // Pack/Template). This is the raw "already-published catalog entry"
  // DB-layer helper — direct test fixtures across the suite call it
  // expecting an immediately-usable Active row with no lifecycle walk, and
  // that stays true. publishProfile (core/profiles.ts) no longer calls this
  // at all — it creates a real Draft (createDraft) and walks it forward.
  async upsert(input: {
    code: string;
    name: string;
    baseTemplateId: string;
    environment?: string;
    profileVersion?: string;
    tenantId?: string;
    status?: ProfileRow["status"];
  }): Promise<DbResult<ProfileRow>> {
    try {
      const { rows } = await query<ProfileRow>(
        `INSERT INTO profiles (code, name, base_template_id, environment, profile_version, tenant_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (code, profile_version, tenant_id) DO UPDATE
           SET name = EXCLUDED.name, base_template_id = EXCLUDED.base_template_id,
               environment = EXCLUDED.environment
         RETURNING *`,
        [
          input.code,
          input.name,
          input.baseTemplateId,
          input.environment ?? "development",
          input.profileVersion ?? "1.0.0",
          input.tenantId ?? PLATFORM_TENANT_ID,
          input.status ?? "Active",
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  // Bug fix — this omitted `status` entirely, relying on the column's own
  // default. That default was 'Active' until migration 186 (Version Feature
  // Plan.md's Ch.7 pass) moved it to 'Draft', matching Pack — this throwaway
  // synthesizer (findOrCreateDefaultProfile's own fallback, core/profiles.ts)
  // needs an immediately-usable Active row, not a Draft, so it's now
  // explicit about it, the same way upsert() already is.
  // design/design whiteboards.md/schema_implementation.md (owner: "Who is
  // using findOrCreateDefaultProfile? It has to follow the same validation")
  // — validated the same as every other real write, not exempted for being
  // a throwaway synthesizer. `environment` is the only schema-governed field
  // this ever writes (no draftContent).
  async create(input: {
    baseTemplateId: string;
    baseTemplateCode: string;
    environment?: string;
  }): Promise<DbResult<ProfileRow>> {
    try {
      const code = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const name = `Custom profile for ${input.baseTemplateId}`;
      const environment = input.environment ?? "development";
      const profileVersion = "1.0.0";

      const errors = await validateProfileWriteAgainstSchema({
        code,
        name,
        environment,
        profileVersion,
        draftContent: { baseTemplateCode: input.baseTemplateCode },
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { data: schemaRow } = await schemaDefinitionsDB.findLatest("Profile");

      const { rows } = await query<ProfileRow>(
        `INSERT INTO profiles (code, name, base_template_id, environment, status, schema_definition_id)
         VALUES ($1, $2, $3, $4, 'Active', $5)
         RETURNING *`,
        [code, name, input.baseTemplateId, environment, schemaRow?.id ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  // Entity-direct authoring (bug fix correcting CR-014): a Draft Profile row is
  // the authoring document. base_template_id is NOT NULL, so a Draft must name a
  // real base Template up front (chosen on the create form); the rest of the
  // authored content lives in draft_content until publish.
  // tenantId — the real author's own tenant (Platform for a Platform author),
  // mirrors packsDB.create/templatesDB.createDraft. parentProfileId (Ch.7 §9
  // Profile Inheritance) is set once at Draft creation via the "Inherit"
  // control and never revisited by Save.
  async createDraft(input: {
    code: string;
    name: string;
    baseTemplateId: string;
    environment?: string;
    authoredBy?: number | null;
    draftContent?: Record<string, unknown>;
    profileVersion?: string;
    tenantId?: string;
    parentProfileId?: string | null;
    // CR-114 follow-on — mandatory (owner: "Otherwise all this build is of no
    // use"); every caller must resolve and pass a real schema_definition_id.
    schemaDefinitionId: string;
  }): Promise<DbResult<ProfileRow>> {
    try {
      const environment = input.environment ?? "development";
      const profileVersion = input.profileVersion ?? "1.0.0";
      const draftContent = input.draftContent ?? {};

      const errors = await validateProfileWriteAgainstSchema({
        code: input.code,
        name: input.name,
        environment,
        profileVersion,
        draftContent,
        tenantId: input.tenantId,
        schemaDefinitionId: input.schemaDefinitionId,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { data: schemaRow } = await schemaDefinitionsDB.findById(input.schemaDefinitionId);
      if (!schemaRow) return { error: new Error(`schema_definitions row "${input.schemaDefinitionId}" not found`) };

      const { rows } = await query<ProfileRow>(
        `INSERT INTO profiles (code, name, base_template_id, environment, status, authored_by, draft_content, profile_version, tenant_id, parent_profile_id, schema_definition_id)
         VALUES ($1, $2, $3, $4, 'Draft', $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          input.code,
          input.name,
          input.baseTemplateId,
          environment,
          input.authoredBy ?? null,
          JSON.stringify(draftContent),
          profileVersion,
          input.tenantId ?? PLATFORM_TENANT_ID,
          input.parentProfileId ?? null,
          schemaRow?.id ?? null,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] createDraft error", err as Error);
      return { error: err as Error };
    }
  },

  // Bug fix (owner, 2026-09-06: "every seeded Profile in the current DB has
  // empty draft_content — this will not be useful. There has to be real
  // prod grade data") — publishProfile's own upsert() never writes
  // draft_content at all (only code/name/baseTemplateId/environment/
  // profileVersion/tenantId), so nothing passed to publishProfile beyond
  // those — description, the 8 Configuration Parameters, Pack-selection
  // slots as their own authored arrays, exposedParameterOverrides, etc. —
  // ever reached the row, regardless of what a seed file actually declared.
  // updateDraftContent above is scoped to `WHERE status = 'Draft'`
  // (interactive authoring's own save-while-editing case) and upsert's own
  // INSERT defaults status to 'Active' (migration 002), so it never matches
  // a seeded row — a genuinely different write path is needed here, not a
  // reuse of that one. No status restriction: materialiseProfileDraft (the
  // one caller) runs after both upsert (Active) and createDraft (Draft), so
  // this has to work regardless of which state the row is actually in.
  // design/design whiteboards.md/schema_implementation.md — this is a real,
  // unconditional write to draft_content (no `status = 'Draft'` guard, unlike
  // updateDraftContent below), and it's the actual write path publishProfile/
  // seed scripts use to materialise Pack selections/draft content (via
  // materialiseProfileDraft) — validated the same way createDraft/
  // updateDraftContent are, not skipped just because its name doesn't say
  // "create"/"update". code/name/environment/profileVersion aren't passed
  // here (only draftContent is) — read off the row's own real columns.
  async setDraftContent(id: string, draftContent: Record<string, unknown>): Promise<DbResult<ProfileRow>> {
    try {
      const { rows: existingRows } = await query<{ code: string; name: string; environment: string; profile_version: string; schema_definition_id: string | null; tenant_id: string }>(
        "SELECT code, name, environment, profile_version, schema_definition_id, tenant_id FROM profiles WHERE id = $1", [id]
      );
      const existing = existingRows[0];
      if (!existing) return { error: new Error(`Profile "${id}" not found`) };

      const errors = await validateProfileWriteAgainstSchema({
        id,
        code: existing.code,
        name: existing.name,
        environment: existing.environment,
        profileVersion: existing.profile_version,
        draftContent,
        tenantId: existing.tenant_id,
        schemaDefinitionId: existing.schema_definition_id,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { rows } = await query<ProfileRow>(`UPDATE profiles SET draft_content = $2 WHERE id = $1 RETURNING *`, [id, JSON.stringify(draftContent)]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] setDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  async updateDraftContent(id: string, input: { name: string; baseTemplateId: string; environment?: string; draftContent: Record<string, unknown>; profileVersion: string }): Promise<DbResult<ProfileRow>> {
    try {
      const { rows: existingRows } = await query<{ code: string; schema_definition_id: string | null; tenant_id: string }>(
        "SELECT code, schema_definition_id, tenant_id FROM profiles WHERE id = $1", [id]
      );
      const existing = existingRows[0];
      if (!existing) return { error: new Error(`Profile "${id}" not found`) };

      const environment = input.environment ?? "development";

      const errors = await validateProfileWriteAgainstSchema({
        id,
        code: existing.code,
        name: input.name,
        environment,
        profileVersion: input.profileVersion,
        draftContent: input.draftContent,
        tenantId: existing.tenant_id,
        schemaDefinitionId: existing.schema_definition_id,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { rows } = await query<ProfileRow>(
        `UPDATE profiles SET name = $2, base_template_id = $3, environment = $4, draft_content = $5, profile_version = $6
         WHERE id = $1 AND status = 'Draft' RETURNING *`,
        [id, input.name, input.baseTemplateId, environment, JSON.stringify(input.draftContent), input.profileVersion]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] updateDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: ProfileRow["status"]): Promise<DbResult<ProfileRow>> {
    try {
      const { rows } = await query<ProfileRow>("UPDATE profiles SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllActive(): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = await query<ProfileRow>("SELECT * FROM profiles WHERE status = 'Active' ORDER BY code");
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findAllActive error", err as Error);
      return { error: err as Error };
    }
  },

  // Profile ownership visibility, mirroring packsDB/templatesDB's own
  // findAllVisibleTo/findActiveVisibleTo exactly — Platform's own plus this
  // Profile Registry listing (owner, 2026-08-19), mirroring
  // packsDB.findAll/templatesDB.findAll exactly — every Version of every
  // Profile, unscoped by tenant. Root/admin "see everything" view.
  async findAll(): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = await query<ProfileRow>("SELECT * FROM profiles ORDER BY category, code, created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  // viewer's own tenant's. Feeds the Profile Registry and the Inheritance
  // dropdown.
  async findAllVisibleTo(viewerTenantId: string): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = await query<ProfileRow>(
        "SELECT * FROM profiles WHERE tenant_id = $1 OR tenant_id = $2 ORDER BY category, code, created_at DESC",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findAllVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveVisibleTo(viewerTenantId: string): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = await query<ProfileRow>(
        "SELECT * FROM profiles WHERE status = 'Active' AND (tenant_id = $1 OR tenant_id = $2) ORDER BY code",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findActiveVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  // Authoring surface, the "Queue" tabs — see templatesDB.findByStatus for the
  // full rationale. viewerTenantId null = unscoped (root).
  async findByStatus(status: ProfileRow["status"], viewerTenantId: string | null): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = viewerTenantId == null
        ? await query<ProfileRow>("SELECT * FROM profiles WHERE status = $1 ORDER BY created_at DESC", [status])
        : await query<ProfileRow>(
            "SELECT * FROM profiles WHERE status = $1 AND (tenant_id = $2 OR tenant_id = $3) ORDER BY created_at DESC",
            [status, PLATFORM_TENANT_ID, viewerTenantId]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findByStatus error", err as Error);
      return { error: err as Error };
    }
  },

  // Authoring surface, per-verb tabs — see packsDB.findByStatusActedBy.
  async findByStatusActedBy(status: ProfileRow["status"], authorityBadge: string, actorId: number | null): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = actorId == null
        ? await query<ProfileRow>(
            `SELECT DISTINCT p.* FROM profiles p
             JOIN events e ON e.originating_object_type = 'Profile' AND e.originating_object_id = p.id
             WHERE p.status = $1 AND e.authority_badge = $2
             ORDER BY p.created_at DESC`,
            [status, authorityBadge]
          )
        : await query<ProfileRow>(
            `SELECT DISTINCT p.* FROM profiles p
             JOIN events e ON e.originating_object_type = 'Profile' AND e.originating_object_id = p.id
             WHERE p.status = $1 AND e.authority_badge = $2 AND e.actor_id = $3
             ORDER BY p.created_at DESC`,
            [status, authorityBadge, String(actorId)]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findByStatusActedBy error", err as Error);
      return { error: err as Error };
    }
  },

  async findDrafts(authoredBy?: number | null): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = authoredBy == null
        ? await query<ProfileRow>("SELECT * FROM profiles WHERE status IN ('Draft', 'Validated') ORDER BY created_at DESC")
        : await query<ProfileRow>("SELECT * FROM profiles WHERE status IN ('Draft', 'Validated') AND authored_by = $1 ORDER BY created_at DESC", [authoredBy]);
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findDrafts error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<ProfileRow | null>> {
    try {
      const { rows } = await query<ProfileRow>("SELECT * FROM profiles WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[profilesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  // Code alone is no longer unique (multiple versions/tenants can share it) —
  // "latest by created_at", same convention/caveat packsDB.findByCode/
  // templatesDB.findByCode document. Unscoped on purpose: legacy callers
  // (baseTemplateCode-style resolution equivalents) predate tenant-scoped
  // identity.
  async findByCode(code: string): Promise<DbResult<ProfileRow | null>> {
    try {
      const { rows } = await query<ProfileRow>("SELECT * FROM profiles WHERE code = $1 ORDER BY created_at DESC LIMIT 1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[profilesDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCodeAndVersion(code: string, profileVersion: string, tenantId?: string): Promise<DbResult<ProfileRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<ProfileRow>("SELECT * FROM profiles WHERE code = $1 AND profile_version = $2", [code, profileVersion])
        : await query<ProfileRow>("SELECT * FROM profiles WHERE code = $1 AND profile_version = $2 AND tenant_id = $3", [code, profileVersion, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[profilesDB] findByCodeAndVersion error", err as Error);
      return { error: err as Error };
    }
  },

  // The one row (if any) currently Active for a code — reactivateAsNewVersion's
  // supersede step uses this, same as packsDB/templatesDB.findActiveByCode.
  // "One Active per code" is per (code, tenant_id) once tenantId is given.
  async findActiveByCode(code: string, tenantId?: string): Promise<DbResult<ProfileRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<ProfileRow>("SELECT * FROM profiles WHERE code = $1 AND status = 'Active' ORDER BY created_at DESC LIMIT 1", [code])
        : await query<ProfileRow>("SELECT * FROM profiles WHERE code = $1 AND status = 'Active' AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1", [code, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[profilesDB] findActiveByCode error", err as Error);
      return { error: err as Error };
    }
  },

  // Ebook Library — Full Demo Walkthrough.md, real finding #3: lets
  // commissioning check for an already-published Profile before falling
  // back to synthesizing a throwaway one.
  async findByBaseTemplateId(templateId: string): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = await query<ProfileRow>("SELECT * FROM profiles WHERE base_template_id = $1 ORDER BY created_at", [templateId]);
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findByBaseTemplateId error", err as Error);
      return { error: err as Error };
    }
  },

  // Stores the Pack's *code*, not a specific row id — bug fix, see
  // 013_template_profile_pack_by_code.sql. Same reasoning as
  // templatesDB.setMandatoryPacks: which Version a code resolves to is
  // decided fresh at every commissioning, not frozen here.
  // Ch.7 §7 fields (owner, 2026-08-19): Selected Packs (optional), Selected
  // Technologies, Selected Domains, Selected Compliance Packs, and
  // Integration Packs are five slots on the SAME join table, disambiguated
  // by `list_kind` (migration 067) rather than five tables —
  // setOptionalPacks/getOptionalPackCodes below default to `list_kind =
  // 'optional'`, the pre-existing list's own identity.
  async setPackSelection(profileId: string, listKind: string, packCodes: string[]): Promise<DbResult<void>> {
    try {
      await query("DELETE FROM profile_packs WHERE profile_id = $1 AND list_kind = $2", [profileId, listKind]);
      // ON CONFLICT DO NOTHING — same concurrent-writer race as
      // templatesDB.setPackSelection/setRequiredCapabilities (see their own
      // comments): this DELETE+loop-INSERT isn't atomic, and testFixtures.ts's
      // shared fixture can be reached by many concurrent `node --test`
      // processes racing to write the exact same target rows the first time.
      for (const packCode of packCodes) {
        await query(
          "INSERT INTO profile_packs (profile_id, pack_code, list_kind) VALUES ($1, $2, $3) ON CONFLICT (profile_id, pack_code, list_kind) DO NOTHING",
          [profileId, packCode, listKind]
        );
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[profilesDB] setPackSelection error", err as Error);
      return { error: err as Error };
    }
  },

  async getPackSelection(profileId: string, listKind: string): Promise<DbResult<string[]>> {
    try {
      const { rows } = await query<{ pack_code: string }>(
        "SELECT pack_code FROM profile_packs WHERE profile_id = $1 AND list_kind = $2 ORDER BY pack_code",
        [profileId, listKind]
      );
      return { data: rows.map((r) => r.pack_code) };
    } catch (err) {
      logger.error("[profilesDB] getPackSelection error", err as Error);
      return { error: err as Error };
    }
  },

  async setOptionalPacks(profileId: string, packCodes: string[]): Promise<DbResult<void>> {
    return profilesDB.setPackSelection(profileId, "optional", packCodes);
  },

  async getOptionalPackCodes(profileId: string): Promise<DbResult<string[]>> {
    return profilesDB.getPackSelection(profileId, "optional");
  },
};
