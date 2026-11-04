# CR-138 — Registry view pages, separate from the form generator, starting with Capability

**Raised:** 2026-11-02 · **Origin:** The View button on each Registry list opens the authoring edit page in read-only mode, so the Registry has no view of its own. The same page is rendered by the form generator for authoring and for display.
**Status:** ✅ Closed 2026-11-03

## Fix the following

- Each Registry gets its own read-only view page. The form generator is not used for it.
- The Capability Registry is built first.
- The Registry list's View button links to the new view page.
- `x-property-order` is defined in the Capability schema and applies only to the existing form generator.

## Settled design

- A Registry view page is a separate view from the authoring form. The information shown to a reader is designed for reading and is not a disabled form.
- `x-property-order` applies only to the form generator (`generateFields` and the authoring edit page). A Registry view page does not read it. The Pack view takes its tabs from the schema's `x-groups`, through `groupFieldsForDisplay`, as the authoring page does.
- Each Registry view page is designed individually. The pages do not share one generic layout.
- The first page is the Capability Registry view. The Service, Deliverable, Pack, Template and Profile views are built. The Template, Profile and Policy Registries follow later, one at a time.

## Capability Registry view (layout as given by the owner)

| Part | Content |
|---|---|
| Title | "Capability Definition: <Display name>" |
| Back link | "All Capabilities", to the Capability Registry list |
| Lifecycle state | The state of the Capability |
| Code | Muted text |
| Category | The Category |
| Description | The Description |
| Roles and Worktypes | A table with Role in the first column and Worktype in the second. Each Worktype of a Role is its own row. The Ontology name is shown, with the code as muted text under it. |

## Service Registry view (layout as given by the owner)

| Part | Content |
|---|---|
| Title | "Service Definition: <Display name>" |
| Back link | "All Services", to the Service Registry list |
| Lifecycle state | The state of the Service |
| Code | Muted text |
| Purpose | The Purpose |
| Capability | The Capability's Display Name with its code as muted text, linked to the Capability view. The Service stores the Capability code only, so the link goes to the Active Capability Definition for that code. |
| Inputs and Outputs | The Ontology names |
| Success criteria | The Success text |
| Governance | The Governance text |
| Service Level | A table of the expectations: label with its code as muted text, and the target level, target and units |
| Consumers | The Ontology display names of the consuming Capabilities |

## Deliverable Registry view (layout as given by the owner)

| Part | Content |
|---|---|
| Title | "Deliverable Definition: <Display name>". The Display name is the code with hyphens replaced by spaces. |
| Back link | "All Deliverables", to the Deliverable Registry list |
| Lifecycle state | The state of the Deliverable |
| Version | The version number |
| Code | Muted text |
| Description | The Description |

## Service Registry view: Deliverable links

- Each Input and Output links to the Deliverable view of the Active Deliverable Definition for that code, as the Capability link does.
- A code with no Active Deliverable Definition visible to the viewer shows the Ontology name without a link.

## Pack Registry view (layout as given by the owner)

| Part | Content |
|---|---|
| Header | Back link "All Packs"; title "Pack: <name>"; state, version and code as muted text |
| Tabs | Vertical. The same set as the authoring page: the schema's `x-groups`, Dependencies, and one tab per contribution type. The code, name and version are not repeated in Identity & Metadata |
| Reference display | A referenced entity shows its name, with the code muted and the description or purpose muted below. Ids are not shown |
| Identity & Metadata, Compatibility | Label with its value. Ontology values show the display name with the code muted |
| Dependencies | Table. Pack codes show the Pack name with the code muted |
| Services | One column. The Service Definition name links to the Service view, with the code and purpose muted. The Service Level and the stored definition id are not shown |
| Capabilities | One column. The Capability display name links to the Capability view, with the code and description muted |
| Policies | One block per Policy: name, description muted, then Category, Type, Scope and Environments on one line, then a Conditions table |
| Checklists | One block per Checklist: name, description muted. Items in a table with Group in the first column and Item in the second. A group is written once and groups are separated by a line. Ungrouped items come last. The configurable dimension and value are muted text below the item. Item statements render as markdown where the schema marks them so |
| Obligation Definitions, Review Gates, Quality Gates | One block per item, separated by a line. The heading is the title, else the name. The description is muted below it. Category, Origin, Priority and Severity form one line. Classification, Participant, Output contract and External evidence form a second line. Statement, Completion criteria, Assurance and Prompt are labelled paragraphs, and an empty Prompt is left out. Required evidence is an indented section. Applicability deliverables are a table, with transitions as "From → To". Labels are small uppercase muted text above the value |
| Review Gate | The deliverable shows as a muted line under the heading. The governed transition reads "From → To" with the entity type muted |

Implementation notes: the view is `src/views/seu/packs/view.ejs`, the data comes from `src/routes/seu/core/packView.ts`, and the route is `GET /aisworg/seu/packs/:id` with a `route_authority` row. The schema is unchanged. A few field names (code, name, packVersion, description, title, group, items and the contribution tab names) are written in the page.

Open: the Dependencies and composition pack-code links, and the Service link, need an `x-link` style flag in the schema to avoid a literal in the page. The Service link is built with a literal today.

## Template Registry view (layout as given by the owner)

