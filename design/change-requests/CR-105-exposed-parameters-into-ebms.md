# CR-104 — Enforce EBM exposed parameters

**Raised:** 2026-09-12 · **Origin:** 
How do we model the kickoff of the first deliverbale in the chain? **Status:**  ✅ Closed 2026-09-13

## Current behavior
- what is Correctly materialized and consumed in EBM:

- Competency Requirements — materialized onto ebms.behaviors: competencyRequirements (real JSONB column, written by compositionCompleted.ts at composition time) and consumed live by participantEligibility.ts for real eligibility filtering (participantEligibility.ts:57-65). 
- Capabilities: deriveDedupedCapabilitiesFromPackCodes was explicitly fixed (CR-079) to scope by the Template's own selected Pack codes only, not a bare cross-Pack code match. Correctly composition-scoped today.
- Services / Service Level metrics — reached only through Capability, which is already correctly scoped, so these inherit that correctness.
- Dependency Graph — Template-owned, resolved live via resolveOwningScope in dependencyDefinitionEngine — this one's fine as a live lookup (Template ownership is the right scope for it, not a composition-scoping bug).
- Same global/unscoped bug as Quality Gate (being fixed by your plan):
- Policies — confirmed, worse than Quality Gate: no live lookup mechanism exists at all.
- Review Gates — only ever reached indirectly, through a Quality Gate's own criteria.reviewGateId (resolved once, permanently, at Pack-publish time). No independent action needed — once Quality Gate is fixed/materialized, any Review Gate it references is correctly scoped along with it.
- Stored but never consumed anywhere (same class as exposedParameterOverrides): exposedParameterOverrides lives in profiles.draft_content (JSONB) — pulled out via extractExposedParameterOverrides(profile.draft_content) (profiles.ts, used by profileCompositionUnravel.ts:290). It never gets copied onto the EBM at all — profileCompositionUnravel reads it straight off the Profile at report-build time, and nothing persists it (or its resolved/applied value) anywhere on ebms.

 
## Gaps

- exposedParameterOverrides remains the concrete instance. 
Explicitly declaration-only by design — not a hidden bug, documented as deferred: ✅ Built along with CR-104
- Obligation Definitions — the code comment states it outright: "No real Obligation Definition table — nothing cross-references one by id ... this stays declaration-only validation, no materializeContributions upsert" (CR-062). Authored, Ontology-validated, but deliberately not wired to any runtime table yet.
- Engineering Capital — same treatment, "minimal stub" per CR-082's own comment.
Checklists — attached as metadata (checklist_ids) to Quality Gates/Review Gates, not independently enforced; inherits whatever scoping those get, not a separate gap.
- Authority Rules — dead/superseded; transitionEngine.ts's own comment calls the authority_rules/required_authority_rule_id path "legacy" — real authority is the badge mechanism (badgeAuthorityEngine), which is correctly Layer-1/global by design, not something that should be Pack-composition-scoped at all.

Obligation raising by a Participant isn't — and the one related piece that does exist (blocked → AttentionItem) contradicts CR-109's own settled design rather than fulfilling it. That gap belongs to CR-108, which is why it's still 🟡 Raised.