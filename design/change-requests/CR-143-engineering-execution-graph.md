# CR-143 — Engineering Execution Graph on the SEU page

**Raised:** 2026-11-13 · **Origin:** the SEU page is the dashboard of the project manager. The state of the work is spread across tabs (Deliverables, Capability Fulfilment, Obligations, Evidence, Events), and the user moves between them to understand what is happening. The specification chapters have no Engineering Execution Graph.
**Status:** 🟡 Raised — design in progress

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

## Proposed, not yet agreed

- The nodes are the entities that have dependency rows today: the Deliverables, and the Capabilities or Services that produce them, read from the dependency definitions of the SEU as the Deliverables tab reads them. Obligations, Evidence, Work Items and Participants attach to the Deliverable they relate to.

## Still open

- The set of entities that are nodes, and the kinds of edge between them.
- Where the graph sits: a tab of the SEU page, or above the tabs.
- How a node shows its state and what blocks it, so that the user need not return to the Deliverables tab.
- The content of the details panel for each kind of node.
- Whether the Quality Gates that govern a transition are listed in the "Blocked by" column. The gate check was not confirmed to be read-only, and a blocking gate already raises an Obligation.
- Whether the page reload is replaced by an update of the graph in place.
- Whether the data comes from the existing SEU detail view or from a route of its own, and the `route_authority` row that route needs.
- Verification runs for this CR: none have been run.
