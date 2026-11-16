# CR-143 — Engineering Execution Graph on the SEU page

**Raised:** 2026-11-13 · **Origin:** the SEU page is the dashboard of the project manager. The state of the work is spread across tabs (Deliverables, Capability Fulfilment, Obligations, Evidence, Events), and the user moves between them to understand what is happening. The specification chapters have no Engineering Execution Graph.
**Status:** 🟡 Partially built — to be refined

## Fix the following

- The SEU page is to show an Engineering Execution Graph. The graph shows the Deliverables and the other entities of the SEU and their dependencies.
- A click on a node shows the details of the entity.
- The SEU page follows the work as it happens.

## Settled design

- The Deliverables tab keeps a "Blocked by" column and gains a "Participants" column. Both were built on 2026-11-13, before this CR.
  - Blocked by lists the Policies and Standards of the EBM that govern a next transition of the Deliverable and fail for it today, and the open Obligations that block a state.
  - Participants lists the Participants on the work items of the Deliverable's Commands.
  - Neither column evaluates through an engine that publishes events.
- The SEU page reloads itself every `SEU_DETAIL_REFRESH_SECONDS` (15), to the same tab and scroll position. It waits while the browser tab is hidden, a dialog is open or a field is being edited. Built on 2026-11-13, before this CR.
- The graph concerns execution. The nodes are the entities that carry an `seu_id` and can block a Deliverable. `deliverable_references` links Deliverables and is not a node.
- The nodes are the blockers in the table below, and the Attention Items of the SEU. Policies and Quality Gates appear through the Obligations they raise.
- An Attention Item is a node because it needs manual intervention. The audience of the graph is project and program managers, and the graph is a snapshot of the work. An Attention Item never refuses a hop, so it does not turn a Deliverable red.
- The graph page is elastic: it pans and zooms, offers a Fit button, and offers a Layered layout and a Force layout.
- The edge is one kind, "blocks". An edge is labelled with the hop it blocks (from-state to to-state) and the verb of that hop in `transition_definitions`. Decisions are excepted and remain open (see Still open).
- The Engineering Execution Graph is a new page of its own. It is not a tab of the SEU page.
  - The SEU page carries a link to the graph page.
  - The All SEUs page gains an EEG button beside the View button and the transition buttons. The button opens the graph page of that SEU.
- Every node is clickable.
  - Each entity kind has its own node shape, so that the entity is identified at a glance.
  - A node is coloured by its state. A blocked Deliverable is red, a Deliverable in Defined is grey and one In Progress is orange.
  - The state colours are configurable. They and the entity shapes are held in Ontology, so a change to them is a data change and not a code change.
  - A click on a node opens a pane with the current state of the node and all the details of the entity.
  - A Quality Gate is not a node. It is a detail of the entity it blocks, and the pane of that entity shows the Quality Gate check results.
  - The check results are read from the stored `quality_gate_evaluations` rows of the entity (`entity_type`, `entity_id`, `outcome`, `detail`, `evaluated_at`). The graph page never calls `qualityGateEngine.evaluate`, because every call writes a row.
  - The pane carries a link to the SEU page, to the tab that holds the entity.
- The graph page does not reload itself. It has a Refresh button, which updates the graph in place.
  - The page shows the date and time of the last refresh, so that the user knows the moment the data describes.
  - The user refreshes when they choose. The automatic reload of the SEU page is unchanged.
- The graph data comes from a route of its own. The `route_authority` rows for the graph page and for this route are data in `routeAuthority.json`, added in the build pass.

## Ontology shape for shapes and colours (decided 2026-11-15)

Read: `ontologyConcepts.json` (2425 rows, columns `concept_type`, `code`, `default_label`, `description`, `is_mandatory`, `text_type`, `ui_grouping`), `seedOntologyConcepts.ts`, `ontology_concepts_schema_recovery.sql`. The seed is a JSON update and a batch insert, so no schema change and no code change to the seed is needed.

| Concept type | `code` | `default_label` | `ui_grouping` |
|---|---|---|---|
| `eeg-node-shape` | Entity kind of the node (Deliverable, Capability, Obligation, Decision, Evidence, Knowledge, Command) | Shape token (for example `hexagon`) | `Execution` |
| `eeg-state-colour` | `<Entity kind>\|<state>`, and `<Entity kind>\|Blocked` for the derived blocked status | Colour token (for example `orange`) | `Execution` |

- The `\|` joined key follows the `Entity|from|to` keys already used for policy checks (`transitionEngine.ts` line 131).
- The existing `governed-entity-type` set lacks Capability and Command, so the node kinds get their own concept type.
- Lifecycle states are held in `transition_definitions`, not in Ontology. The colour concepts name states and do not define them.
- No existing concept type carries a render value. `default_label` carrying the token is the one overload in this shape. The alternative is a new attribute column on `ontology_concepts`, which is a schema change and needs explicit approval.
- Ontology versioning and tenant scope apply as for every concept row.