| Part | Content |
|---|---|
| List page | The Template list has no category tabs. The route still computes the category filter, which the page no longer uses |
| Header | Back link "All Templates"; title "Template: <name>"; state, version and code as muted text |
| Tabs | Vertical, from the schema's `x-groups`: Identity & Metadata, Pack Codes, Deliverable Catalogue. The code, name and version are not repeated. Exposable Parameters is the fourth tab: a table of source, parameter, value and whether it is overridable |
| Identity & Metadata | Purpose as a label with its value |
| Pack Codes | The five lists (Domain, Technology, Compliance, Integration, Organisation) as sections with tables. Each row shows the Pack name linked to the Pack view, with the code and category muted |
| Deliverable Catalogue | The catalogue entries show the Deliverable display name linked to the Deliverable view, with the code and description muted. The dependency graph below it is drawn as a diagram of boxes and arrows in columns, with prerequisites to the left of what they gate. The arrows carry no labels |

## Profile Registry view (layout as given by the owner)

| Part | Content |
|---|---|
| Header | Back link "All Profiles"; title "Profile: <name>"; state, version and code as muted text |
| Tabs | Vertical: Identity & Metadata, Pack Codes, Configuration Parameters. The code, name and version are not repeated. Parameter Overrides is the fourth tab: a table of source, parameter and overriding value |
| Identity & Metadata | The ungrouped fields (Readme, Environment, Redispatch settings, Dispatch strategy, Optional pack codes, Knowledge locations) stay here. The Base template links to the Template view. Capabilities and deliverables link to their views with the code and description muted. Deployment targets and Composition options show as label and value lines |
| Pack Codes | As on the Template view |
| Configuration Parameters | Label and value pairs, with Ontology names and the code muted. Participating organisation codes are a table. Environment configuration shows as label and value lines |

Implementation notes: the Template view is `src/views/seu/templates/view.ejs` with `src/routes/seu/core/templateView.ts`, and the Profile view is `src/views/seu/profiles/view.ejs` with `src/routes/seu/core/profileView.ts`. Each route is `GET /aisworg/seu/<templates|profiles>/:id` with a `route_authority` row. The Template view finds its Pack code lists by a field name ending in `PackCodes`. The Profile view reads the `packCode` key of every list row.

Open: the Template Pack-code lookup should be driven from the schema.

## Policy Registry view (layout as given by the owner)

| Part | Content |
|---|---|
| Header | Back link "All Policies"; title "Policy Definition: <name>"; state, version and code as muted text |
| Tabs | Vertical, from the schema's `x-groups`: Identity & Metadata and Governance. The code and name are not repeated |
| Identity & Metadata | Description, Category, Constraint type, Scope and Applicability environments. Ontology values show the display name |
| Governance | One block per condition, separated by a line. The statement is the heading and renders as markdown. Severity follows as a labelled value. Required evidence is an indented section. Related obligations and Exception rules are small tables. Applicability deliverables is a table of the deliverable, its transitions as "From → To", and the governing condition as a sentence. Empty parts are left out |

## Built (2026-11-03)

| Registry | View page | Data |
|---|---|---|
| Capability | `src/views/seu/capability-definitions/view.ejs` | `getCapabilityDefinitionView` in `src/routes/seu/core/capabilityDefinitions.ts` |
| Service | `src/views/seu/service-definitions/view.ejs` | `getServiceDefinitionView` in `src/routes/seu/core/serviceDefinitions.ts` |
| Deliverable | `src/views/seu/deliverable-definitions/view.ejs` | `getDeliverableDefinitionView` in `src/routes/seu/core/deliverableDefinitions.ts` |
| Pack | `src/views/seu/packs/view.ejs` | `src/routes/seu/core/packView.ts` |
| Template | `src/views/seu/templates/view.ejs` | `src/routes/seu/core/templateView.ts` |
| Profile | `src/views/seu/profiles/view.ejs` | `src/routes/seu/core/profileView.ts` |
| Policy | `src/views/seu/policy-definitions/view.ejs` | `src/routes/seu/core/policyView.ts` |

- Each Registry has a `GET /aisworg/seu/<registry>/:id` route, a ViewModel in `src/viewModels/`, an entry in `viewRegistry.ts`, an entry in `redirects.ts`, and a `route_authority` row in `src/dblayer/seed/data/routeAuthority.json`.
- Each Registry list's View button links to its view page.
- The Deliverable lookup `findActiveByCodeVisibleTo` was added to `src/dblayer/deliverableDefinitionsDB.ts`.
- The Pack, Template, Profile and Policy views take their tabs from the schema's `x-groups` through `groupFieldsForDisplay`. The schemas are unchanged.
- No test fixtures changed, because the CR changes no table or column.

## Incidental changes in the same pass

- The Template list page no longer shows category tabs. The Template route still computes the category filter, which the page no longer uses.

## Verification

`tsc`, the tests and `db:clean-slate` were not run. The new routes are denied until `db:clean-slate` reseeds `route_authority`. The owner reviewed the rendered pages.

## Still open

- The Pack and Template pack-code links and the Service link are built with field names written in the page code. Driving them from the schema needs an `x-link` style flag, which is a schema data change.
- The Template pack-code lookup matches field names ending in `PackCodes`.
- The Template route's unused category filter.
- Checklist references in Pack gates, and Checklist and Capability sources in parameter and graph rows, show their stored values.
