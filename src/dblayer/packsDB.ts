import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { PLATFORM_TENANT_ID } from "./constants.js";
import type { DbResult, PackCategory, PackClassification, PackContributions, PackRow, PackStatus } from "./seuTypes.js";

export const packsDB = {
  // Ch.41 VM-002 "Versions are immutable" — a plain INSERT, no ON CONFLICT
  // DO UPDATE. (code, pack_version) is the unique identity (010_pack_lifecycle.sql);
  // publishing a new version of an existing code creates a new row rather
  // than mutating the old one. Callers that need rerun-safety (the seed
  // script, the SDK CLI) check findByCodeAndVersion first and treat an
  // existing exact-version row as a no-op, not an error — see core/packs.ts's
  // publishPack.
  //
  // Pack ownership (owner: "Packs will have ownership"): tenantId is
  // optional here (not on the underlying column, which is NOT NULL) —
  // callers driven by a real logged-in author (createAuthoringDraft) always
  // pass the author's own tenant; seed scripts/the CLI publishing a Pack with
  // no human author don't know or need one, so they default to the reserved
  // Platform tenant (migration 044's own column DEFAULT does the same for
  // any INSERT that reaches the DB without this field at all).
  async create(input: {
    code: string;
    name: string;
    category: PackCategory;
    packVersion: string;
    installationClassification?: PackClassification;
    contributions: PackContributions;
    dependencies?: Array<{ packCode: string; version: string; type: "required" | "optional" | "conditional" | "incompatible" }>;
    compositionSources?: Array<{ packCode: string }>;
    metadata?: Record<string, unknown>;
    authoredBy?: number | null;
    tenantId?: string;
  }): Promise<DbResult<PackRow>> {
    try {
      const { rows } = await query<PackRow>(
        `INSERT INTO packs (code, name, category, pack_version, status, installation_classification, contributions, dependencies, composition_sources, metadata, authored_by, tenant_id)
         VALUES ($1, $2, $3, $4, 'Draft', $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          input.code,
          input.name,
          input.category,
          input.packVersion,
          input.installationClassification ?? "Mandatory",
          JSON.stringify(input.contributions),
          JSON.stringify(input.dependencies ?? []),
          JSON.stringify(input.compositionSources ?? []),
          JSON.stringify(input.metadata ?? {}),
          input.authoredBy ?? null,
          input.tenantId ?? PLATFORM_TENANT_ID,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[packsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  // Entity-direct authoring (bug fix correcting CR-014): update a Draft Pack's
  // authored content in place while it is still being worked on. Only ever
  // called on a Draft row (the authoring surface's Save) — the immutable-version
  // rule (VM-002) applies once a version leaves Draft, not to the working draft.
  // Bug fix: packVersion was missing from both the input type and the SET
  // clause — editing the version field on a Draft and clicking Save silently
  // discarded the edit (the row kept whatever packVersion createAuthoringDraft
  // first minted), so a validation error naming the OLD version could resurface
  // even after the user had "fixed" it on the form.
  // Bug fix (CR-067): `code` was accepted and collision-checked by
  // saveAuthoringDraft's own assertPackCodeVersionFree call (core/sdkAuthoring.ts)
  // but never actually written here — a code change (e.g. Specialization's own
  // "code and/or name may be changed" composing onto an existing Draft) silently
  // discarded itself the same way packVersion used to. Template already allows
  // code to change on Save while still Draft (locked only when parent-derived);
  // Pack gets the same "editable while Draft" treatment now, nothing more.
  async updateDraftContent(id: string, input: {
    code: string;
    name: string;
    category: PackCategory;
    packVersion: string;
    installationClassification?: PackClassification;
    contributions: PackContributions;
    dependencies?: Array<{ packCode: string; version: string; type: "required" | "optional" | "conditional" | "incompatible" }>;
    compositionSources?: Array<{ packCode: string }>;
    metadata?: Record<string, unknown>;
  }): Promise<DbResult<PackRow>> {
    try {
      const { rows } = await query<PackRow>(
        `UPDATE packs SET code = $10, name = $2, category = $3, pack_version = $4, installation_classification = $5, contributions = $6, dependencies = $7, composition_sources = $8, metadata = $9
         WHERE id = $1 AND status = 'Draft'
         RETURNING *`,
        [
          id,
          input.name,
          input.category,
          input.packVersion,
          input.installationClassification ?? "Mandatory",
          JSON.stringify(input.contributions),
          JSON.stringify(input.dependencies ?? []),
          JSON.stringify(input.compositionSources ?? []),
          JSON.stringify(input.metadata ?? {}),
          input.code,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[packsDB] updateDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  // Authoring surface, per-verb tabs: Packs currently sitting in `status`,
  // where the REAL actor who ran the governed transition landing them there
  // (captured on its event — Part 1's accountability record) is `actorId` —
  // "packs I validated/published/deprecated/…", not just "packs I created".
  // actorId null = unscoped (every actor who ever ran that transition — the
  // root/admin view).
  async findByStatusActedBy(status: PackStatus, authorityBadge: string, actorId: number | null): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = actorId == null
        ? await query<PackRow>(
            `SELECT DISTINCT p.* FROM packs p
             JOIN events e ON e.originating_object_type = 'Pack' AND e.originating_object_id = p.id
             WHERE p.status = $1 AND e.authority_badge = $2
             ORDER BY p.created_at DESC`,
            [status, authorityBadge]
          )
        : await query<PackRow>(
            `SELECT DISTINCT p.* FROM packs p
             JOIN events e ON e.originating_object_type = 'Pack' AND e.originating_object_id = p.id
             WHERE p.status = $1 AND e.authority_badge = $2 AND e.actor_id = $3
             ORDER BY p.created_at DESC`,
            [status, authorityBadge, String(actorId)]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findByStatusActedBy error", err as Error);
      return { error: err as Error };
    }
  },

  // Authoring surface, the "Queue" tabs (owner: "add a tab to show what is
  // the queue applicable to the badge you hold... a tab to show queue that
  // needs validation") — every Pack currently SITTING in `status`, full stop,
  // regardless of who (if anyone) has acted on it yet. findByStatusActedBy
  // above answers "what did I already do"; this answers "what's waiting for
  // my verb" — the fromState of the hop this badge runs, not its toState.
  // viewerTenantId null = unscoped (root — every tenant's queue).
  async findByStatus(status: PackStatus, viewerTenantId: string | null): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = viewerTenantId == null
        ? await query<PackRow>("SELECT * FROM packs WHERE status = $1 ORDER BY created_at DESC", [status])
        : await query<PackRow>(
            "SELECT * FROM packs WHERE status = $1 AND (tenant_id = $2 OR tenant_id = $3) ORDER BY created_at DESC",
            [status, PLATFORM_TENANT_ID, viewerTenantId]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findByStatus error", err as Error);
      return { error: err as Error };
    }
  },

  // Authoring surface: in-progress drafts (Draft/Validated), optionally only
  // those authored by a given user ("my drafts").
  async findDrafts(authoredBy?: number | null): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = authoredBy == null
        ? await query<PackRow>("SELECT * FROM packs WHERE status IN ('Draft', 'Validated') ORDER BY created_at DESC")
        : await query<PackRow>("SELECT * FROM packs WHERE status IN ('Draft', 'Validated') AND authored_by = $1 ORDER BY created_at DESC", [authoredBy]);
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findDrafts error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-026 Part 2: (code, pack_version) alone is no longer the unique identity
  // (packs_code_version_tenant_key, migration 063) — a tenant param narrows
  // the lookup to that tenant's own row. Omitted = unscoped (existing callers
  // that predate tenant-scoped identity, e.g. dependency resolution, keep
  // their original latest-match-wins behaviour).
  async findByCodeAndVersion(code: string, packVersion: string, tenantId?: string): Promise<DbResult<PackRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<PackRow>("SELECT * FROM packs WHERE code = $1 AND pack_version = $2", [code, packVersion])
        : await query<PackRow>("SELECT * FROM packs WHERE code = $1 AND pack_version = $2 AND tenant_id = $3", [code, packVersion, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[packsDB] findByCodeAndVersion error", err as Error);
      return { error: err as Error };
    }
  },

  // Latest-published-row-for-this-code lookup — used where the MVP only
  // ever cares about "the" pack (dependency resolution, dashboard counts,
  // the couple of existing tests written before multi-version Packs existed).
  // "Latest" is by created_at, not a semver comparison — this MVP publishes
  // versions in order and doesn't need out-of-order backfill.
  async findByCode(code: string): Promise<DbResult<PackRow | null>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs WHERE code = $1 ORDER BY created_at DESC LIMIT 1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[packsDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  // The one row (if any) currently Active for a code — publishPack's
  // supersede step uses this to find what a newly-activated version replaces.
  // CR-026 Part 2: "one Active per code" is now per (code, tenant_id) — two
  // tenants (or a tenant and Platform) can each have their own Active row for
  // the same code without superseding each other. tenantId omitted = unscoped
  // (compositionEngine's code->Active-row resolution predates any tenant
  // concept on Template/Profile and stays exactly as it was).
  async findActiveByCode(code: string, tenantId?: string): Promise<DbResult<PackRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<PackRow>("SELECT * FROM packs WHERE code = $1 AND status = 'Active' ORDER BY created_at DESC LIMIT 1", [code])
        : await query<PackRow>("SELECT * FROM packs WHERE code = $1 AND status = 'Active' AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1", [code, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[packsDB] findActiveByCode error", err as Error);
      return { error: err as Error };
    }
  },

  // Full immutable version history for a code — the Pack Registry screen's
  // version-history display (Ch.38 §10 "version lookup").
  async findVersionsByCode(code: string): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs WHERE code = $1 ORDER BY created_at DESC", [code]);
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findVersionsByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<PackRow | null>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[packsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByIds(ids: string[]): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs WHERE id = ANY($1::uuid[])", [ids]);
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findByIds error", err as Error);
      return { error: err as Error };
    }
  },

  // Registry listing (Ch.38 §10) — every Version of every Pack, newest first
  // within each code so the web page can group version history per code.
  // Unscoped by tenant — callers that need visibility scoping use
  // findAllVisibleTo below; findAll stays the root/admin "see everything" view.
  async findAll(): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = await query<PackRow>("SELECT * FROM packs ORDER BY category, code, created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  // Pack ownership visibility (owner: "Platform packs will be available to
  // all users of the platform. Tenant packs are visible only to the tenant
  // users."): every Version of every Pack this viewer is allowed to see —
  // the Platform tenant's own Packs, plus this viewer's own tenant's. Root
  // bypasses this entirely by calling findAll() instead (the caller's job,
  // same pattern as every other root-bypass check in this codebase).
  async findAllVisibleTo(viewerTenantId: string): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = await query<PackRow>(
        "SELECT * FROM packs WHERE tenant_id = $1 OR tenant_id = $2 ORDER BY category, code, created_at DESC",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findAllVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  // Same visibility rule as findAllVisibleTo, narrowed to the live catalog —
  // the Active Packs authoring tab and every Pack-code dropdown (Dependencies,
  // Template's mandatoryPackCodes, Profile's optionalPackCodes) only ever
  // offer Active Packs to begin with (§19.9's "must resolve to a real, Active
  // Pack"), so this is the one query both of those actually want.
  async findActiveVisibleTo(viewerTenantId: string): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = await query<PackRow>(
        "SELECT * FROM packs WHERE status = 'Active' AND (tenant_id = $1 OR tenant_id = $2) ORDER BY code",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[packsDB] findActiveVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: PackStatus): Promise<DbResult<PackRow>> {
    try {
      const { rows } = await query<PackRow>("UPDATE packs SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[packsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async count(): Promise<DbResult<number>> {
    try {
      const { rows } = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM packs");
      return { data: Number(rows[0]?.count ?? 0) };
    } catch (err) {
      logger.error("[packsDB] count error", err as Error);
      return { error: err as Error };
    }
  },
};