## Initial shapes and colours (decided 2026-11-15)

States are read from `transitionDefinitions.json`, except Capability and Command. The Capability node is the SEU Capability (`seu_capabilities.status`), and a Command takes its `commands.status`. Colour meaning: grey is not started or retired, blue is under analysis or review, orange is in progress, green is accepted or done, teal is final, red is blocked or failed.

| Entity kind | Shape | State to colour |
|---|---|---|
| Deliverable | box | Defined grey, In Progress orange, Approved green, Baselined teal, Blocked red |
| Capability | hexagon | Unfulfilled grey, Fulfilled green |
| Obligation | diamond | Identified grey, Analysed grey, Assigned blue, In Progress orange, Reopened orange, Resolved green, Verified green, Closed teal, Archived grey, Escalated red |
| Decision | triangle | Identified grey, Analysed grey, Proposed blue, Reviewed blue, Approved green, Applied teal, Superseded grey, Archived grey |
| Evidence | ellipse | Collected grey, Validated blue, Accepted green, Referenced teal, Archived grey, Rejected red |
| Knowledge | parallelogram | Observed grey, Proposed blue, Validated blue, Accepted green, Published teal, Deprecated grey, Archived grey |
| Command | octagon | Generated grey, Dispatched orange, Deferred blue, Completed green, Cancelled grey, Failed red |

- Blocked is a derived status of a Deliverable and is not a lifecycle state. It is coloured by the `Deliverable|Blocked` concept.
- Shape and colour tokens are drawn from standard graph shape names and CSS colour names.

## Blockers of a Deliverable (read from the code, 2026-11-15)

Sources: `executionEngine.ts` (lines 55-190), `transitionEngine.ts`, `dependencyDefinitionEngine.ts`.

| Blocker | Table or source | Checked at | Result code |
|---|---|---|---|
| Dependency row from a Deliverable | `deliverables` | `isTargetReady`, line 57 | `dependency_not_satisfied` |
| Dependency row from a Capability, matched by Service code | `seu_capabilities` | `resolveNamedNode` | `dependency_not_satisfied` |
| Dependency row from an Obligation, Decision, Evidence or Knowledge item | `obligations`, `decisions`, `evidence`, `knowledge_items` | `isUnnamedNodeSatisfied` | `dependency_not_satisfied` |
| Open Obligation on the SEU (blocks every Deliverable of the SEU) | `obligations` | line 76 | `seu_blocked` |
| Open Obligation on the Deliverable | `obligations` | line 82 | `obligation_blocked` |
| Decision not yet Approved | `decisions` | line 87 | `decision_blocked` |
| Command in flight for the same hop | `commands` | line 96 | `already_in_flight` |
| Quality Gate evaluation is Blocked (raises an Attention Item) | `quality_gate_evaluations` | line 124 | `quality_gate_blocked` |
| EBM Policy or Standard, or a Policy the Transition Definition requires (raises an Obligation) | policy definitions | lines 145-172 | `policy_blocked` |
| Hop requires a submit that has not happened | `submit_verb` on the Transition Definition | line 178 | `not_submitted` |
| In Progress to Approved with no attached reference | `deliverable_references` | line 185 | `empty_centre` |
| Producing Capability status, read only as a Policy input | `seu_capabilities` | line 139 | through `policy_blocked` |

- Attention Items are read into the governance outcome (lines 195-199) and never refuse a hop.
- A dependency row gates any `TransitionEntityType` through `to_entity_type`, not only Deliverables. The entity types used by the seeded rows have not been checked.
- Evidence has no SEU column. Its SEU is the `SEU` row of its relationships (`entityAdapters.ts`).

## Built (2026-11-15)

