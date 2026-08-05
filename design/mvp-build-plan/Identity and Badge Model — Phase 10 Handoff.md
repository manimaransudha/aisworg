# Identity and Badge Model — Phase 10 Handoff

*A firmed-up view of a design discussion (2026-08-05) for whoever develops Phase 10 (`Post-MVP Build Sequence.md`, Security Architecture depth). This is planning input, not a decision already locked in — several things below are explicitly still open. Book 3 Ch.40 (Security Architecture), Ch.22 (Authority Model) and Ch.42 (Multi-Tenancy) are the relevant chapters; specific citations are given inline rather than assumed from memory.*

## Terminology: "badge," not "role"

Use **badge** for what an identity holds, not "role." The distinction matters: today's implementation (`ROLE_LEVEL: { general: 1, power: 2, super: 3 }`) is a single flat tier — one identity sits at exactly one level. A badge is a claim an identity holds, and an identity can hold **several badges at once** — which is the actual shape needed here (see "overlap of permissions," below). Book 3 Ch.40 §8 already states the underlying principle this rests on: *"Identity is independent of authority."* A badge model takes that literally — identity is one thing, the set of badges it holds is separate and composable.

## The three badge tiers, as discussed

### 1. Platform badge

Identities that manage tenants and perform platform-wide administration — not scoped to any one tenant's engineering activity.

**Chapter grounding:** Ch.40 §10 (Authorisation): *"Authorisation governs access to platform capabilities. It does not determine engineering authority."* This is that half of the chapter's own Dual Authority ADR (line 74 of Ch.40's draft notes): *"Platform Authority governs access to platform capabilities and runtime services... Engineering Authority governs permission to perform engineering state transitions. These models shall be evaluated independently."*

**Open, explicitly:** the shape of this tier depends on a deployment decision that hasn't been made — is the SEU platform a shared multi-tenant service, or deployed per-tenant (e.g. Docker, into the tenant's own infrastructure)? In a shared-service deployment, Platform badge holders are a small group belonging to the platform operator, distinct from any tenant. In a self-hosted, per-tenant deployment, there may be no separate "platform operator" at all — the tenant's own team **is** the platform administrator, and the Platform badge and Tenant Admin badge (below) could collapse onto the same identity. This isn't a detail to defer past Phase 10 — it changes whether tiers 1 and 2 are always-distinct or sometimes-merged.

### 2. Tenant Admin badge

