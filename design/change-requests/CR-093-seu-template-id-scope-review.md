# CR-093 — SEU `template_id` scope review (Ch.8 §5/§6, dependency-definition scoping)

**Raised:** 2026-09-07 · **Origin:** owner, following the Ch.8 §5 (Inputs)/§6 (Outputs) definition review — settling that commissioning takes only Objective + Profile (Template is never an independently-chosen or plural input; it derives transitively from `profile.base_template_id`) raised the follow-on question of whether `seus.template_id` itself should be dropped. · **Status:** 🟡 Open — deferred. Decision for now: **keep `seus.template_id` as-is**, no schema change, no rewrite of any consumer.

## The question

Given commissioning now settles on Objective + Profile only, is `seus.template_id` (a persisted, denormalized copy of `profile.base_template_id`, set once at commit time) still justified, or should it be dropped in favour of always resolving Template through Profile?

## Checked directly — six live, real (non-passthrough) consumers of `seus.template_id`

- `src/adapters/assignmentDelivery.ts:27-29`
- `src/domain/engine/dependencyDefinitionEngine.ts:36`
- `src/routes/seu/core/seus.ts:306`
- `src/routes/seu/core/traceability.ts:103-105`

  All four feed `templateId` into `DependencyOwningScope` (`dblayer/dependencyDefinitionsDB.ts`), bound directly into `OWNER_SCOPE_WHERE`: `owning_entity_type = 'Template' AND owning_entity_id = $1`. CR-043's own model treats Template, Profile, and every composed Pack as independently valid `dependency_definitions`-owning scopes — a real query filter, not a passthrough.

- `src/routes/seu/core/deliverables.ts:62` — fetches the real Template row via `seu.template_id`, then checks a new Deliverable's name against `template.deliverable_catalogue` before allowing creation.
- `src/domain/engine/ebmComposer.ts:77` — copies `seu.template_id` onto `ebms.template_id`, itself read again later (`commissioning.ts:532`) to resolve the Template.

So the column is not vestigial — dropping it would require every one of these six to resolve Template via an extra `profilesDB.findById(seu.profile_id).base_template_id` lookup first.

## Owner's objection to the current design, not just the storage question

Two points raised, unresolved, that go beyond "should the column exist":

1. **Single-Template preference is unprincipled.** A Profile can be derived from multiple Templates during its own authoring (its schema still only carries one `base_template_id`, but that value's own provenance may summarize several source Templates). Whichever Template ends up as `seu.template_id` — and therefore as the sole `owning_entity_type = 'Template'` scope `DependencyOwningScope` resolves against — is privileged over any others that shaped the Profile, with no principled reason for that one to win. Owner: *"Logically if a profile comes from 3 templates, why would one get preference over the others. Does not look correct."*

2. **Profile is supposed to override the dependency graph — so why consult the Template's own rules at all?** If Profile-level content is authoritative over what Template declared (the general Template-exposes/Profile-overrides cascade this platform already uses elsewhere, CR-088), then `DependencyOwningScope` still unconditionally including the Template's own `dependency_definitions` rows as a scope — on every evaluation, unconditionally — sits awkwardly against that override model. Owner: *"Profile override dependency graph. so why go back to the template again?"*

Neither point is about whether `seus.template_id` should be a column — they're about whether Template-scoped `dependency_definitions` rows (CR-043) should still be consulted at all once Profile is the sole commissioning input, or under what condition they should still apply. That's a real re-examination of CR-043's own scope model, not a storage decision, and needs its own analysis before either the six call sites or the column itself are touched.

## Deferred

No investigation started beyond identifying the six call sites and the two objections above. Explicitly not scoped in this pass: whether `DependencyOwningScope` should stop including Template as a scope, how Profile-authored-from-multiple-Templates provenance should (if at all) be preserved, or any schema change to `seus`/`ebms`.
