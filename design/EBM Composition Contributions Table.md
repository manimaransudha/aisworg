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
| Agreed | The Deliverable's Service is A. A's levels are the Profile's value, else the Template's, else the Service Definition default. This order is already in place. The Services from all composed Packs are put in one list, for example [A, B, C, D]. A is compared with the Packs' definition of A. A different value is a conflict. A level the Packs add is a conflict. A level the Packs leave out is a conflict. The user picks. Packs are not compared with each other.(this has to be at definition compliance and EBMLiveness, not for this scope) If A is not in the Packs' list, this check finds no conflict. B, C and D are not taken into the EBM. |

## 2. Capabilities

| | |
|---|---|
| What it is | A kind of work, such as software construction. |
| Where the SEU's Capabilities come from | Each Deliverable is made by one Service, and that Service names its Capability. |
| Where else a Capability can be named | A Pack can name a Capability. |
| Compared today | Nothing. |
| Agreed | The Capabilities the Deliverables need are compared with the Capabilities all the Packs name. A needed Capability that no Pack names is fine. A Capability that a Pack names but the Deliverables do not need is an addition. For an addition, the Pack that names it is checked: the Services it brings are run through the Services rules. A Service that is not one of the Deliverables' Services is left out of the EBM. |
| Agreed | The Profile adds no list of Capabilities. The Profile's extra Capability list will be removed from the code. |

## 3. Authority rules

| | |
|---|---|
| What it is | Which role may move something to the next state. |
| Where else the same thing can come from | The platform's own definition of each step, which names its authority rule. |
| Compared today | Two Packs naming different roles for the same step. |
| Not compared today | A Pack's rule against the platform's rule for that step. |
| Agreed | Authority rules follow the same rule as Policies. All authority rules from the platform's definitions and from the Packs are put together in one list. If two name different roles for the same Deliverable and step, that is a conflict, whether they come from two Packs or from a Pack and the platform's definition. The user can pick either one or both. |

## 4. Policies

| | |
|---|---|
| What it is | A rule that must hold, such as a required approval. |
| Where else the same thing can come from | The Policy Definition. The platform's own definition of each step. The Template and Profile (they can change a Policy's settings). The platform's Mandatory Packs. |
| Compared today | Two Packs defining the same Policy differently. |
| Not compared today | A Pack's Policy against the step definition, or against the Template's or Profile's settings for it. |
| Agreed | Every Policy enters the EBM through a Pack. This includes the platform's Mandatory Packs and the Packs added by dependencies. The Template and Profile add no Policy of their own. The Profile can add no Policy code from the Policy Definition. The Template and Profile can only change settings of a Policy that a Pack brought. |
| Agreed | Within a Policy, the conditions are what is compared. Conditions are matched by what they test (the field), not by their wording. Two conditions on the same field, for the same Deliverable and step, conflict when their operator or value differ. Example: approvals > 2 against approvals > 1 is a conflict. |
| Today | A condition has a statement but no code or name, so conditions are matched by position. A reordered list shows as conflicts. A list of a different length shows as one conflict for the whole list. |
| Agreed | Policies are also compared with each other across codes. If one Policy applies rule X1 to a Deliverable for the step from X to Y, and another Policy applies rule X2 to the same Deliverable for the same step, that is a conflict. The user can pick either one or both. |
| Today | Policies are listed under their own code, so two different Policies on the same Deliverable and step are never compared. |
| Agreed | All Policies coming from the definitions and from the Packs are put together in one list. If two have the same code, their contents are compared and any difference is shown as a conflict. |

## 5. Quality gates

| | |
|---|---|
| What it is | A check an item must pass before it moves on. |
| Where else the same thing can come from | The quality gates table. The platform's own definition of each step. |
| Compared today | Two Packs defining a different gate for the same step and category. |
| Not compared today | A Pack's gate against the gates already on the step. |
| Agreed | Quality gates are compared with each other across names. If two quality gates apply different rules to the same Deliverable for the same step, that is a conflict. The user can pick either one or both. |

## 6. Review gates

| | |
|---|---|
| What it is | A review an item must pass before it moves on. |
| Where else the same thing can come from | The review gates table. |
| Compared today | Two Packs defining the same review gate differently. |
| Not compared today | A Pack's gate against the table. |
| Agreed | Review gates are compared with each other across names. If two review gates apply different rules to the same Deliverable for the same step, that is a conflict. The user can pick either one or both. |

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
| Agreed | Obligation definitions are compared with each other across codes. If two Obligation definitions apply different rules to the same Deliverable for the same step, that is a conflict. The user can pick either one or both. |

## 9. Engineering capital

| | |
|---|---|
| What it is | Links to useful material, such as standards or guides. |
| Where else the same thing can come from | The Profile's knowledge locations. |
| Compared today | Nothing. The Pack's name is part of each item's name. |
| Not compared today | Two Packs giving different links. A Pack's link against the Profile's locations. |
| Agreed | The same link from two Packs is not a conflict. Different links are a conflict. Each entry has a type and a link (url), so entries of the same type with different links are the ones compared. The user picks. |
| Agreed | An entry with no link is also flagged as a conflict. The user sees it and decides. |

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