Tenant-scoped administration: onboarding/offboarding Engineering users (integrating with the tenant's own onboarding/offboarding systems), Participant assignment, and AI Participant allocation.

**Chapter grounding: this tier is not currently modeled.** Checked directly — Ch.40's own Dual Authority ADR is explicitly two-tier only (Platform / Engineering); its "Administrative Security" domain (§7) reads as platform-wide ("protection of platform administration functions"), not tenant-scoped. Ch.42 (Multi-Tenancy) is unbuilt, and the two chapters have never been reconciled on this point. **This is a real gap between Ch.40 and Ch.42, not an oversight in this discussion** — it only becomes unavoidable once Multi-Tenancy is real, which is exactly why it's surfacing now, ahead of Phase 12.

**Open:** whether this eventually needs to become a formal third tier in Book 3's Dual Authority ADR (making it a triple, not dual, model), or whether it's better framed as a tenant-scoped *instantiation* of Platform Authority once Ch.42 exists, rather than a wholly new category. Not decided — flag for whoever reconciles Ch.40/Ch.42, separately from building Phase 10 itself.

### 3. Engineering badges — the actual Participants performing transitions

Ch.22's Authority Model territory: permission to perform specific engineering state transitions. Discussed as splitting into two scopes, which can genuinely overlap on the same identity:

- **SEU-level Engineering badge** — a grant scoped to one specific SEU instance.
- **Pack-level Engineering badge** — a grant scoped to a Pack's contributed transition/Capability, wherever it's composed, cutting across SEUs.

This is the same distinction as Salesforce's object-level vs. record-level security (object = "can this identity ever perform this class of transition, wherever declared"; record = "can this identity act on this specific instance") — arrived at independently in this discussion, not borrowed as an idiom, which is itself a reasonable signal it's the right shape rather than over-fitting a foreign model.

**Open:** how SEU-level and Pack-level badges combine when both apply to the same identity and the same action — no precedence/composition rule decided yet (does one override the other, are they purely additive, etc.).

## What's genuinely new here vs. what already exists

Checked directly against Ch.40 §8 (Identity Model) — it already names **six** distinct identity types requiring platform identity: Human Participants, AI Participants, Runtime Services, Connectors, External Systems, Pack Publishers. That's richer than this discussion initially assumed, and it means badges should be assignable to any of these, not just human logins — an AI Participant or a Pack Publisher is as legitimate a badge-holder as a human Tenant Admin.

**A specific observation from this discussion, worth stating precisely for whoever builds this:** the current codebase likely already has two structurally separate enforcement points that happen to look like one system today:

- `requireRole()` (web middleware, session-based) — gates platform/admin-flavoured routes. Functionally, this is already Platform-Authority-shaped.
- `transitionEngine.evaluate()`'s Authority Rule check (`governedTransition` + `authorisedRole`) — gates actual engineering transitions (Deliverable, Pack, Objective, etc.), called regardless of which route or API invoked them. Functionally, this is already Engineering-Authority-shaped.

**These are two independent code paths today** — but both currently resolve against the *same single flat role value* on one generic, vanilla user model (`users.role`, email/password + Google OAuth, no identity typing). That's why the separation Ch.40's Dual Authority ADR calls for isn't *evident* despite arguably already existing structurally: two genuinely separate checks, sharing one undifferentiated input, look like one system from the outside. The real Phase 10 work described here is establishing a proper typed Identity/Badge model so each of these two existing check points draws from the badge set it's actually supposed to — at which point the separation the ADR describes should become visible and real, rather than a coincidence of two functions happening to both read `user.role`.

## Reference points consulted, and what to take vs. leave from each

Raised earlier in this discussion: should this be modeled like AWS, SAP, or Salesforce? Checked against each:

- **AWS IAM** — Users vs. Roles, where Roles are specifically assumable by services/machines, not humans. Take: the human-vs-service identity typing.
- **SAP** — user master records carry a User Type (Dialog/System/Service/Communication), and SAP GRC explicitly checks for Segregation-of-Duties conflicts. Take: identity typing again, and SoD checking is the right precedent for the still-open Evidence self-approval question (see below).
- **Salesforce** — Profile + Permission Sets (composable, additive), and object/field/record-level security as three separate layers. Take: the composable multi-badge structure, and the object-vs-record split already adopted above for Engineering badges.

**Explicitly not recommended:** importing the full generality of any of these — SAP's many-field authorization objects, AWS Organizations-style cross-account hierarchy, Salesforce's role hierarchy for record-sharing. This platform's actual permission surface (11 entity types, transition-scoped Authority) is far smaller than what any of these three were built to handle, and importing that scale of machinery would be over-engineering relative to Ch.40's own, deliberately simpler, two-tier ADR.

## Already-open items this connects to, restated here so they're visible in one place

- **Editorial Log item 4** (`01_Book 1 (Refined)/_Editorial Log.md`): how a Participant Instance's platform identity relates to its Authority — this whole badge model is the concrete answer space for that question.
- **`Ebook Library Dry Run — Bug List.md` item 5**: Evidence has no separation-of-duties enforcement (the same actor can create and accept the same Evidence Item). Sudha's decision, already recorded: this is Phase 10 scope, not a standalone fix — the SAP GRC precedent above is the right shape once badges exist (require a different badge-holder for `Collected → Validated` vs. `Validated → Accepted`).
- **Same bug list, item 3's note**: who is authorised to move a Pack from `Archived` back toward `Active` (via a new version) is the same class of question, and lands here too, not as a separate fix.

## Full list of open items (not decided, needing further work)

1. Deployment topology (shared service vs. per-tenant deployment) — undecided, and directly determines whether the Platform badge and Tenant Admin badge are always distinct or can merge onto one identity.
2. AI Participant provisioning mechanism — Ch.40 §9 deliberately leaves authentication mechanisms implementation-defined; still genuinely unresolved, not just unbuilt.
3. Whether Tenant Admin needs to become a formal third tier in Book 3's Dual Authority ADR, or stay an implementation-layer concept reconciled against Ch.42 later — not decided.
4. The exact badge catalog — only the three-tier shape above exists; specific badges (e.g. "can activate a Pack," "can approve a Deliverable transition for Capability X," "can onboard an Engineering user") haven't been enumerated.
5. Composition rule for overlapping SEU-level and Pack-level Engineering badges — additive, override, or something else — undecided.
6. Whether the existing two enforcement code paths (`requireRole`, `transitionEngine`'s Authority Rule check) can be incrementally re-pointed at genuine badges, or need to be rebuilt — a call for whoever actually does the Phase 10 implementation work, informed by reading the current code, not decided here.
