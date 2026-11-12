# What a Pack brings, one table for each kind

This is a draft for you to correct. "Today" describes what the code does now. "Agreed" lists what we have settled in this discussion. A kind with no "Agreed" row is not yet discussed.

How a conflict is found today: everything that feeds the EBM goes into one list, and each item has a name. If two items have the same name and different values, the user is shown a conflict. Items with different names are never compared, even when they are about the same thing.

## Step 1: choose the Service for each Deliverable

| | |
|---|---|
| Rule | This is the first step, before any other check. If several Services make one Deliverable, the user sees a message that several work streams may be packed into one bucket, and picks one Service. The advice is a separate Profile for each work stream. If only one Service makes it, that Service is used. Every later check starts from the Service chosen here. |
| Order of the later steps | Not yet set. |

## General rules, for every kind

| | |
|---|---|
| What the EBM takes from a Pack | The user sees what the EBM would take from each Pack and what it would leave out, and approves it. For example, if a Pack does not bring the Deliverable's Service, its Services are left out, and its Capability, Obligation or Policy may still be taken. |

## 1. Services

| | |
|---|---|
| What it is | A Service the Pack adds, with its service levels. |
| Where else the same thing can come from | The Service Definition (default levels). The Template (a level it sets). The Profile (a level it overrides). |
| Compared today | Two Packs giving different levels for the same Service. |
| Not compared today | A Pack's levels against the Deliverable's Service levels. Several Services making the same Deliverable. |
| Agreed | Every level conflict lists every possible outcome as an option. For a level the Packs add, the options are the Pack's value and "no value". For a different level, the options are the two values. The user picks one, and the pick decides which levels the SEU takes. |
| Agreed | The Deliverable's Service is A. A's levels are the Profile's value, else the Template's, else the Service Definition default. This order is already in place. The Services from all composed Packs are put in one list, for example [A, B, C, D]. A is compared with the Packs' definition of A. A different value is a conflict. The service level conflicts are set out in the table below. The user picks. Packs are not compared with each other.(this has to be at definition compliance and EBMLiveness, not for this scope) If A is not in the Packs' list, this check finds no conflict. B, C and D are not taken into the EBM. |

### Service level conflicts

A is the levels of the Deliverable's Service. B is the levels the composed Packs give the same Service.

| Level in A | Level in B | Result |
|---|---|---|
| yes | no | No conflict. |
| yes | yes, same value | No conflict. |
| yes | yes, different value | Conflict. The options are the two values. The user picks one. |
| no | yes | Conflict. The options are the Pack's value and "no value". The user can include the level or leave it out. |

## 2. Capabilities

| | |
|---|---|
| What it is | A kind of work, such as software construction. |
| Where the SEU's Capabilities come from | Each Deliverable is made by one Service, and that Service names its Capability. |
| Where else a Capability can be named | A Pack can name a Capability. |
| Compared today | Nothing. |
| Agreed | There are n Deliverables in the catalogue. A Deliverable that several Services point to is already shown in the Services check. |
| Agreed | List A: each Service points to one Capability. The Capabilities of the Services of the Deliverables are listed. For a Deliverable with several candidate Services, the Capability of each candidate is in list A. |
| Agreed | Example of list A: the Profile has the Deliverables d1, d2 and d3. d1 comes from the Services s1 and s2, d2 comes from s3 and s4, and d3 comes from s5. The Services s1, s2, s3, s4 and s5 name the Capabilities c1, c2, c3, c4 and c5. List A is c1, c2, c3, c4 and c5. |
| Agreed | List B: the Capabilities from the contributing Capabilities of all the Packs are listed. |
| Agreed | In A and not in B is not a conflict. All of A is taken into the EBM. |
| Agreed | Not in A and in B is shown as a conflict. |
| Agreed | If the user chooses B, the contributing Services of B are checked. If there are none, B is added with no issue. If there are contributing Services and the resolved Service is in that list, the Service level check of the Services check runs. If the resolved Service is not in that list, the addition is not a conflict. |
| Agreed | The Profile adds no list of Capabilities. The Profile's extra Capability list will be removed from the code. |

## 3. Authority rules