- `src/dblayer/seed/data/ontologyConcepts.json`: 51 rows. Seven `eeg-node-shape` concepts and 44 `eeg-state-colour` concepts, as in "Initial shapes and colours".
- `src/dblayer/constants.ts`: the two Ontology concept type names, the derived Blocked state, the grid of the graph and the SEU page tab of each node kind (now including Attention Items), and the Attention Item states that are closed (left off the graph) and resolved (the edge is drawn as satisfied).
- `src/routes/seu/core/seuGraph.ts`: builds the nodes, edges and layout from `getSeuDetailView`, the dependency rows, the Command in flight and the stored `quality_gate_evaluations` rows. Shape and colour are read from Ontology. A missing concept raises an error.
- `src/routes/seu/web/seus.ts`: `GET /seus/:id/graph`, guarded by `requireTenantScope.forParam`.
- `src/routes/seu/api/seus.ts`: `GET /seus/:id/graph`, the JSON data route, guarded by `requireTenantScope.forParam` in api mode.
- `src/dblayer/seed/data/routeAuthority.json`: a row for each of the two routes, with the roles `participant` and `demo` and no badge, as the SEU detail page has.
- `src/viewModels/seu_seus_graph.ts`, `viewRegistry.ts`, `src/middleware/redirects.ts` (`seusGraph`): the page wiring.
- `src/views/seu/seus/graph.ejs`: the graph as SVG, one shape for each kind, colour for each state, a details pane with the Quality Gate results, a link to the SEU page tab, a Refresh button and the as-of date and time. Pan (drag the background), zoom (scroll, plus, minus), Fit, a Layered or Force layout toggle, and dragging a node. Edges are straight lines. Edge labels are hidden below 60% zoom. A Refresh keeps the positions of the nodes and lays out again only when a new node appears.
- `src/views/seu/seus/index.ejs`: the EEG button. `src/views/seu/seus/detail.ejs`: the Execution Graph link.

Decisions made in the build:
- A Deliverable is Blocked when it has an entry in the "Blocked by" column, an open Obligation or Decision, a Command in flight for a next hop, or a stored Quality Gate result of Blocked. An unsatisfied dependency row is drawn as an open edge and does not turn the Deliverable red, so that a Deliverable waiting for its predecessors stays in its state colour.
- A Command is a node while it is in flight. A Decision edge is labelled "any hop".
- An Attention Item that is not Closed is a node (pentagon). It has an edge to the entity it concerns (`related_object_id`) when that entity is a node of the graph, labelled "needs action" with its category and priority, drawn open until the item is Resolved or Closed. An Attention Item with no such entity is a standalone node. An Attention Item raised for an Obligation that is not a node has no edge.
- Ontology gains the shape `pentagon` for `AttentionItem` and the colours of `AttentionItem|Created`, `Delivered` (red), `Acknowledged` (blue), `In Progress` (orange), `Resolved` (green) and `Closed` (teal), 7 rows in `ontologyConcepts.json` (2483 rows in all). The graph raises an error until `db:clean-slate` loads them.
- The graph draws an Obligation as a node when it blocks a hop (`blocked_to_state` is set) or when a dependency row names Obligations.

## Test fixtures updated in the same pass

- `tests/acceptance.e2e.test.ts`: the journey actor is `TESTER_ACCEPTANCE_JOURNEY_PLATFORM`, a non-root user of the test-platform tenant, because the SEU routes are tenant scoped and the SEU of the journey lives in the test-platform tenant with the fixture Template, Profile and Packs.
- `tests/testFixtures.ts`: exports `TESTER_ACCEPTANCE_JOURNEY_PLATFORM`.
- `src/dblayer/seed/seedTestIdentity.ts`: seeds that user with every noun_verb badge. The test global setup seeds it on each run.
- The CR changes no schema. The other web tests commission and browse as root, which the tenant guard always admits.

## Incidental changes in the same pass

- `src/middleware/seuTenantScope.ts`: one `requireTenantScope.forParam` guard for the SEU named by `:id`, in a web and an API form (owner instruction: every SEU route is tenant scoped). The web routers `seus.ts`, `compliance.ts`, `reviews.ts` and `workQueue.ts` and the API router `seus.ts` mount it with `router.param("id", ...)`. Every `/seus/:id/...` route of those routers is now tenant scoped. The `seus` redirect entry gains `tenantfail`. The routes of `demo.ts` (`:seuId`) and `attention.ts` (`:id` is an Attention Item) are unchanged. Tests that open an SEU page or post to an SEU route as a user of another tenant will now be refused.
- `src/views/seu/seus/index.ejs`: brought in line with CR-083. The inline state-badge styles are removed, because `style.css` holds them, and the table card is a `section-card` with a `section-header`.

- `src/routes/seu/core/obligations.ts`: `raiseObligationForBlockedTransition` reads the Policy name from `policy ?? definition`. A Policy that a hop requires has no `policies` row, so `policy.name` threw after the Obligation was created (owner approved).

## Still open

- Decision edges. In the code read so far a Decision blocks every hop of the Deliverable until it is Approved (`executionEngine.ts` line 87). The Decisions schema has not been read to see whether a Decision records a hop, so the verb of its edge is undecided.
- Verification runs for this CR: `tsc` was run on 2026-11-15 and reported one error, in `src/routes/seu/core/obligations.ts` line 182 (`policy` possibly null). It was fixed, and `tsc` then reported no errors. The full test suite was run by the owner on 2026-11-15 and passed. No `db:clean-slate` was run by Claude. The graph page has not been opened in a browser. The Attention Item nodes, the Ontology rows and the pan, zoom and Force layout were added after those runs, and `tsc`, the tests and `db:clean-slate` have not been run on them.
