# CR-139 — EBM composition: Deliverable-driven Capabilities and conflict rules for every Pack contribution

**Raised:** 2026-11-06 · **Origin:** EBM composition review. The EBM defines SEU behaviour, so composition must derive Capabilities from the Deliverable Catalogue and compare every Pack contribution with every other source. The plain-language rules are in [EBM Composition Contributions Table.md](../EBM%20Composition%20Contributions%20Table.md) and the running record is in [EBM Composition Checkpoint.md](../EBM%20Composition%20Checkpoint.md).
**Status:** 🟡 Raised — design in progress

## Fix the following

- Derive the EBM Capabilities from the Deliverable Catalogue (Profile's own, else Template's), through one Service per Deliverable, to the Service's Capability.
- Show the user every overlap between a Pack contribution and any other source, with the options already in place (pick one, pick all, merge, union, intersection, supplement).
- Remove the Profile's `additionalCapabilityCodes` field and its uses from code and schema.
- Derive competencies from the composed Capabilities as well as from the Profile and the Packs.

## Settled design

| # | Decision |
|---|---|
| 1 | Step 1 of composition: each Deliverable ends with exactly one Service. Several candidate Services show a message that several work streams may be in one bucket, and the user picks one. |
| 2 | The EBM does not take a Pack's other Services. It takes what else the Pack brings, and the user sees and approves what is taken and what is left out. |
| 3 | Services: the Deliverable's Service A is compared with the Packs' definition of A. A different, added or omitted service level is a conflict. If A is not in the Packs' list, there is no conflict. Packs are not compared with each other. |
| 4 | Capabilities: the Capabilities the Deliverables need are compared with the Capabilities the Packs name. A missing one is accepted. An addition sends the naming Pack through the Services rule. |
| 5 | Policies: every Policy enters through a Pack. Policies with the same code are compared by content. Conditions are matched by the field they test, so approvals > 2 against approvals > 1 is a conflict. Different Policies that apply different rules to the same Deliverable and step are a conflict. |
| 6 | Authority rules, quality gates, review gates and Obligation definitions: two that apply different rules or roles to the same Deliverable and step are a conflict, whatever their source. |
| 7 | Checklists are a union, with no conflict. |
| 8 | Engineering capital: the same link is accepted, different links of the same type and an entry with no link are conflicts. |
| 9 | Competencies are the union of the composed Capabilities' role types and work types, the Profile's programming language and domain, and the Packs' competencies. |
| 10 | Dependencies: each dependency Pack is checked like any other Pack. A missing needed Pack or a present incompatible Pack is still reported, and the user sees a message that it has to be resolved at the definition of the Template or Profile. The user cannot resolve it in composition. |
| 11 | The Profile adds no list of Capabilities. |

## Still open

- Resolving a Capability code to one `capabilities` row (by code alone, or through `capability_definitions`).
- Whether a Template or Profile setting that differs from the Policy Definition's own value is a conflict.
- Handling of Policy conditions that have a statement and no machine rule.
- Whether a Profile may override a Template's Packs (the owner decides).
