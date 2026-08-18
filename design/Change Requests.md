# Change Requests

A running register of change requests raised against the platform — feature additions, behavioural changes, and dev-tooling requests that fall outside the numbered MVP build phases. Each CR is its own file in [change-requests/](change-requests/); this page is the index (newest first). Each file records the request as raised, the agreed scope, the design decisions, and (once built) a Built banner.

| CR | Title | Status |
|----|-------|--------|
| [CR-019](change-requests/CR-019-consolidate-transition-definition-authoring.md) | Consolidate transition-definition authoring on the CR-007 form (drop the stale SDK grammar path) | ✅ Built 2026-08-14 |
| [CR-018](change-requests/CR-018-complete-pack-validator-metadata.md) | Complete the Pack validator: §8 metadata, §10 dependency types, §13 compatibility fields | ✅ Built 2026-08-14 |
| [CR-017](change-requests/CR-017-form-based-schema-registry.md) | Form-based schema-registry authoring (author validators from a meta-schema) | ✅ Built 2026-08-14 |
| [CR-016](change-requests/CR-016-schema-structured-pack-contributions.md) | Schema-structured Pack contributions (the §20 executable-verification grammar) | ✅ Built 2026-08-14 |
| [CR-015](change-requests/CR-015-pack-categories-uuid-codes-validated-input.md) | Pack authoring: data-driven categories, UUID codes, and schema-validated input | ✅ Built 2026-08-14 |
| [CR-014](change-requests/CR-014-noun-verb-sdk-authoring.md) | Retire `sdk_*` Platform badges; gate SDK authoring by the authored entity's noun × verb | ✅ Built 2026-08-13 |
| [CR-013](change-requests/CR-013-objectives-ui-restyle.md) | Objectives tree UI: styling & layout pass | 🟡 Proposed (not scheduled) |
| [CR-012](change-requests/CR-012-objective-delete-and-retire.md) | Objective delete (Proposed leaf) and retire (Active subtree) | ✅ Built 2026-08-13 |
| [CR-011](change-requests/CR-011-pack-based-capability-derivation.md) | Pack-based automated Capability derivation for Objectives (Ch.1 §10) | 🟡 Proposed (not scheduled) |
| [CR-010](change-requests/CR-010-objective-lifecycle-events.md) | Objective lifecycle & decomposition events (Ch.1 §14) | 🟡 Proposed (not scheduled) |
| [CR-009](change-requests/CR-009-objective-hierarchy.md) | Objective hierarchy: mandatory parent + contextual creation + tree view + re-parenting | ✅ Built 2026-08-13 |
| [CR-008](change-requests/CR-008-tenant-user-landing-page.md) | Tenant-user landing page (redesign) | 🟡 Proposed (not scheduled) |
| [CR-007](change-requests/CR-007-transition-definitions-surface.md) | Transition Definitions as a manageable, visible authority surface | ✅ Closed 2026-08-13 |
| [CR-006](change-requests/CR-006-authority-noun-verb.md) | Authority as noun × verb (clean, data-driven; Phase 10 preserved) | ✅ Closed 2026-08-13 |
| [CR-005](change-requests/CR-005-decouple-tenant-creation.md) | Decouple tenant creation from tenant-admin assignment | ✅ Built 2026-08-12 |
| [CR-004](change-requests/CR-004-user-home-membership.md) | Every user belongs to a Platform or a Tenant | ✅ Built 2026-08-12 |
| [CR-003](change-requests/CR-003-commission-from-objectives-screen.md) | Commission an SEU from the Objectives screen (not the navbar) | ✅ Built 2026-08-12 |
| [CR-002](change-requests/CR-002-seu-objective-invariants.md) | Enforce SEU↔Objective invariants (Ch.1 §18.2) | ✅ Built 2026-08-12 |
| [CR-001](change-requests/CR-001-dev-act-as-switcher.md) | Dev-only "Act As" switcher (tenant + badge impersonation) | ✅ Built 2026-08-12 |

## Adding a CR
Create `change-requests/CR-0NN-<short-slug>.md` (H1 = the CR title), then add a row here (newest first). Keep the file's `**Status:**` line and this table's Status cell in sync.