| | |
|---|---|
| What it is | Which role may move something to the next state. |
| Where else the same thing can come from | The platform's own definition of each step, which names its authority rule. |
| Compared today | Two Packs naming different roles for the same step. |
| Not compared today | A Pack's rule against the platform's rule for that step. |
| Agreed | Authority rules come from the composed Packs and from the platform's own definition of each step. They are put in one list. |
| Agreed | An authority rule names the step it governs, written as `Deliverable|from|to`, and the role that may move something through that step. The step names the kind of thing and its states, not a specific Deliverable. A rule at a step applies to every Deliverable at that step. |
| Agreed | Two authority rules at the same step conflict when they name different roles. It does not matter whether they come from two Packs or from a Pack and the platform's definition. Example: Pack 1 says the `lead` may move a Deliverable from In Progress to Approved, and the platform's definition of that step says the `manager` may. The user can pick either one or both. |
| Agreed | A Pack may name several roles for one step. Its roles for that step are taken together as one set, and two sets that differ are a conflict. |

## 4. Policies

| | |
|---|---|
| What it is | A rule that must hold, such as a required approval. |
| Where else the same thing can come from | The Policy Definition. The platform's own definition of each step. The Template and Profile (they can change a Policy's settings). The platform's Mandatory Packs. |
| Compared today | Two Packs defining the same Policy differently. |
| Not compared today | A Pack's Policy against the step definition, or against the Template's or Profile's settings for it. |
| Agreed | Policies come only from Packs. This includes the platform's Mandatory Packs and the Packs added by dependencies. The Template and the Profile add no Policy. They can only change the settings of a Policy that a Pack brought. |
| Agreed | All Policies from all the composed Packs are put in one list. |
| Agreed | A Policy has conditions. A condition tests one field for one Deliverable at one step. Example: for the Deliverable `source-code` at the step In Progress to Approved, `approvals > 2`. |
| Agreed | Two Policies with the same code are compared condition by condition. Two conditions test the same thing when the Deliverable, the step and the field are the same. If their operator or value differ, that is a conflict. Example: Pack 1 has Policy P1 with `approvals > 2`, and Pack 2 has Policy P1 with `approvals > 1`. |
| Agreed | Two Policies with different codes conflict when they apply different rules to the same Deliverable at the same step. Example: Policy P1 says `approvals > 2` and Policy P2 says `reviewers >= 1`, both for `source-code` at In Progress to Approved. The user can pick either one or both. |
| Agreed | A condition that has only a statement and no machine rule is verified by a person. It is never compared. It is shown to the user as a notice. |

## 5. Quality gates

| | |
|---|---|
| What it is | A check an item must pass before it moves on. |
| Where else the same thing can come from | The quality gates table. The platform's own definition of each step. |
| Compared today | Two Packs defining a different gate for the same step and category. |
| Not compared today | A Pack's gate against the gates already on the step. |
| Agreed | Quality gates come from the composed Packs. They are put in one list. |
| Agreed | Two quality gates are about the same thing when they are for the same Deliverable at the same step. A gate that names no Deliverable is compared with the other gates at the same step that name no Deliverable. |
| Agreed | If any field of the two gates differs, that is a conflict. The fields are the name, the category, the criteria type, the required Policy codes, the statement, the classification, the participant and the output contract. The checklists and the recommended checklists are a union, so a difference in them is never a conflict. The user can pick either one or both. |
| Agreed | Two gates with every field the same are no conflict. Example: two Packs each have a gate for `source-code` at In Progress to Approved, with the criteria type "requires an accepted review". One calls it "Code review" and the other calls it "Review gate". The names differ, so that is a conflict. |

## 6. Review gates

| | |
|---|---|
| What it is | A review an item must pass before it moves on. |
| Where else the same thing can come from | The review gates table. |
| Compared today | Two Packs defining the same review gate differently. |
| Not compared today | A Pack's gate against the table. |
| Agreed | Review gates come from the composed Packs. They are put in one list. |
| Agreed | A review gate has the step it governs, written as `Deliverable|from|to`. The step names the kind of thing and its states, not a specific Deliverable. A review gate at a step applies to every Deliverable at that step. (A later change request gives a review gate a Deliverable, as a quality gate has.) |
| Agreed | Review gates with different codes are different gates, so they are never a conflict, and the SEU takes all of them. Two review gates at the same step with the same code are compared. If any other field differs, that is a conflict. The fields are the name, the statement, the classification, the external evidence flag, the prompt, the participant, the output contract and the assurance. The user can pick either one or both. |
| Agreed | The checklists and recommended checklists of a review gate are a union, so a difference in them is never a conflict. |

