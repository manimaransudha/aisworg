# Phase 10 — User Management & Badge Model: Technical Design (DRAFT)

*Status: draft, for review. Nothing in this document has been implemented. No migration, no code — this is the design to firm up before any of that starts. Supersedes the earlier two-tier (`platformRole`/`engineeringAuthority`) draft — folded in against `Identity and Badge Model — Phase 10 Handoff.md`, a separate design discussion that arrived at a richer, more accurate shape.*

---

## 1. Why this document exists

Phase 10 in `Post-MVP Build Sequence.md` is scoped as "the Dual Authority Model (Platform Authority vs. Engineering Authority), beyond the current single Authority Rule type plus session auth." Investigating that surfaced a more specific finding, refined further by the handoff discussion this draft now builds on:

The platform needs two structurally independent checks — *"can this identity administer the platform?"* (Platform Authority) and *"can this identity approve this engineering state transition?"* (Engineering Authority) — but both already exist as separate code (`requireRole()` vs. `authority_rules` + `transitionEngine.evaluate`) that happen to read the *same single flat value*, `req.session.user.role`. Two genuinely separate checks, sharing one undifferentiated input, look like one system from the outside.

The deeper fix is not "add a second flat field." A single scalar per identity — even two of them — can't represent what's actually needed: an identity holding *several* distinct grants at once, each scoped differently (platform-wide, one tenant, one SEU, one Pack-contributed capability). That's a **badge model**: an identity holds a *set* of badges, not one role. Ch.40 §8 already states the principle this rests on — *"Identity is independent of authority"* — a badge model takes that literally.

---

## 2. Source material

- Book 3 Ch.40 (Security Architecture) — full chapter, reconciled section-by-section in §4 below.
- Book 3 Ch.42 (Multi-Tenancy Architecture) — Tenant → Workspace → SEU hierarchy, Ownership Separation ADR, Tenant Structure (§7), Resource Ownership (§10).
- Book 3 Ch.22 (Authority Model) — Engineering Authority's own chapter; Authority Rules attach to transitions, not job titles.
- Book 3 Ch.25 (Review Model) — added 2026-08-05: grounds the Reviewer badge (§8.4), whose Findings-producing authority is parallel to, not a step within, a governed entity's own transitions.
- `Post-MVP Build Sequence.md` — Phase 10's "Done when" line, and Phase 12 ("the user management required as part of tenancy" is this phase's job; the rest of Multi-Tenancy stays deferred).
- `Identity and Badge Model — Phase 10 Handoff.md` — a separate design discussion (2026-08-05) that reframed this from a two-tier role split into a composable badge model. This document builds directly on it; §9-§11 in particular are its structure, developed into a concrete data model.
- Current code: `src/middleware/auth.js` (`requireRole`), `src/domain/engine/transitionEngine.ts` (`ROLE_LEVEL`, `authority_rules`), `schema.sql` (`users`), `002_seu_platform.sql` (`authority_rules`, `participants`).

---

## 3. Terminology: badge, not role

Today's implementation (`ROLE_LEVEL: { general: 1, power: 2, super: 3 }`) is a single flat tier — one identity sits at exactly one level, checked against different thresholds in different places. A **badge** is a claim an identity holds; an identity can hold **several badges at once**, each independently scoped. This is the composable shape Ch.40 §8's "identity is independent of authority" actually implies, and it's the only shape that can represent, for example, "administers Tenant X's users, and separately holds Engineering authority on SEU Y, and holds neither on any other Tenant or SEU" — three independent facts about one identity, not one number.

**Revised 2026-08-05, sharpened 2026-08-05: badges are flat and single-responsibility, not tiered, by default.** `general`/`power`/`super` don't carry forward as a badge *tier* vocabulary at all — not because the words are wrong, but because tiering itself isn't the primary mechanism any more. One badge, one responsibility: a badge either represents one specific capability or it doesn't exist, full stop, rather than the same badge existing at graded levels of trust. Where a real distinction in seniority or authority exists, that's a **separate, distinctly-named badge** in the catalog — not the same badge at a different rank. Someone with multiple responsibilities holds multiple badges and switches between them (§8.0), the same mechanism used for any other multi-badge case. This is what actually keeps the model simple and repeatable: every badge is evaluated the same way (held or not, for this declared action), with no rank-comparison logic needed anywhere. Tiering is kept in the schema only as a reserved, opt-in extensibility mechanism for the rare badge that genuinely needs internal grading later (§9) — not the default shape, and no badge in the initial catalog uses it.

---

## 4. Chapter 40 — full coverage review

Ch.40 is broader than the badge/authority question alone. This section goes through every part of it and states what's in scope for Phase 10, what isn't, and why — so nothing is silently dropped. (Retained from the prior draft; "role" reframed as "badge" throughout where it changes meaning.)

### §5 Architectural Principles (SA-001 to SA-006)

| Principle | Status |
|---|---|
| SA-001 Trust is explicit, no implicit trust | Already true structurally — every route is behind `requireRole`, every transition behind `transitionEngine`. This design fixes what the trust decision is based on, not the posture itself. |
| SA-002 Identity precedes authority | Directly addressed — identity (`users`, and later other holder types) and badges are separate, FK'd tables, never merged (§9). |
| SA-003 Least privilege | The badge model is strictly *more* capable of least-privilege than the old flat role — grants are scoped (Tenant/SEU/Pack), not platform-wide by default. |
| SA-004 Security is layered | A transition can require more than one badge at once (e.g. Pack administration requiring both a Platform badge and an Engineering badge) — representable now, not necessarily enforced everywhere yet (§13). |
| SA-005 Security is traceable | Addressed narrowly — §14 (events). |
| SA-006 Declarative security policies | Directly addressed — `badge_types`/`badge_tiers` as data, not hardcoded maps (§9, §13). |

### §6 Functional Requirements (FR-40.1 to FR-40.7)

