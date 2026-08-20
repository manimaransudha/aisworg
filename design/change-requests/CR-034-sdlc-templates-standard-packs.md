# CR-034 — SDLC Templates: 16 phase Packs + 9 standard category Templates

**Raised:** 2026-08-19 · **Origin:** owner — "design/fragments/sdlc-templates-main has the current software engineering methodology. Map this into pack and user it to create standard platform templates. Create these as separate scripts. I want to use this to seed the demo tenant." Scope clarified via follow-up: one Pack per phase (mirroring the OpenUP precedent); one Template per existing `template-categories` Ontology concept, each with the appropriate Pack subset; Platform-owned; "just make it commissionable" (no SEU actually created by the seed). · **Status:** ✅ Built 2026-08-19

> **Built 2026-08-19.**

### Source
`design/fragments/sdlc-templates-main/README.md` — a 16-phase (0–15) SaaS SDLC reference library (vision → discovery → design → architecture → security → platform/DevOps → planning → implementation → QA → scale → beta → launch → hypercare → growth → i18n → ongoing ops), modelled around a fictional NoteShare Pro product. Each phase has 5–9 deliverable-template docs with a one-line description.

### What's built
- **16 new Packs**, one per phase (`sdlc-phase-00-vision-opportunity.pack.json` … `sdlc-phase-15-ongoing-operations-governance.pack.json`), each contributing exactly one Capability (code identical to the Pack's own top-level `code`) and one Service per deliverable (`contractDescription` = the README's own one-liner), plus one checklist + one review gate. Deliberately distinct `capability-name` Ontology codes from the OpenUP/EPF set (migration 071, 16 new concepts) — a separate, independently-owned Pack family, not meant to merge with OpenUP even where a phase's theme overlaps a discipline (e.g. Phase 3 vs the OpenUP Architecture pattern).
- **9 new Templates**, one per real `template-categories` concept (ai-platform, api-platform, data-platform, embedded-software, enterprise-web-application, legacy-modernisation, mobile-application, package-implementation, saas-product), each with a curated `mandatoryPackCodes` — a shared "core spine" (`platform-core-engineering` + 8 of the 16 phase Packs) plus category-specific extras (e.g. saas-product gets all 16; api-platform adds only `scale-performance-optimization`). All 9 share one 9-entry `deliverableCatalogue` spine (Requirements → Architecture → Technical Architecture → Security Review → Platform Setup → Source Code → Quality Report → Launch Readiness → Operations Runbook), plus one default development Profile each.
- **`enterprise-web-application-parent.template.json`** is the one exception needing an explicit `templateVersion: "1.2.0"` — two other Templates (`web-application`, `ebook-library`) already use that exact code at 1.0.0/1.1.0; this new "standard category parent" needed its own distinct version to coexist rather than collide on `(code, template_version, tenant_id)`.
- Two new standalone seed scripts, `seedSdlcPhasePacks.ts` (`pnpm seed:sdlc-phase-packs`) and `seedSdlcStandardTemplates.ts` (`pnpm seed:sdlc-standard-templates`), both wired into `db:clean-slate` (steps 7–8, after the OpenUP Packs) so a reset reproduces the full standard offering.
- Fixed a stale-data bug found along the way: `platform-core-engineering`'s live Active Pack row still carried the invalid `category: "Platform"` from before an earlier same-day fix to its seed JSON — the reseed hadn't propagated the metadata change to the already-existing row (`ON CONFLICT DO UPDATE` doesn't touch `category`). Corrected directly on both live rows.

### Design decisions
- **Platform-owned, not demo-tenant-owned** — same open, reusable-by-any-tenant model as the OpenUP Packs. "Seed the demo tenant" means make it commissionable there, not author it there.
- **No SEU created** — the seed scripts publish Packs/Templates/Profiles only; any tenant (including demo) can commission through the existing UI once seeded.
- **Deliverable catalogue kept as a curated spine, not one entry per underlying Pack Service** — mirrors `web-application.template.json`'s own minimal 3-entry precedent; the ~110 real Services live inside the 16 Packs' own contributions, not duplicated into every Template's catalogue.

### Verification
- `npx tsc --noEmit`: clean throughout.
- All 16 Packs Active; all 9 Templates Active with correct `requiredCapabilityCodes`/`mandatoryPackCodes`.
- `db:clean-slate` → `seed:seu` → both new scripts run cleanly end to end, repeatedly.
- Full suite: 148/148 (see CR-035 — this surfaced and led to fixing a real, unrelated pre-existing race).