## 7. Checklists

| | |
|---|---|
| What it is | A list of items to check during the work. |
| Where else the same thing can come from | The Template and Profile (they can set checklist values). |
| Compared today | Nothing. Two Packs never clash, because the Pack's name is part of each item's name. |
| Not compared today | Two Packs with a checklist of the same name. A Pack's checklist against the Template's or Profile's values. |
| Agreed | Checklists are a union. Every item from every Pack is taken into the EBM. This is already how unravelling works (each item is added to the list under its Pack, checklist name and item), so no conflict is shown. |

## 8. Obligation definitions

| | |
|---|---|
| What it is | A task that must be done before something can move on. |
| Where else the same thing can come from | The platform's own definition of each step (a step can create an Obligation). |
| Compared today | Two Packs defining the same Obligation differently. |
| Not compared today | A Pack's Obligation against the one on the step. |
| Agreed | Obligation definitions come from the composed Packs. They are put in one list. |
| Agreed | An Obligation definition applies to one or more Deliverables, each at one or more steps. Two Obligation definitions are about the same thing when they apply to the same Deliverable at the same step. |
| Agreed | If any field of the two definitions differs, that is a conflict. The fields are the code, the category, the title, the description, the origin, the priority, the severity, the completion criteria, the required evidence, the classification, the external evidence flag, the prompt, the participant, the output contract and the assurance. The user can pick either one or both. |
| Agreed | Two definitions with every field the same are no conflict, even when two Packs both define them. Example: two Packs each define the Obligation `ebook-license-copy-limit-compliance` for `source-code` at In Progress to Approved, word for word. That is no conflict. If one Pack gives the priority High and the other gives Low, that is a conflict. Two definitions with different codes are different Obligations, so they are never a conflict, and the SEU takes all of them. |

## 9. Engineering capital

| | |
|---|---|
| What it is | Links to useful material, such as standards or guides. |
| Where else the same thing can come from | Nothing. The Profile's knowledge locations hold output locations of Deliverables, not links by type, so they are a different thing. |
| Compared today | Nothing. The Pack's name is part of each item's name. |
| Not compared today | Two Packs giving different links. |
| Agreed | Engineering capital comes from the composed Packs. It is put in one list. |
| Agreed | An entry has a type and a link. Example: type "Standard", link `https://example.internal/coding-standard`. |
| Agreed | Entries of the same type are compared. The same link from two Packs is no conflict. Different links are a conflict, and the user picks. Example: one Pack gives the type "Standard" with link A and another Pack gives the type "Standard" with link B. That is a conflict. |
| Agreed | An entry with no link is a conflict, and the user sees it and decides. |

## 10. Competencies

| | |
|---|---|
| What it is | Skills a Participant must have. |
| Where else the same thing can come from | The Profile's programming language and domain. |
| Compared today | Nothing. The values from every source are added together on purpose. |
| Not compared today | Nothing is checked. Adding together is the rule today. |
| Agreed | The competencies of the EBM are the role types and work types of the Capabilities composed in the EBM, put together in one list. Each Capability Definition carries roles, and each role carries work types. |
| Agreed | The Profile's programming language and domain are added to the competencies. |
| Agreed | The Packs' competencies (each a dimension and a value, for example Domain: ebook-library) are also added. |

## 11. Dependencies

| | |
|---|---|
| What it is | Other Packs this Pack needs. |
| Where else the same thing can come from | Not a thing of its own. Each dependency adds a Pack, and that Pack's contributions are checked in sections 1 to 10. |
| Compared today | A needed Pack that is missing, or an incompatible Pack that is present. |
| Not compared today | Not applicable. |
| Agreed | Each Pack added by a dependency is checked like any other Pack. |
| Agreed | A needed Pack that is missing, or an incompatible Pack that is present, is settled when the Template or Profile is defined. Conflicts among the Packs of a Template or Profile are sorted out at definition, so the EBM composition does not check them. |
| Agreed | The check stays. The user does not resolve it in the EBM composition. The user sees a message that it has to be resolved at the definition of the Template or Profile. |