| Requirement | Status |
|---|---|
| FR-40.1 Every Participant shall possess a unique identity | Out of scope here — `participants` already has this; untouched (see §12). |
| FR-40.2 Every Runtime Service shall possess a verifiable service identity | **Out of scope.** Monolithic app, no separate Runtime Services yet. |
| FR-40.3 Every External Interaction shall be authenticated | **Out of scope.** External Interaction (Ch.36) is manually logged, no live external caller to authenticate yet. |
| FR-40.4 Every security decision shall be traceable | Addressed narrowly — §14, scoped to denials/grants. |
| FR-40.5 Security policies shall support composition through Packs | **Not built, and not needed — resolved 2026-08-05 (§17's intro).** `badge_types` are seeded directly, not Pack-contributed; the Identity Management UI already gives Tenants a live mechanism to add badges, which meets the practical extensibility need without also requiring the Platform-default catalog to be Pack-installable. |
| FR-40.6 Security credentials shall support rotation | **Out of scope.** No service credentials exist yet; human password reset already exists, untouched. |
| FR-40.7 The platform shall detect unauthorised access attempts | Partially addressed — denial events (§14), not anomaly detection. |

### §7 Security Domains

Administrative Security is this design's core (Platform + Tenant Admin badges). Participant/Runtime/Interaction Security remain out of scope (no real counterpart yet). Pack Security (publisher signing/provenance) stays explicitly declined per `Technology Decisions.md`'s existing note.

### §8 Identity Model

> "Every participating entity shall possess a platform identity. Entities include: Human Participants, AI Participants, Runtime Services, Connectors, External Systems, Pack Publishers. Identity is independent of authority."

The badge model's `holder_type` (see §9) is designed so this list isn't foreclosed: only `User` is a real holder type built now, but AI Participants, Pack Publishers, etc. becoming badge-holders later is a new `holder_type` value and a provisioning mechanism, not a schema redesign. The handoff's own open item 2 (AI Participant provisioning mechanism) stays genuinely unresolved — Ch.40 §9 leaves authentication implementation-defined, and this MVP has no AI Participant authentication story at all yet.

### §9 Authentication, §14 Security Lifecycle

Unchanged from the prior draft: already built (Passport/session/OAuth/password reset) and untouched; credential rotation stays out of scope (no service credentials exist).

### §10 Authorisation

Core of this design — §9-§12 below.

### §11 Integrity, §12 Confidentiality

Unchanged from the prior draft: Integrity already substantially satisfied by prior phases (append-only events, immutable Evidence, immutable Pack Versions); Confidentiality (ACLs on who can *read* what) remains explicitly out of scope — the badge model governs who can *act*, not who can *see*.

### §13 Auditing, §15 Events

Addressed narrowly in §14 below.

---

## 5. What already exists (kept, not rebuilt)

- **`users`** (`schema.sql`, shared across the whole `aisworg` app): email/password/OAuth login, `role`, `is_active`. Login mechanics untouched — infrastructure, not the gap. **`role` is not where badge composition lives, and is not read or written by anything this design builds.** Badge composition lives entirely in `badge_grants` (§9), a separate table with no live sync back to `users.role`. `role` stays exactly as it is, doing exactly the job it does today (see the `requireRole()` correction below), just no longer the input to Engineering-Authority checks the way it currently, accidentally, is.
- **`requireRole()`**: Express middleware, used app-wide, not SEU-specific — gates the main dashboard, `/quickview`, `/settings`, `/auth/users*`, and every `/aisworg/seu*`/`/aisworg/api/seu*` route, reading `req.session.user.role`. **Correction from an earlier version of this doc, which said this "becomes a Platform-badge check":** that's wrong as stated — taken literally, it would mean the app's ordinary home dashboard (`requireRole('general')`, today just "is anyone logged in") starts requiring an explicit `badge_grants` row before it loads, which contradicts what a Platform badge is actually for (administering the platform, a small population — not everyday app access). `requireRole()`/`users.role` are left **untouched**, for whatever the rest of the app already uses them for. A **new, separate** check — backed by `badge_grants`, used only where this design actually needs it (the SEU platform's own administrative surfaces: Pack Registry lifecycle at minimum, Identity Management screens once built) — is introduced instead of repurposing the existing one. Whether any *existing* `requireRole('super')` call site (e.g. `/aisworg/settings`) later migrates to the new check is a separate, smaller, later decision, not part of this phase.
- **`authority_rules` + `transitionEngine.evaluate`**: per-transition Engineering Authority check, already a real, separate code path. Becomes an Engineering-badge check (§11) — this one genuinely is SEU-platform-specific already, so repurposing it in place is correct, unlike `requireRole()`.
- **`participants`** (SEU-scoped: AI/Human/External, fulfils a Capability): not a login identity, deliberately kept separate (§12).

---

## 6. Design goals

1. **Badges are composable, not a single scalar** — an identity holds a set of independently-scoped grants.
2. **Three identity layers** (§8) — Layer 1 Platform, Layer 2a Tenant Admin, Layer 2b Engineering (Creator/Reviewer/Approver, entity-type-agnostic, §8.0/§8.4) — each containing its own flat catalog of single-responsibility badges, not a fixed SEU-level/Pack-level split needing a combination rule.
3. **Configurable/modular** — badge types are rows, not hardcoded maps. Adding a new badge is a data change.
4. **Minimal disruption to the shared `users` table** — new concepts live in new, SEU-platform-scoped tables.
5. **No backfill needed.** There are no existing users and the platform is pre-production; the original "preserve today's behaviour for existing users" goal doesn't apply. Replaced by: a config-driven bootstrap (§9) and normal Tenant-Admin-led onboarding for everyone else, from day one.
6. **Deployment topology surfaced as open, not assumed** (§15) — it changes whether Platform and Tenant Admin badges can ever collapse onto the same identity.
7. **Duty separation lives in how badges are defined, not in a runtime rule engine — revised 2026-08-05.** A recommended badge catalog (§8) carries separation of duties in each badge's own scope (least privilege, one badge = one responsibility); an identity may hold several badges, but every action is performed *as* one explicitly declared badge, and every governed transition records which badge was active. This replaces two earlier, more complex proposals (a mutual-exclusion table between badge types; a same-actor-cannot-do-the-next-transition check) — both are unnecessary once duty separation is structural and every action is attributable to a declared capacity. See §8 and §14.
8. **Flat over ranked — sharpened 2026-08-05.** A badge is held or not; there is no rank-comparison mechanism in the default model. Where a genuine seniority/authority distinction exists, it's a separate, distinctly-named badge, not the same badge at a different tier. This keeps the check the same shape everywhere ("does the declared badge grant exist and is it Active"), rather than every check also needing to reason about rank thresholds. See §8.0, §9.

## 7. Explicit non-goals (deferred to Phase 12, or out of Ch.40's own scope for this MVP)

- Workspace grouping, cross-tenant isolation *enforcement*, cross-tenant Pack sharing governance, full Tenant lifecycle UI — all Phase 12, unchanged from the prior draft. **Confirmed 2026-08-05: a `badge_grants` row scoped to `tenant_id = X` records the fact that a grant belongs to Tenant X; it is not itself what stops that identity from reaching Tenant Y's resources.** Same distinction as §14a's SoD caveat: this design supplies the scoping data (`scope_id`, `Tenant Admin` badges bound to one `tenant_id`), but the actual cross-tenant boundary check — does the platform's data/query layer respect that scoping everywhere it needs to — is Multi-Tenancy's (Phase 12's) job, not built here. **Revised 2026-08-05: Tenant self-service admin is no longer entirely deferred** — badge-tier configuration (Identity Management screens, §9's revised `badge_tiers`) is explicitly in-scope for Phase 10, since it's part of Tenant onboarding, not a Phase 12 concern. Everything *else* under "Tenant self-service admin" (workspace grouping, Tenant lifecycle, cross-tenant governance) stays deferred — this narrows that line, it doesn't remove it.
- Runtime Service / Connector / External System / Pack Publisher as real badge-holders — reserved in the schema (`holder_type`), not implemented.
- Confidentiality / ACLs on engineering data.
- Security credential lifecycle, Pack signing/provenance.
- ~~Badge types as Pack-contributed data (FR-40.5)~~ — **resolved 2026-08-05, no longer a non-goal to revisit.** Direct seeding plus the Identity Management UI's own tenant-extensibility already meets the need — see §4/§12/§17's intro.
- ~~Separation-of-duties enforcement~~ — **resolved 2026-08-05, no longer a non-goal.** See §8.0/§14a: duty separation is structural (recommended badge catalog + explicit badge-switching), not a `qualityGateEngine` behaviour addition. In scope for this phase.
- ~~Composition rule for overlapping SEU-level and Pack-level Engineering badges~~ — **resolved 2026-08-05, no longer applicable.** Every action is performed as one explicitly declared badge; there is no scenario where two badges are evaluated together for the same action, so there is nothing to combine. See §8.0.
- ~~Full enumeration of every recommended badge~~ — **fully resolved 2026-08-05.** Layer 2b generalises to three entity-type-agnostic badges (Creator, Reviewer, Approver, §8.0/§8.4), not a per-Capability list; Capability-narrowing is mandatory wherever the entity type has one (§8.0). Layer 1 (Platform) needs only its one seed badge, `root` (§8.2) — anything narrower is created later via the Identity Management UI, not enumerated here.
- Mechanically enforcing the "a Tenant's custom badge must resemble the recommended set" rule (§8.1) — stated as a design principle here; what actually stops a Tenant from defining a rule-violating custom badge (validation logic, an approval step, or something else) is not designed in this document.

---

## 8. The badge catalog

**Rewritten 2026-08-05** (heading corrected from "The badge tiers" — this section stopped being about tiers once §3/§6 established badges are flat by default; heading had gone stale.) The original shape of this section (four abstract scope categories — Platform, Tenant Admin, Engineering-SEU, Engineering-Pack — with an unresolved question about how the last two "combine," plus a separately-invented `badge_compatibility_rules` exclusion table for duty separation) is superseded. Duty separation now lives in how badges are *defined*, not in a rule engine reconciling multiple held badges or checking cross-badge exclusions at grant time. What follows is the revised model.

### 8.0 The core mechanism: one badge, one responsibility, scoped narrowly, explicitly switched

The platform ships a **recommended badge catalog** — a curated set of named, single-responsibility badges, each with a narrow, least-privilege permitted-action scope baked in. **One badge, one responsibility:** a Coding badge cannot do Testing — not because a rule checks Coding against Testing, but because Coding's permitted-action scope was never defined to include Testing's transitions in the first place. Every "badge constraint" this design needs is expressed this way — as what a badge *is*, not as a rule about what it's excluded from.

**Sharpened 2026-08-05: for Layer 2b (Engineering), "responsibility" is two independent axes, not one badge per domain.** An earlier version of this section anchored the recommended catalog directly to Book 3's Capability Catalogue (Ch.6 §11), producing one named badge per Capability (Architect, Developer, Tester, ...). That's superseded by a sharper observation: the platform's own engine already treats every governed entity generically regardless of which Capability produced it — the same Quality Gates, the same lifecycle, the same `transitionEngine`, whether a Deliverable is code, an Architecture Document, or a Requirements Specification. The badge model should mirror that:

- **Badge type (the verb — what duty is being performed):** **Creator**, **Reviewer**, **Approver** — three badges, entity-type-agnostic, covering any governed entity with a create-then-approve shape (Deliverable and Evidence now; Knowledge/Decision/Obligation are candidates later, §14a). This is what makes the catalog extensible: a new Capability, a new domain, a new governed entity type never needs a new badge invented for it — someone is simply granted Creator/Reviewer/Approver, scoped to that entity type.
- **Scope (previously conflated into the badge itself):** which governed entity type, which SEU or Pack, and — this is still an open question, see below — optionally which Capability/domain within that entity type. Carried on the `badge_grants` row (`governed_entity_type`, §9), not baked into a differently-named badge per domain.

Mapped onto Deliverable lifecycle: **Creator** performs `Defined → In Progress`; **Approver** performs `In Progress → Approved` and `Approved → Baselined` — genuinely separate authority from Creator, the same duty-separation shape Evidence needed, now general rather than bespoke (§14a); **Reviewer** doesn't perform the entity's own transition at all — it produces Findings against it through the Review Model (Ch.22, Ch.25), a parallel authority, not a third step in the same chain.

**Resolved 2026-08-05 — Capability-narrowing is mandatory wherever the governed entity type actually carries a Capability, not optional.** "Coding cannot do Testing" only holds if this is a requirement, not a mechanism nobody has to use — so for `Deliverable` (the entity type this example is about), every Creator/Reviewer/Approver grant must name one Capability, not just an entity type: "Approver, Deliverable, Capability = Architecture" is a genuinely different, non-overlapping grant from "...Capability = Testing." This isn't a blanket rule across every entity type, because not every entity type *has* a Capability to narrow by: `DeliverableRow.producing_capability_id` exists; `EvidenceRow` has no equivalent field at all (checked directly against `src/dblayer/seuTypes.ts`) — Evidence's Creator/Approver split (§14a) is already fully separated by `governed_entity_type = 'Evidence'` alone, with no further Capability axis to add, because there isn't one. The rule, stated precisely: Capability-narrowing is required when the entity type has a Capability dimension, and simply doesn't apply — not "optional," genuinely absent — when it doesn't. See §9 for the schema consequence, and §17.8 for the edge case this newly opens.

Platform/administrative badges (Platform, Tenant Admin) are **not** part of this generic create/approve pattern — they stay named, distinct badges per §8.2/§8.3, not Creator/Reviewer/Approver variants. **Pack administration is not a third exception — decided 2026-08-05, see §8.4/§11b:** a Pack is already a `TransitionEntityType` (`Pack`), governed by the same `transitionEngine`/`authority_rules` machinery as a Deliverable. There is no structural reason for it to need its own badge — administering a Pack's own lifecycle is just Creator/Approver with `governed_entity_type = 'Pack'`, the same generic mechanism as everything else. One catalog table, one definition mechanism, reused across all three layers (§8.1-§8.4) — but Layer 2b's *content* is now three generic verbs plus a scope dimension, not a badge per Capability, and not a badge per entity type either.

**One identity may hold several badges.** Sudha can hold both Approver (`Pack`, Pack X — administering that Pack's own lifecycle) and Creator (`Deliverable`, SEU Y). What produces accountability is not preventing that — one human legitimately having multiple responsibilities is ordinary organisational reality, not a flaw to design around — it's that **every action is performed as one explicitly declared badge**, selected at the point of the action, not inferred from the actor's full set of held badges. Every governed transition records *which badge was active*, not just which identity acted. "Sudha, acting as Approver on Pack X, did Y" and "Sudha, acting as Creator, drafted the Requirements Specification on SEU Y" become two cleanly separated, independently traceable records, even though it's one human behind both. AI Participants are naturally single-purpose and need none of this — this mechanism exists specifically because humans, not AI, accumulate multiple responsibilities in practice.

This replaces two earlier, more complex proposals considered and rejected in this document's drafting: a mutual-exclusion table checked at grant time (e.g. "Pack-level and SEU-level badges cannot be held by the same identity"), and a same-actor-cannot-perform-the-next-transition check (considered for Evidence `Collected → Validated` vs. `Validated → Accepted`). Both are unnecessary once (a) badges are scoped narrowly enough that conflicting duties were never in the same badge to begin with, and (b) every action is attributable to one declared badge. The Evidence case, concretely: `Collected → Validated` is the **Creator**'s action, `Validated → Accepted` is the **Approver**'s — the same two generic badges above, scoped to `governed_entity_type = 'Evidence'` instead of a bespoke Evidence-specific badge pair. No dedicated Evidence Collector/Evidence Approver badges needed. See §14a.

**One deliberate, narrow exception, not a reversion to the general principle:** for Pack lifecycle specifically, `Active → Retired` and `Retired → Archived` may not be performed by the same user, even when both are legitimately authorised under the same Approver grant (`governed_entity_type = Pack`). This is an intentional extra safeguard on this specific transition pair, not evidence that same-actor checks are needed generally — see §11b.

### 8.1 Tenant inheritance and customization

A Tenant inherits the Platform's recommended badge catalog by default at setup — this applies to Layer 2b (Engineering) now; Layer 2a follows the same mechanism once its own catalog is enumerated in Phase 12 (§8.3). **Layer 1 (Platform) is deliberately not part of this — corrected 2026-08-05, tightened 2026-08-05.** An earlier revision of this paragraph included Layer 1 here too, which was wrong — though not for the reason first stated: a freshly `derived_from`'d badge only inherits its parent's *scope boundary* (§9), not the parent's actual wired-up `authority_rules` or the specific named check §11a runs against `root`'s own code — so a Tenant-derived variant wouldn't automatically be "capable of the same platform-wide bypass" the way the earlier wording claimed; that overstated a mechanism that isn't actually automatic. The real reason is simpler and doesn't depend on how inheritance happens to work: Layer 1 badges represent platform-wide administrative authority, which by definition belongs to no single Tenant — there's no coherent notion of "a Tenant's own copy" of something unscoped in the first place, independent of what that copy could or couldn't later do. This also matches the ownership boundary the rest of the design already draws: §8.2 has Layer 1 badges created by Platform badge holders through the Identity Management UI; §9's top-down chain has each layer's badges created only by the layer above it. A Tenant creating Layer 1 badges would cut across that boundary regardless of the scope-inheritance mechanics. Layer 1 badges are created exclusively by Platform badge holders (§8.2) — never through Tenant inheritance/customization, which stays Layer 2b/2a's mechanism only. A Tenant may **rename** any inherited badge freely — cosmetic, no boundary concern. A Tenant may also **add a new badge**, but every added badge must declare which one Platform-recommended badge it's a variant of (`derived_from`, §9) and inherits that parent's scope boundary — it cannot span or combine two. Concretely: a Tenant cannot add a badge that covers both Creator's and Approver's authority, because that would require declaring two parents, which isn't a legal row. A Tenant *can* add, say, a narrower "Senior Approver" badge derived from the recommended "Approver" badge, since that stays inside the parent's boundary rather than crossing it. This makes the "one parent only, never two" half of the "respect the same duty-separation boundaries" principle mechanical, not just stated — `derived_from` is a single, required column (not a real FK, §9 — `code` isn't globally unique, so a plain foreign key can't express this; enforced by the single writer function instead), so a spanning badge is structurally impossible to insert. What this does **not** yet check is whether a child badge's own granted actions actually stay *inside* its parent's permitted-action set once it exists (e.g. nothing stops someone from later attaching an out-of-boundary `authority_rules` row to a legitimately-derived child) — that verification is still undesigned (§17.3).

### 8.2 Layer 1 — Platform badges

Identities that manage tenants and perform platform-wide administration — not scoped to any one tenant's engineering activity. **Revised 2026-08-05: not one tiered badge — a small flat catalog of distinct, single-responsibility Platform-layer badges**, the same treatment as Layer 2b, e.g. everyday platform administration as one badge, Pack Registry administration (§11b) as a separate one, Tenant creation as another.

**Sharpened 2026-08-05, named 2026-08-05: this catalog doesn't need pre-enumerating — only its one seed badge does, and that's just a label, not a design question.** The bootstrap flow (below, §9) already forces exactly one Platform badge to be concretely defined at design time: the one `SUPERUSER_EMAIL` provisions, carrying full administrative authority — called **`root`**. Every other Platform-layer badge — a narrower Pack-Registry-only badge, a Tenant-creation-only badge, anything else that turns out to be organisationally useful — is created later, as an ordinary `badge_types` row, by whoever holds that first badge, through the Identity Management UI. This is the same mechanism §8.1 already gives a Tenant for adding its own badges — Layer 1 doesn't need special design-time enumeration, it needs the one seed badge and the same generic, already-built UI/data mechanism. §11a and §11b currently say "a specific, designated Platform-layer badge (TBD)" — that's this same seed badge, not a separate undecided one.

**Every registered identity also gets one universal, inert default badge — not left `NULL`.** A new **Viewer** badge (`badge_types` row, `scope_kind = None`, carries no real permitted actions — a marker of "is a registered identity," not a grant of authority) is assigned automatically at registration, for every identity regardless of which layer they'll eventually operate in. Which badge is "the default" is itself config (an env var or a `badge_types.is_default` marker), never a bare `NULL` `badge_grants` row needing its own explanation — the same discipline §11a already established when it rejected `scope_id = NULL` as an overloaded wildcard. This is orthogonal to, not a substitute for, the top-down granting chain below: holding Viewer confers nothing beyond "exists as a registered identity" — every real capability still has to be explicitly granted by whoever is above it in the chain.

**Chapter grounding:** Ch.40 §10, and the Dual Authority ADR's Platform Authority half.

**Shape:** flat, unscoped (`scope_kind = None`) per badge. Checked by a new, separate function backed by `badge_grants`, not by `requireRole()` — see §5's correction and §11: `requireRole()`/`users.role` stay untouched, this is a narrower, new check for genuinely platform-administrative actions only.

**Bootstrap:** the very first real Platform badge is not seeded directly and does not come from a first-run setup wizard — it's driven by the existing `SUPERUSER_EMAIL` environment variable already in `src/routes/web/auth.js`. See §9. Grants the one seed Platform badge (above) carrying full administrative authority, *in addition to* the universal Viewer default every registration gets.

**Grants Tenant Admin badges:** only a holder of the seed Platform badge (or a later-created, narrower badge the Identity Management UI has given Tenant-creation authority specifically) may set up a Tenant and grant its first Tenant Admin badge (§8.3) — not self-service, not something a Tenant Admin can do for another Tenant or extend to themselves.

### 8.3 Layer 2a — Tenant Admin badges

Tenant-scoped administration: onboarding/offboarding Engineering users, Participant assignment, AI Participant allocation, *within one Tenant*. Granted only by a Platform badge holder as part of Tenant setup (§8.2) — never self-granted.

**Chapter grounding: this tier is not currently modeled in Ch.40 or Ch.42.** Ch.40's Dual Authority ADR is explicitly two-tier (Platform/Engineering); its Administrative Security domain (§7) reads platform-wide, not tenant-scoped. Ch.42 is unbuilt, and the two chapters have never been reconciled on this point — a real gap between the two chapters, not an oversight in this design. It only becomes unavoidable once Tenant is a real concept, which is exactly what this phase introduces.

**Shape:** for Phase 10, a single flat grant (held or not) — no sub-badges of tenant administration have been asked for yet. Scoped to one `tenant_id`. **Revised 2026-08-05:** this layer is also expected to become multiple distinct badges eventually (e.g. separating onboarding authority from Participant/AI-allocation authority), the same single-responsibility treatment as every other layer — but which badges, and what each one covers, is explicitly Phase 12 work, not enumerated now. Phase 10 ships the one flat badge; the layer's *shape* (a flat catalog, not a tiered one) is already decided so Phase 12 doesn't have to redesign the mechanism, only populate it.

**Open (handoff item 3, restated):** whether this eventually becomes a formal third tier in Book 3's own Dual Authority ADR, or stays an implementation-layer concept reconciled against Ch.42 later, once that chapter is actually built. Not decided here — flagged for whoever reconciles Ch.40/Ch.42.

### 8.4 Layer 2b — Engineering badges: Creator, Reviewer, Approver

**Rewritten 2026-08-05 — three badges, not one per Capability.** Where §8.2/§8.3 are platform/tenant administration, the working engineering badges are just these three, per §8.0:

- **Creator** — performs the work: `Defined → In Progress` on whatever governed entity it's scoped to.
- **Reviewer** — produces Findings against the entity (Ch.25 Review Model), a parallel authority, not a transition on the entity itself.
- **Approver** — moves the entity forward through its governed states (`In Progress → Approved`, `Approved → Baselined`), genuinely distinct from Creator.

Each is scoped by `governed_entity_type` (§9 — reuses the existing `TransitionEntityType` enum: `Deliverable`, `Evidence`, `Pack`, and any other type this pattern extends to) plus either one SEU instance or a Pack code (`scope_kind = SEU` or `Pack`), per whichever fits — a Deliverable-scoped grant is naturally SEU-scoped; authority over a Pack's *contributed* capability, wherever composed, is the same three badges with `scope_kind = Pack` instead. Whether a grant additionally narrows to one Capability within that entity type is resolved — mandatory, where the entity type has one — see §8.0.

**Confirmed 2026-08-05: which specific SEU a given Creator/Reviewer/Approver grant's `scope_id` points at is determined by Participant deployment/provisioning, not by this document.** This design supplies the mechanism — a `badge_grants` row can be scoped to one `seu_id` — but the actual workflow that decides *which* SEU(s) a given identity gets provisioned onto is Participant deployment/provisioning, called out earlier (§10) as not yet built. Phase 10 doesn't need that workflow to exist to define the badge schema; it does need it before `badge_grants` rows for Engineering badges can actually be issued in practice, same dependency §10's badge-switcher UI already has on the same not-yet-built piece.

Each badge is flat and single-responsibility (§8.0, §3): Creator, Reviewer, and Approver are three separate catalog rows, never one badge with internal levels. This also collapses what would otherwise have been a bespoke badge per Capability, a separate bespoke Evidence Collector/Evidence Approver pair (§14a), *and* a separate Pack Owner badge (below) into the same three generic badges, differentiated by `governed_entity_type` and `scope_kind` on the grant, not by badge identity.

**Decided 2026-08-05: Pack administration needs no dedicated badge — §11b's earlier open call is closed.** A Pack is already a `TransitionEntityType` (`Pack`), transitioned through the same `transitionEngine`/`authority_rules` machinery as a Deliverable — there's no structural reason it needs its own badge any more than Deliverable or Evidence do. The two things a "Pack Owner" badge used to cover turn out to be the *same* generic mechanism, cleanly separated by which of the two axes varies: **administering a Pack's own lifecycle** is Creator/Approver with `governed_entity_type = 'Pack'` and `scope_id` = that Pack's own code; **authority over transitions a Pack's *contributed* capability governs elsewhere** (e.g. Deliverable transitions, wherever that Pack is composed) is Creator/Reviewer/Approver with `governed_entity_type` set to the governed content's own type (`Deliverable`, etc.) and `scope_kind = Pack` pointing at the contributing Pack's code instead of one SEU. Both are `scope_kind = Pack`; what tells them apart is `governed_entity_type` — no ambiguity, no dedicated badge, no special case. See §11b for how this plays out across the actual Pack lifecycle transitions.

**Chapter grounding:** Ch.22 (Authority Model) — "permission to perform a governed state transition... attaches to transitions, not to objects or job titles" — and Ch.25 (Review Model) for the Reviewer badge specifically.

---

## 9. Proposed data model

All new tables are SEU-platform-scoped (new migration file(s), not `schema.sql`).

### `tenants`
Unchanged from the prior draft — the Ch.42 Tenant, minimal (`id`, `code`, `name`, `status`, `created_at`). Seed: one `default` row, `status = 'Operational'`.

### `badge_types` (the recommended badge catalog, tenant-overridable) — revised 2026-08-05, sharpened 2026-08-05

No longer a handful of fixed abstract categories, and no longer a per-Capability list either. `badge_types` holds one row per *badge* — flat, single-responsibility, across all three layers (§8): a universal **Viewer** badge (`scope_kind = None`, no real permitted actions — the default every registration gets, §8.2/§9), the seed Platform badge (§8.2, `root`, carrying full administrative authority — the only other Layer 1 row this pass requires; anything narrower is added later via the UI), the Tenant Admin badge (§8.3), and — replacing what would otherwise have been eight-plus Capability-anchored badges, a bespoke Evidence Collector/Evidence Approver pair, *and* a separate Pack Owner badge — just **Creator**, **Reviewer**, **Approver** (§8.0/§8.4), differentiated per grant by `governed_entity_type` and `scope_kind`, not by badge identity. Six named rows total for this pass (Viewer, seed Platform, Tenant Admin, Creator, Reviewer, Approver) plus whatever a Tenant or a Platform badge holder adds later through the UI.

| column | type | notes |
|---|---|---|
| `tenant_id` | TEXT, NULLABLE, FK → `tenants.id` | `NULL` = Platform-recommended badge, inherited by every Tenant by default; non-`NULL` = a Tenant's own renamed or additional badge |
| `code` | TEXT | unique per `(tenant_id, code)` |
| `name` | TEXT | |
| `scope_kind` | TEXT | `None` \| `Tenant` \| `SEU` \| `Pack` — what a grant of this type must be scoped by |
| `derived_from` | TEXT, NULLABLE | **not a real FK, corrected 2026-08-05** — `code` is only unique per `(tenant_id, code)`, not globally, and Postgres foreign keys can't target a partial unique index (only a full `UNIQUE` constraint or the primary key), so a plain `FK → badge_types.code` is invalid as stated. Only set when `tenant_id` is not NULL — which single Platform-recommended badge this Tenant-added badge is a variant of (§8.1). Validity (does it resolve to a real, *Platform-recommended* row) is checked by the single writer function below, the same way `scope_id` already is. NULL for every Platform-recommended row itself. |
| `tiered` | BOOLEAN, default `false` | reserved extensibility flag — see `badge_tiers` below. No badge in the initial catalog sets this `true`. |

Resolution follows the same Tenant-override-then-Platform-default fallback as before. Renaming an inherited badge is a plain `UPDATE` on a Tenant's own copy; adding a new badge requires `derived_from` to be set (§8.1) — enforced the same way as `badge_grants`' other invariants (§9's Enforcement point, below).

### `badge_tiers` / `canonical_ranks` — reserved extensibility mechanism, not the default (revised 2026-08-05)

**Ranking is not the default mechanism any more (§3, §6 goal 8).** Badges are flat: held or not. `badge_tiers` and `canonical_ranks` stay in the schema as a reserved, opt-in path for the rare badge type that later turns out to genuinely need graded internal authority (`badge_types.tiered = true`) — but nothing in the initial catalog uses it, and no check in §11 needs to reason about rank for Phase 10. Kept rather than deleted because `authority_rules` already has a real, working precedent for "this specific action needs more authority than that one" (e.g. Pack reactivation gated at `power` today) — if that need resurfaces for a specific badge, the mechanism already exists and doesn't require redesigning the catalog table. Shape, for when it's needed: `badge_tiers` (`tenant_id` nullable FK, `code`, `name`, `rank` — an INTEGER FK to `canonical_ranks.rank`, never a free integer, so a Tenant's custom tier still maps to a fixed, Platform-owned *position* even if its *name* is their own) and `canonical_ranks` (small, fixed, Platform-owned positions, not Tenant-configurable). Not seeded, not wired into any check, for this pass.

**`authority_rules.authorised_role` is replaced by `required_badge_type`** (FK → `badge_types.code`) **only** — a flat match against one specific badge, no rank comparison. (`required_rank`, an `INTEGER` FK to `canonical_ranks.rank`, is reserved alongside `badge_tiers` for the same opt-in case above — meaningful only when `required_badge_type` points at a `tiered = true` badge, which none do today. Left NULL otherwise.) A Pack-authored Authority Rule says "requires the Approver badge," not "requires rank ≥ 2" — this is what keeps rules portable across Tenants: a Tenant can rename a badge, but the underlying `code` an Authority Rule references doesn't move.

**Badge compatibility rules — dropped, 2026-08-05, not merely deferred.** An earlier version of this section proposed a `badge_compatibility_rules` table (`Excludes(pack_admin, engineering_seu)`, etc.) as a runtime cross-badge check at grant time, to enforce "a Pack owner cannot do any engineering state transitions." That table is superseded, not just unbuilt: under §8.0's model, a Pack Owner badge's own permitted-action scope simply never includes SEU-level engineering transitions in the first place — there is nothing for an exclusion rule to prevent, because the authority was never granted to that badge to begin with. The "within an engineering team, badge-level restrictions" case generalises the same way: each recommended badge (§8.4) is defined with its own narrow scope, not carved out from a shared pool via exclusion rules against other badges. See §8.0 and §14a for the fuller reasoning and the mechanism (explicit acting-badge selection) that replaced this.

### `badge_grants` (the actual assignments — this is where identity meets authority)

| column | type | notes |
|---|---|---|
| `id` | UUID PK | |
| `holder_type` | TEXT | `User` for every real grant built now; other Ch.40 §8 identity types reserved, not implemented |
| `holder_id` | TEXT | polymorphic — `users.id` when `holder_type = 'User'` |
| `badge_type` | TEXT FK → `badge_types.code` | |
| `governed_entity_type` | TEXT, NULLABLE | **new, 2026-08-05.** Only meaningful for the Creator/Reviewer/Approver badges (§8.4) — which governed entity this grant applies to. Reuses the existing `TransitionEntityType` enum (`src/dblayer/seuTypes.ts`) already governing `transition_definitions`/`quality_gates` — `Deliverable`, `Evidence`, `Pack`, and others as the pattern extends (§14a) — rather than inventing a parallel taxonomy. `NULL` for Viewer, Platform, and Tenant Admin, none of which are entity-type-scoped. |
| `capability_id` | TEXT, NULLABLE, FK → `capabilities.id` | **new, 2026-08-05.** `NOT NULL` when `governed_entity_type = 'Deliverable'` (mandatory Capability-narrowing, §8.0); `NULL` for entity types with no Capability dimension (`Evidence`, `Pack`) — see the invariant note below. |
| `tier` | TEXT FK → `badge_tiers.code`, NULLABLE | reserved, unused for now — only ever set for the rare `badge_types.tiered = true` badge (§9's reserved-extensibility note); NULL for every grant in the initial catalog |
| `scope_id` | TEXT, NULLABLE | a `tenant_id`, `seu_id`, or Pack/capability code, depending on `badge_types.scope_kind`; NULL when `scope_kind = 'None'` (Platform badge) |
| `status` | TEXT | `Active`/`Suspended`/`Revoked` |
| `created_at` | TIMESTAMPTZ | |

**On `governed_entity_type` and Capability narrowing — resolved 2026-08-05, schema updated (§8.0).** `governed_entity_type` answers *which kind of thing* the grant governs; a second column, `capability_id` (TEXT, NULLABLE, FK → `capabilities.id`), answers *which Capability's* work, for the entity types that have one. **Invariant:** `capability_id` is required (`NOT NULL`) whenever `governed_entity_type = 'Deliverable'` (or any future entity type this pattern extends to that also carries a Capability dimension), and must stay `NULL` for entity types that don't have one at all (`Evidence`, `Pack` — there's nothing to narrow, not an optional omission). Same enforcement shape as the existing `scope_id`/`scope_kind` invariant below: a plain `CHECK` can't reach across to know which entity types carry a Capability, so the single writer function validates this before every insert, the same point of entry as everything else in this table.

One row per grant — an identity accumulates as many rows as it holds badges. A `badge_grants` row records what an identity *holds*; it does not by itself say what any given action was performed *as* — see "Acting badge" below.

**Acting badge, not just held badges — revised 2026-08-05, sharpened 2026-08-05.** An identity may hold several `badge_grants` rows at once (§8.0). Every governed action must declare which *one* grant it's being performed under — a required parameter on the transition/action call, resolved to a specific `badge_grants.id`, not inferred by scanning all badges the actor holds for one that happens to qualify. Evaluation is a flat match: "does the *declared* grant belong to the actor, is it `Active`, and is it correctly scoped for this action's `authority_rules.required_badge_type`" — no rank comparison, since badges aren't tiered by default (§9's reserved-extensibility note covers the rare exception). This narrowing — checking the one declared grant, not scanning everything the actor holds — is what produces per-capacity accountability (§8.0, §14). Session/UI mechanics for declaring the acting badge (a badge switcher, §10) are directionally decided but not fully designed here — see open questions §17.2.

**Invariant, not currently enforced anywhere in this schema:** `scope_id` must be NULL exactly when `badge_types.scope_kind = 'None'` for the row's `badge_type`, and non-NULL — and shaped as the *right kind* of scope value (a real `tenant_id` for `Tenant`, a real `seu_id` for `SEU`, a real Pack/capability code for `Pack`) — for every other `scope_kind`. Nothing in the table definition itself stops a bug from inserting a grant with `scope_id = NULL` for a badge that requires scoping, or a `seu_id` in the `scope_id` column for a Pack-scoped badge instead of a Pack code. A plain `CHECK` constraint can't reach across to `badge_types.scope_kind` to enforce this — it only sees the current row. The same class of gap applies to `badge_types.derived_from` (§9, §8.1) — and more sharply, since `derived_from` can't even be a real `FK` in the first place: `code` is only unique per `(tenant_id, code)`, not globally, and Postgres foreign keys can't target a partial unique index (only a full `UNIQUE` constraint or the primary key), so `FK → badge_types.code` alone is invalid, not just under-constrained. Nothing but application logic can stop a Tenant-added badge from being inserted without `derived_from` set, or with it pointing at something other than a genuine Platform-recommended row.

**Enforcement point:** a single function (the only writer of `badge_grants` rows — no other code path inserts into this table directly) validates the `scope_id`/`scope_kind` invariant before every insert: look up `badge_types.scope_kind` for the given `badge_type`, confirm `scope_id`'s nullability matches, and for `Tenant`/`SEU`/`Pack` confirm `scope_id` actually resolves to a real row of the right kind (`tenants`/`seus`/`packs` respectively) — the same shape `validatePackSeed` already uses to resolve a Pack's declared dependencies against the real Registry, not just check they're present. The equivalent single-writer function for `badge_types` itself checks three things, not two: `derived_from` is set whenever `tenant_id` is not NULL; it resolves to an existing `badge_types` row with `tenant_id IS NULL` specifically — a genuine Platform-recommended badge, not another Tenant's custom row (§8.1's actual invariant: "a variant of a Platform-recommended badge," not "a variant of any existing badge"); and that parent's `scope_kind` is not `'None'` — Layer 1 (Platform) badges are unscoped and deliberately excluded from Tenant customization entirely (§8.1's correction), so `derived_from` may never point at a `scope_kind = 'None'` row. Checking only "is set" would let a Tenant derive a new badge from another Tenant's own custom badge, or from an unscoped Platform badge, both of which quietly defeat the boundaries §8.1 depends on. A database trigger was considered as a belt-and-suspenders alternative and rejected for consistency — nothing else in this schema uses triggers, and the existing precedent throughout this codebase for a check a plain `CHECK`/`FK` can't reach is a validation function at the one point of entry, not database-level procedural code.

### Provisioning (decided 2026-08-05 — supersedes the earlier "Backfill" plan)

**No backfill.** The platform is not in production — there is no existing user population whose behaviour needs preserving through a migration. The question this design needs to answer is not "how do existing users keep working," it's "how does a badge ever get created in the first place." Answered in three parts:

**0. Every registration gets the universal Viewer default (§8.2) — never a `NULL`/empty `badge_grants` set.** At account creation, before anything else, every identity is granted the one configured default badge (`Viewer`, `scope_kind = None`, no real permitted actions). This is not a shortcut to real access — it exists purely so "does this identity hold any badges at all" is never an unrepresented, ambiguous state that needs its own explanation later.

**1. Bootstrapping the first real Platform badge — hooks into existing infrastructure, not a new setup wizard.** `src/routes/web/auth.js` already has `SUPERUSER_EMAIL` (`const SUPERUSER_EMAIL = (process.env.SUPERUSER_EMAIL || '').toLowerCase();`), used today to recognise the designated superuser account. This design reuses it rather than inventing a first-run wizard: at login (the same point session identity is already established), if the authenticated user's email matches `SUPERUSER_EMAIL` **and no `badge_grants` row exists yet for them at all** — checked by presence of any row, not by presence of an *Active* one — create one, granting the `root` badge (§8.2, the seed Layer 1/Platform badge, carrying full administrative authority; no `tier`, since Platform badges are flat). After that it's an ordinary row: visible, auditable, and genuinely revocable. The "any row, not just Active" check is the detail that makes revocation real — if this only checked for an *Active* row, an explicit later revoke (`status = 'Revoked'`) would just get silently re-created on the next login, which isn't a revoke at all.

**2. Everything after that is granted top-down, three levels, never self-acquired:**

```
Platform badge holder
   │  creates a Tenant, grants that Tenant's Tenant Admin badge
   ▼
Tenant Admin badge holder (scoped to one Tenant)
   │  onboards Engineering users within their own Tenant, grants Engineering badges
   ▼
Engineering badge holder (scoped to one SEU or one Pack-contributed capability)
```

No level grants itself. **Trigger point for the third level, named explicitly:** a SEU's first Engineering-badge grant naturally happens at SEU commissioning — an existing platform event this design hadn't previously tied badge issuance to. The Tenant Admin, at (or after) commissioning a new SEU, grants the first Creator/Reviewer/Approver badge(s) scoped to that SEU to whichever engineering user is onboarding onto it; nothing about the SEU exists as a governable target for a badge grant before it's commissioned. No Engineering badge is a default anyone gets implicitly — every one is an explicit grant a Tenant Admin makes when onboarding an engineering user, badge by badge. There's no implicit baseline access under this model at all — the earlier draft's anxiety about "losing baseline access" was still thinking in terms of a flat role everyone starts with, not a badge that's always the result of somebody above deliberately granting it. Whether onboarding should bundle some default set of badges automatically is real Tenant-onboarding UX, descoped to Multi-Tenancy/Phase 12 rather than answered here (§17's intro) — not a gap in this model.

**Note on "self-service," reconciling this with §7's carve-out:** "top-down, not self-service" (this section) describes how a badge is *acquired*. §7's "Tenant self-service admin... in-scope" describes what a Tenant Admin can then do *once they hold the badge* — administer their own Tenant (configure `badge_tiers`, onboard Engineering users, grant Engineering badges) without needing the Platform operator to perform each action for them. Acquiring the badge is never self-service; using it to administer what it scopes to is exactly the point of holding it.

No existing SEU/Deliverable/Pack/etc. row needs a `tenant_id` — Phase 12's retrofit, not started here.

---

## 10. Session shape

Badges are scoped per-request (which SEU, which Pack), so caching the *whole* badge set in `req.session.user` doesn't fit the way the old flat-role shape did. Proposed — **additive**, not a replacement of the existing session shape (`role` stays, per §5's correction: `requireRole()` still reads it, unchanged, for the rest of the app):

```js
req.session.user = {
  id, email, name, avatar_url, is_active, role,      // unchanged — requireRole()/the rest of the app keeps using this
  platformBadges: string[],  // NEW — Platform-layer (§8.2) badge codes held, cached at login from badge_grants; flat list, no tier — checked only by the new platform-badge-gated SEU admin actions, not every route
}
```

Everything scoped (Tenant Admin, Engineering) is **not** cached in session — it's queried against `badge_grants` at the point of the actual check, the same way `authority_rules` is already a live lookup today, not something carried in session. This is simpler than the prior draft's attempt to cram `tenantId`/`engineeringAuthority` into the session, and more correct: which SEU or Pack is relevant varies per request, so it can't be pre-resolved generically at login.

**Acting-badge selection, revised 2026-08-05 — direction set, detail deferred.** §9's "acting badge" mechanism (every action performed as one explicitly declared badge) needs some UI/session surface for a user holding multiple qualifying badges to select or confirm which one is active. Direction: a **badge switcher** — the user explicitly switches into one of the badges granted to them, and that becomes the acting badge for subsequent actions until switched again (session-level, not a per-action picker on every single call). The finer mechanics (where it lives in the UI, whether it's session-scoped or nearer to per-action, how it interacts with a user who only holds one qualifying badge and has nothing to switch between) are deliberately deferred to when Participant deployment/provisioning is revisited, not designed here — see open questions §17.2.

---

## 11. How the checks consume this

- **`requireRole()`/`users.role`**: **unchanged**, not part of this design at all (see the §5 correction) — kept for whatever the rest of the app already uses them for.
- **New Platform-badge check** (name TBD, e.g. `requirePlatformBadge(badgeCode)`): a flat match — does the actor hold the specific Platform-layer badge (`req.session.user.platformBadges`, cached at login from `badge_grants`) the target action's `authority_rules.required_badge_type` names. No rank comparison. Used only by genuinely platform-administrative SEU surfaces (Pack Registry lifecycle at minimum).
- **`transitionEngine.evaluate`** (Engineering badge): takes the actor's *declared acting badge* (§9, §10) as an input, not a set to search — first applies the Platform-badge bypass (§11a); if that doesn't settle it, confirms the declared `badge_grants` row belongs to the actor, is `Active`, is correctly scoped for the entity/Pack-capability being transitioned, and its `badge_type` flat-matches `authority_rules.required_badge_type` — never scanning the actor's other held badges for one that would have qualified instead.
- **Tenant Admin badge**: consumed by whatever ends up administering tenant membership (§8.3) — not built as part of the initial admin surface, same new-Platform-badge-check gate pattern, scoped by `tenant_id` instead of unscoped.
- A transition can require **more than one badge** — see §11b: Pack administration is the concrete case, decided, being built as part of this phase rather than deferred.

### 11b. The composed check: Pack administration (decided — building this now)

Per direct steer: build this now, not later — Pack administration needing both a Platform and an Engineering badge is the one place this whole design's justification (composability) actually gets exercised. Shipping the badge model without it means shipping a model that's never proven to do the thing it was built to do.

Pack lifecycle transitions split the same way they already do today, using the generic Creator/Reviewer/Approver badges (§8.4) with `governed_entity_type = 'Pack'` — **no dedicated Pack Owner badge, decided 2026-08-05** (§8.4):

- **Draft → Validated → Published**: unchanged in spirit — a single check, a Creator/Approver grant, `governed_entity_type = 'Pack'`, scoped to that Pack's own code.
- **Published → Active, Active → Deprecated, Deprecated → Retired, Retired → Archived, and reactivation from any terminal state**: require **both**, independently:
  1. the `root` badge (§8.2), or a later-created, narrower Platform-layer badge the Identity Management UI has given Pack Registry administration authority specifically — Pack Registry administration is a platform-wide concern (Ch.38's Administrative Security domain), not one Tenant's or SEU's engineering governance; and
  2. an **Approver grant, `governed_entity_type = 'Pack'`**, scoped to that Pack's own code — the same generic badge §8.4 defines for every other entity type, applied to a Pack's own lifecycle rather than a bespoke administrative badge.

Both must independently pass — genuinely AND, not either-or, satisfying SA-004 (security is layered) with a real case instead of a hypothetical one.

**Resolved 2026-08-05 — the one-badge-vs-two-badges call this section used to flag is closed, not because duty separation forced a choice, but because the premise (Pack needs a bespoke badge at all) doesn't hold.** A Pack is already a `TransitionEntityType`, governed the same way a Deliverable is. "Authority over transitions a Pack's contributions govern elsewhere" and "authority over the Pack's own lifecycle" were never actually the same *badge* question — they're the same generic Creator/Reviewer/Approver mechanism, distinguished cleanly by `governed_entity_type` (`Deliverable` vs. `Pack`) and `scope_kind` (both `Pack`-scoped, but governing different entity types). No dedicated badge needed either way, and nothing to reconcile between "one badge or two" since it was never really about the badge — it was about which entity type and scope a perfectly ordinary Approver grant applies to.

**Added 2026-08-05, direct steer, deliberate exception to §8.0's general principle:** within this composed check, `Active → Retired` and `Retired → Archived` may not be performed by the same user, even though both are legitimately authorised under the same Approver grant (`governed_entity_type = Pack`). This is a narrow, targeted extra safeguard on this specific transition pair in the Pack lifecycle tail — not a reversion to same-actor-consecutive-transition checking generally (§8.0 explicitly moved away from that as a general mechanism). Mechanically: whatever performed `Active → Retired` for this Pack must be recorded (§14), and `Retired → Archived` must check that the declared acting identity differs from it.

### 11a. Platform-badge bypass on Engineering-badge checks — resolved 2026-08-05, no real tension

An earlier version of this design backfilled a `badge_grants` row for every existing user with `badge_type = 'engineering_seu'` and `scope_id = NULL`, intending NULL to mean "wildcard — matches every SEU." That overloads one column with two different meanings depending on context nobody enforces: for a Platform badge, `scope_id = NULL` means *"this badge type has no scope concept"* (`scope_kind = 'None'`); for a wildcard Engineering grant, the same NULL would mean *"this badge type does have a scope concept, but this grant matches all of them anyway"* on a badge type whose `scope_kind` is `'SEU'`, not `'None'`. Same value, two meanings, silently — rejected.

**Replacement rule, explicit and named:** holding the `root` badge (§8.2 — not a rank threshold, since Platform badges are flat) satisfies **any** Engineering-badge requirement, at any scope, without a corresponding `badge_grants` row. (A narrower, later-created Platform-layer badge could also be granted this bypass if the Identity Management UI is used to wire it into the same check — but `root` is the one this design guarantees exists.) This is checked first, as a distinct, visible branch in `transitionEngine.evaluate` — not folded silently into the scoped lookup. It's also a more honest description of what today's flat role actually did: a `power`/`super` identity today could already do anything, unconditionally, because Platform role and Engineering authority were the same value. Naming that as a real rule is more accurate than pretending it doesn't exist.

**Previously flagged as a tension, corrected 2026-08-05: there isn't one.** §9's acting-badge mechanism is universal — *every* governed action requires declaring which specific `badge_grants` row it's performed under, as a required parameter on the call itself, not something conditional on which check the action happens to need. So when a Platform badge holder invokes an action that would normally require an Engineering badge, they still declare an acting badge for that call — they just declare their Platform badge instead of an Engineering one, because that's the one they hold. The transition record shows "acting badge = [that Platform badge]," exactly as attributable as any other action. There was never a silent, undeclared path here to resolve — the earlier framing described a gap against §9's own rule that already closes it. §11a's bypass isn't a special case needing its own declaration mechanism; it's an ordinary declared action whose declared badge happens to satisfy a different check than usual.

**General-tier baseline access — resolved differently than originally framed, given no backfill (§9).** The original concern (a low-tier identity losing today's baseline capability) was a migration-regression question; with no existing users, it doesn't apply. Going forward, an Engineering user's baseline access comes from whatever recommended badge(s) the Tenant Admin grants at onboarding (§8.3) — not from a bypass. Whether onboarding should default to some baseline grant automatically, or require the Tenant Admin to explicitly select every badge/scope, is real Tenant-onboarding UX — descoped to Multi-Tenancy/Phase 12, not answered in this document (§17's intro).

---

## 12. Configurability — what "modular" buys

- A new badge type (e.g. a future `pack_publisher` badge) is a data row, not a code change.
- **Tenant-configurable badges (§8.1, §9, sharpened 2026-08-05):** a Tenant can rename any inherited badge, and add new ones derived from the recommended catalog, without touching the Platform default or any other Tenant's — the kind of "further changes easily incorporated" this design was asked for. Ranking, if a specific badge ever needs it, is a reserved opt-in (§9) rather than something every badge carries.
- `authority_rules` continues to be the place *which transitions* need *which badge* — already fully data-driven, and Tenant-vocabulary-portable (§9) since requirements reference a stable `badge_types.code`, not a Tenant's own display name for it.
- Badge types are **not** Pack-contributed (FR-40.5) — direct seeding plus the Identity Management UI's own extensibility already covers the need; resolved, not an open question (§17's intro).

---

## 13. Deliberately not unifying with `participants`

Unchanged from the prior draft: `participants` stays exactly as it is. Whether a Human Participant should optionally reference a `users.id` (and by extension, whether Participants become badge-holders via `holder_type = 'Participant'`) is a real, separate future question, not decided here.

---

## 14. Traceability / events

**Revised 2026-08-05 — elevated from optional to central.** Under the recommended-badge-and-acting-badge model (§8.0, §9), traceability isn't an add-on, it's the entire mechanism accountability depends on: "Sudha as Approver on Pack X did Y" vs. "Sudha as Creator drafted the Requirements Specification" only holds if every governed transition records *which badge was active* for that action, not just which identity performed it. Every governed transition event needs an acting-badge field (a `badge_grants.id` reference), not only `AuthorisationDenied`/`AuthorisationGranted`. `BadgeGranted`/`BadgeRevoked` (when a Tenant Admin or Platform badge holder actually grants/revokes a badge, not just seeds one) follow the same reasoning and should ship alongside — the `SUPERUSER_EMAIL` auto-provision (§9) is exactly the kind of grant that needs to be a real, auditable event to justify calling it "traceable" rather than a hidden default. Session/UI mechanics for how the acting badge is declared per-action (§10) directly determine what's available to stamp on each event — the two are the same piece of work, not sequential ones. Open question §17.5.

### 14a. Separation of duties — replaced by Creator/Reviewer/Approver, sharpened 2026-08-05

**No longer "representable, not enforced," no longer a `qualityGateEngine`/`transitionEngine` behaviour addition, and no longer a bespoke Evidence-specific badge pair.** Superseded by §8.0/§8.4: Creator/Reviewer/Approver **is** the Separation of Duties mechanism, not a separate thing layered on top of it — there is no dedicated "SoD system" in this design, only the generic badge model applied consistently. Duty separation lives in how the generic badges are scoped, not in a same-actor-on-consecutive-transitions check, and not in Evidence-specific badge names. The concrete case that motivated this (Evidence `Collected → Validated` vs. `Validated → Accepted`, same actor, no rule preventing it) resolves the same way as the Deliverable case: `Collected → Validated` is the **Creator**'s action, `Validated → Accepted` is the **Approver**'s, both grants carrying `governed_entity_type = 'Evidence'`. No Evidence-specific badges needed — this is the same mechanism §8.4 defines for Deliverables, just a different value in one column. Enforcement is the ordinary badge-grant check already built for every transition, not a special SoD mechanism: whoever attempts `Validated → Accepted` must hold an Approver grant scoped to `Evidence`, and if the same identity only holds the Creator grant for that Evidence Item's SEU, the check fails the same way any other missing-badge check would. (No Capability-narrowing applies here — `EvidenceRow` has no Capability dimension, §8.0 — this check is `governed_entity_type` alone.)

**What this does and doesn't guarantee, worth being precise about:** the badge *structure* only makes real separation possible — it doesn't force it. Nothing stops a Tenant Admin from granting the same identity both Creator and Approver for the same `governed_entity_type`/SEU; that identity would still be able to perform both steps, just as two separately-declared, separately-recorded acts (§8.0). Whether that's acceptable or should itself be restricted is a granting-policy question, not a schema question — this design provides the two distinct badges and the accountability trail; whether an organisation's Tenant Admin actually co-grants them to one person, or deliberately doesn't, is what determines whether SoD holds in practice for that Tenant. This is also the concrete shape of "extensible" (§8.0): Knowledge and Decision, which have the same propose-then-accept lifecycle shape, would need no new badges either if this pattern extends to them — just `governed_entity_type = 'Knowledge'` / `'Decision'` on the same two badges, not decided here. The one deliberate exception beyond this general mechanism is §11b's Pack `Active → Retired`/`Retired → Archived` same-user restriction, which *does* need a same-actor check — narrow and named, not a reversion to the general approach.

---

## 15. Deployment topology — open, and it changes the model

**Not decided, and directly relevant, not deferrable:** is the SEU platform a shared multi-tenant service (one deployment, many Tenants, a small distinct group of Platform-badge holders belonging to the operator), or deployed per-tenant (e.g. containerised into the tenant's own infrastructure)?

- **Shared service:** Platform badge and Tenant Admin badge are meaningfully distinct populations — a platform operator is not usually also a tenant's own admin.
- **Self-hosted / per-tenant:** there may be no separate "platform operator" at all. The tenant's own team *is* the platform administrator for their deployment — Platform badge and Tenant Admin badge could collapse onto the same identities entirely.

This changes whether Layer 1 and Layer 2a (§8.2, §8.3) are always-distinct populations or sometimes-merged, which in turn affects whether they need to stay two separate badge types (current proposal) or could be one type with two scope levels. Proposed for now: keep them as two separate `badge_types` regardless of deployment topology — a self-hosted deployment simply grants the *same* identity both badges, which the schema already allows, rather than the schema needing to know which topology it's running under.

---

## 16. Reference points consulted

Checked against three real precedents, per the handoff discussion — what's taken from each, and what's deliberately not:

- **AWS IAM** — Users vs. Roles, where Roles are specifically assumable by services/machines, not humans. Taken: human-vs-service identity typing (`holder_type`, §9).
- **SAP** — user master records carry a User Type (Dialog/System/Service/Communication); SAP GRC checks for Segregation-of-Duties conflicts. Taken: identity typing again, and the SoD precedent (§14a).
- **Salesforce** — Profile + Permission Sets (composable, additive), and object/field/record-level security as three separate layers. Taken: the composable multi-badge structure itself, and the object-vs-record split, now an attribute of each recommended badge rather than two competing categories (§8.4).

**Explicitly not imported:** the full generality of any of the three — SAP's many-field authorization objects, AWS Organizations-style cross-account hierarchy, Salesforce's role hierarchy for record-sharing. This platform's actual permission surface (11 entity types, transition-scoped Authority) is far smaller than what any of these were built to handle; importing that scale of machinery would be over-engineering relative to Ch.40's own, deliberately simpler, two-tier ADR — the badge model extends that ADR's intent, it doesn't replace it with something bigger than the chapter asked for.

---

## 17. Open questions for review

**Fully rewritten 2026-08-05, sharpened 2026-08-05, closed out further 2026-08-05.** Several questions from the prior version are resolved and removed entirely, not restated: the Pack-administration composed check (build now — §11b), the baseline-access backfill gap (no backfill exists — §9, §11a), Separation of Duties (structural, via Creator/Reviewer/Approver — §14a), the SEU-level/Pack-level composition rule (moot — §8.0), tier vocabulary naming (moot for Phase 10 — badges are flat by default, §3/§9), **Pack Owner badge scope** (no dedicated badge needed at all — Pack is already a `TransitionEntityType`, so it's just Creator/Reviewer/Approver like everything else, §8.4/§11b), **schema/table naming** (not treated as a design question — reasonable names get picked when this is built, not litigated here), **Platform-badge bypass consistency** (§11a — there was no real tension: §9's acting-badge declaration is already mandatory for every action, so the bypass was never a silent/undeclared path, just a normal declared action satisfying a different check), and **FR-40.5 / badges as Pack-contributed data** (the Identity Management UI already gives Tenants a live way to add badges; that extensibility need is met without also making the Platform-default catalog itself Pack-installable — not needed, not just deferred). **Onboarding default is descoped, not answered here:** whether a Tenant Admin's onboarding action should auto-grant baseline Engineering badges is real Tenant-onboarding UX, and belongs with Multi-Tenancy (Phase 12) once there's an actual onboarding flow to design it against, not a Phase 10 schema question — Phase 10 only guarantees every registration gets the inert Viewer default (§8.2/§9), never zero badges. What remains:

1. **Badge catalog enumeration — closed.** Layer 2b (Engineering) collapses to three entity-type-agnostic badges — Creator, Reviewer, Approver (§8.0/§8.4), also covering Pack administration (§11b). Layer 1 (Platform) needs only its one seed badge, named `root` (§8.2); anything narrower is created later via the Identity Management UI. Capability-narrowing is mandatory wherever the entity type carries a Capability at all (`Deliverable`, via the new `badge_grants.capability_id`, §9) — not optional, and not a blanket rule for entity types with no Capability dimension (`Evidence`, `Pack`). Layer 2a's badges are explicitly Phase 12 (§8.3).
2. **Acting-badge session/UI mechanics, and SEU-scope assignment — both depend on Participant deployment/provisioning (§9, §10, §8.4), directionally decided, detail deferred.** Badge-switcher shape confirmed: the user switches among the badges granted to them, rather than a per-action picker. Finer mechanics, and *which* SEU a given Engineering-badge grant's `scope_id` actually points at, both wait on Participant deployment/provisioning being built — not this pass. Blocks actually issuing/using real Engineering-badge grants in practice, not the badge model's design.
3. **Tenant "resemblance" enforcement, narrowed (§8.1).** The "one parent only, that parent must be a genuine Platform-recommended badge, and it can't be an unscoped Layer 1 badge" half is now mechanical, enforced by the single writer function (§9 — `derived_from` can't be a real FK, since `code` isn't globally unique) — what's still undesigned is verifying a child badge's *actual granted actions* stay inside its parent's boundary once it exists, not just that it declares one valid parent.
4. **Multiple tenant memberships per identity — reframed 2026-08-05, still open.** Nothing in `badge_grants` stops one identity from accumulating grants scoped to different tenants (a Tenant Admin badge for Tenant A and another for Tenant B, say). Initially treated as "just another case of the generic badge-switcher (§10)" — that's not quite right: given cross-tenant isolation is a real boundary whose *enforcement* is Phase 12's job (§7), switching between a Tenant-A-scoped grant and a Tenant-B-scoped grant is a **tenant switch**, not an ordinary badge switch — an entirely different slice of platform data comes into scope afterward, not just a different permitted-action set within the same context. Whether the badge-switcher UI needs to treat a cross-tenant switch as visibly distinct from a same-tenant one (so it's never ambiguous which tenant's data the user is now looking at), and how that interacts with whatever Phase 12 eventually builds for isolation enforcement, is not designed here. Not blocking Phase 10 — the schema already allows the underlying case — but no longer treated as moot.
5. **Events (§14)** — elevated from optional to structurally necessary (every transition needs an acting-badge field); `BadgeGranted`/`BadgeRevoked` for real grant/revoke flows (including the `SUPERUSER_EMAIL` auto-provision, §9) still needs a final yes.
6. **Deployment topology (§15) — genuinely open, for a subsequent phase.** Shared multi-tenant service vs. self-hosted per-tenant deployment changes whether Platform and Tenant Admin badges are always-distinct populations or can collapse onto the same identity. Not a Phase 10 blocker — the schema already allows either — but a real product decision that hasn't been made, and doesn't need to be made now.
7. **Reserved tiering mechanism, when (if ever) to actually use it (§9).** `badge_tiers`/`canonical_ranks` are kept but unused — is there a concrete case among the enumerated badges (#1) that actually needs graded authority within one badge, or should this be dropped from the schema entirely rather than carried as unused reserve?
8. **New, opened by resolving #1: `capability_id` on a Deliverable with no Capability set (§9).** `DeliverableRow.producing_capability_id` is nullable — if a Deliverable genuinely has no producing Capability recorded, no Capability-narrowed Approver grant can ever legitimately match it, since the invariant requires `capability_id` on the grant whenever `governed_entity_type = 'Deliverable'`. Does that mean such a Deliverable simply can't be approved until it's given a Capability (arguably correct — an ungoverned Deliverable shouldn't be approvable by construction), or does this need a fallback? Not decided. A smaller, related question: if the Capability-narrowing pattern extends to Knowledge/Decision/Obligation later (§14a's "candidates"), does each of those also get its own Capability-bearing column the same way Deliverable has `producing_capability_id`, or is Capability specifically a Deliverable concept that doesn't generalise? Not decided, not blocking now since none of those are in scope yet.
