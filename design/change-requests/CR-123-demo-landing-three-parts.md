# CR-123 — Demo landing page organised into the three manual parts (demo wrapper only)

**Raised:** 2026-10-16 · **Origin:** the Demo page is the first thing prospective investors see. It must explain what the platform does and how to navigate the demo, following the three parts of the user manual (`src/docs/user-manual`).

**Status:** 🟡 Built pending verification

## Intent

| Item | Decision |
|---|---|
| Scope | The demo wrapper only: `src/dry-run-suite/demoLanding.md`. |
| Platform behaviour | No change. The Demo is a tenant. Registry, Ontology, Attention and every other page show what the current functionality shows for that tenant. |
| Access | Governed by `route_authority`. No role, badge or route change is made for the demo. |
| Demo helpers | The helpers (Scenarios, Playbooks, Reset) only simulate the flow. |
| Seed data, Scenarios, Playbooks | Unchanged. |
| Documentation | None created beyond this CR. |

## The three parts

| Part | Manual | Demo content |
|---|---|---|
| 1. Authoring | 01 SDK Authoring | Tour of Packs, Profiles, Templates, Capability Definitions and Objectives. Scenario: accept-reader-privacy-code. |
| 2. Commissioning | 02 SEU Commissioning | The twelve commission-objective Scenarios (O10 to O22). |
| 3. Execution | 03 Execution Engine | complete-deliverable, raise-blocker, release-blocker, raise-risk, raise-finding, convert-finding and waive-blocker Scenarios. |

## Playbook classification

| Playbook | Part 1 | Part 2 | Part 3 |
|---|---|---|---|
| reader-privacy-compliance | accept-reader-privacy-code | | |
| catalogue-first-sprint | | commission-o10 | three Deliverables, blocker raised and released |
| review-finding-to-obligation | | commission-o10 | Finding raised and converted |
| release-readiness | | commission-o19, commission-o21 | two blockers raised and released |

## Page content

Opening pitch and six value points, the Riverbend story, the three parts with numbered navigation steps and a take-away line each, the Playbook table by part, and Reset.

## Open verification (no code change implied)

| Item | Check |
|---|---|
| Registry pages and Attention need `participant` in `route_authority`. | Confirm the page wording matches what the Demo User sees. If a page is denied, change the wording of the landing page only. |
| The Ontology step in Part 1. | Confirm the menu entry is visible to the Demo User. Same rule applies. |

## Files

| File | Change |
|---|---|
| `src/dry-run-suite/demoLanding.md` | Rewritten. |
