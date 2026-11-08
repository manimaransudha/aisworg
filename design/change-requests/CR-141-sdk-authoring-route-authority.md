# CR-141 — SDK authoring: route authority for the `:slug` routes, and removal of `requireBadge` from sdkAuthoring.ts

**Raised:** 2026-11-08 · **Origin:** coverage review of `src/middleware`. `requireBadge.ts` is called only from `src/routes/seu/web/sdkAuthoring.ts` after `routeAuthorityRegistry.ts` and `dataMigrations.ts` moved their root check into `routeAuthorityGate`. CLAUDE.md states that every route's badges and roles live in `route_authority`, not in a per-route `requireBadge` call.
**Status:** 🟡 Raised — design in progress

## Fix the following

- The routes under `/aisworg/seu/sdk/:slug` carry badge checks in code. The `route_authority` rows for these routes list roles only (`sdk_author`, `demo`) and no badges.
- The authority of these routes is to be defined in `route_authority`, and the hand-written checks in `sdkAuthoring.ts` removed.
- `requireBadge.ts` has no other caller. It is to be removed once `sdkAuthoring.ts` no longer uses it.

## Findings

Slug to kind to define badge (`KIND_BY_SLUG`, `entityTypeForKind`). Each badge has a birth row with verb `define` in `transitionDefinitions.json`, except TransitionDefinition.

| Slug | Kind | Define badge |
|---|---|---|
| pack-authoring | Pack | pack_define |
| template-authoring | Template | template_define |
| profile-authoring | Profile | profile_define |
| transition-definition-authoring | TransitionDefinition | transitiondefinition_define |
| deliverable-authoring | Deliverable | deliverabledefinition_define |
| service-authoring | Service | service_define |
| policy-authoring | Policy | policy_define |
| capability-authoring | Capability | capability_define |

The nine `:slug` routes:

| Route | Guard in code | Enforced in core |
|---|---|---|
| GET `/sdk/:slug` | `requireAuthoring`: the define badge, or any badge starting with `<entity>_` | None (list) |
| GET `/sdk/:slug/new` | `requireDefineBadge` | None |
| POST `/sdk/:slug` | `requireDefineBadge` | Yes. `resolveAuthorBadge` in the handler, and `beginBirth` for all seven kinds. |
| GET `/sdk/:slug/:draftId` | `requireDraftTenantScope` | None needed (view) |
| POST `.../save` | `requireDraftTenantScope`, `requireDefineBadge` | **None** |
| POST `.../compose` | `requireDraftTenantScope`, `requireDefineBadge` | **None** |
| POST `.../import` | `requireDraftTenantScope`, `requireDefineBadge` | **None** |
| POST `.../publish` | `requireDraftTenantScope`, `requireRowActionBadge` | Yes. `nextActionsFor` and `transitionEntity` → `authorise` → `resolveAuthorBadge`. The four `activate…SupersedingPrevious` functions also go through `transitionEntity`. |
| POST `.../transition` | `requireDraftTenantScope`, `requireRowActionBadge` | Yes. `transitionEntity` → `authorise`. |

How the gate and the table behave:

- A row with both `badges` and `roles` needs the badge check and the role check to pass. `match_mode` applies inside each list.
- Of all rows that match, the one with the fewest `:params` wins; a tie goes to the longer path. A literal-slug row such as `/aisworg/seu/sdk/pack-authoring/new` beats `/aisworg/seu/sdk/:slug/new`.
- `redirectsFor` treats `:slug` as a wildcard, so a denial on a literal-slug path redirects to the same `badgefail` target as today.
- `resolveAuthorBadge` returns `"root"` for a root holder and the required badge for any other holder, and throws otherwise. Root therefore passes every core check.
- A kind added to `KIND_BY_SLUG` without literal rows falls back to the role-only `:slug` rows.
- `saveAuthoringDraft` passes the literals `"pack_define"`, `"template_define"`, `"profile_define"` and `"policy_define"` as event badges. CLAUDE.md allows constants only in `src/dblayer/constants.ts`.
- The UI reads held badges in code for `canCreate` (list page) and `canEdit` (parameter-override rows) in `sdkAuthoring.ts`.

## Settled design

Nothing yet beyond the direction above: the authority of the `:slug` routes belongs in `route_authority`.

## Still open

- Whether the define badge for `/new`, `save`, `compose` and `import` is written as literal-slug rows per kind (seven kinds × four routes = 28 rows), or in another form.
- How the list route is expressed. `requireAuthoring` accepts any badge starting with `<entity>_`, which a row can express only by listing the badges of that entity.
- Whether `save`, `compose` and `import` should also check the define badge in core, as create does.
- The `requireRowActionBadge` guard repeats the core check on publish and transition. Removal is to be confirmed with the owner.
- Handling of a new kind added to `KIND_BY_SLUG`, so that it does not fall back to the role-only rows.
- The literal badge strings in `saveAuthoringDraft`.
- Which test fixtures change. None are known yet.
- No verification run (`tsc`, tests) has been done for this CR.
