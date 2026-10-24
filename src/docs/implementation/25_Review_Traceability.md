# Implementation Traceability: Chapter 25 – Review Model

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/04_Governance/25_Review.md

## Traceability Table

<!-- multiline -->
**Legend:** ✅ Fully met  ⚠️ Partially met  ❌ Not met  ❓ Not verifiable

<table style="width:100%; table-layout:fixed;">
  <colgroup>
    <col style="width:4%;">
    <col style="width:32%;">
    <col style="width:27%;">
    <col style="width:37%;">
  </colgroup>
  <thead>
    <tr>
      <th></th>
      <th>Intent</th>
      <th>Code Citation</th>
      <th>Finding</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review evaluates whether an engineering object satisfies the criteria required to progress to its next lifecycle state.<br>Ref: §1, §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:3-18<br>src/routes/seu/core/reviews.ts:22-74<br>src/domain/engine/qualityGateEngine.ts:126-136</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Review row names the reviewed object, a category, a criteria document and an outcome. A Quality Gate of type requires_accepted_review reads the outcome when the object moves to the next state.<br>Gap: the criteria document is stored and never read by any code, so the evaluation against criteria is a human judgement entered as an outcome. See §11.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reviews do not perform engineering work and do not authorise it. Their outcomes are consumed by Governance.<br>Ref: §1, §3, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/actions/completeReview.ts:7-14<br>src/domain/engine/qualityGateEngine.ts:126-136<br>src/routes/seu/core/compliance.ts:80-88</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Completing a Review writes only its outcome and state. The reviewed object is not touched. Quality Gate evaluation and compliance evaluation read the Review outcome and decide whether a transition is permitted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review is a governed evaluation against one or more engineering objects.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:6-7<br>src/routes/seu/core/reviews.ts:33-37<br>src/routes/seu/web/reviews.ts:60-75</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Review is created through the governed birth row with a real actor and badge, and refers to one object.<br>Gap: related_object_type and related_object_id hold a single object. A Review across several objects needs one Review per object.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review determines whether the specified review criteria have been satisfied.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:99-115<br>src/dblayer/recovery/reviews_schema_recovery.sql:11-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the reviewer supplies one of six outcomes at completion.<br>Gap: no code compares the object against the criteria. The determination is entered by the actor, not derived.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review produces Findings and Recommendations.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/findings.ts:24-81<br>src/dblayer/recovery/findings_schema_recovery.sql:3-16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Findings are created against a Review with severity, title and description.<br>Gap: the reviews table has no Recommendations field and no Recommendation object exists. Outcome Passed with Recommendations carries no recommendation content.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review does not modify the reviewed object.<br>Ref: §4, RM-001, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:22-74<br>src/dblayer/reviewsDB.ts:5-85<br>tests/review-model.test.ts:55-85</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code path of the Review service writes to the reviewed object. reviewsDB writes only the reviews table. The lifecycle test asserts that the Deliverable lifecycle state is unchanged after a full Review.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reviews are evaluations, repeatable, and may be run more than once for the same object.<br>Ref: §5, RM-001, RM-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:19-20<br>src/dblayer/reviewsDB.ts:53-64<br>tests/review-model.test.ts:140-150</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The reviews table has only non-unique indexes on the related object, so any number of Reviews can exist for one object. The Quality Gate test creates a failed and a passing Review for the same Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reviews are independent of Participants.<br>Ref: §5, RM-002, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:14-20<br>src/dblayer/recovery/reviews_schema_recovery.sql:14,22-24</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the reviewer is a free text column and no transition requires it.<br>Gap: creation resolves the actor to a Participant engaged in the SEU and stores that Participant id as author_id (NOT NULL). A Review cannot be created without a Participant record.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reviews are composable. Review requirements from several Packs apply together.<br>Ref: §5, RM-004, §14, FR-25.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:231-233<br>src/routes/seu/core/packs.ts:601-619<br>src/dblayer/reviewGatesDB.ts:11-61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each Pack publishes its Review Gates to review_gates, and the composition pool receives every Review Gate of every composed Pack.<br>Gap: nothing resolves the pooled gates into an Effective Review Requirements result. No code reads the pooled reviewGate entries after composition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review traceability is complete.<br>Ref: §5, RM-005, FR-25.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:3-24<br>src/routes/seu/core/traceability.ts:90-171</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each Review stores SEU, object, author id, author badge, optional Review Gate link and timestamps. The Deliverable explanation lists its Reviews and Findings.<br>Gap: Evidence, Decisions, reviewing Participants and the EBM version are not stored on a Review. See §15.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review outcomes are reproducible.<br>Ref: §5, RM-006, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:99-115<br>src/actions/completeReview.ts:7-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the outcome is persisted once and can be read back unchanged.<br>Gap: no deterministic evaluation exists, so a second run of the same criteria cannot reproduce the outcome. Reproduction is limited to reading the stored value.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Review has a globally unique identifier.<br>Ref: FR-25.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The id column is a UUID primary key generated by gen_random_uuid().</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reviews support multiple engineering object types.<br>Ref: FR-25.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:6<br>src/routes/seu/core/reviews.ts:33-37<br>src/routes/seu/api/reviews.ts:13-35<br>src/routes/seu/web/reviews.ts:60-75</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: related_object_type is any TransitionEntityType and the API accepts any type. The Quality Gate engine and traceability look Reviews up by type and id.<br>Gap: only a Deliverable is checked for existence and SEU membership. The web form creates Deliverable Reviews only. Other types are not validated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review criteria are declarative.<br>Ref: FR-25.3, §11, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:10<br>src/dblayer/recovery/review_gates_schema_recovery.sql:3-22<br>src/routes/seu/core/packs.ts:253-269</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: criteria is a JSONB document, and Review Gates are declared in Packs as data with a governed transition and Checklist references.<br>Gap: the web form never supplies criteria and no code interprets the stored document. The declaration exists without a consumer.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reviews may be mandatory or optional.<br>Ref: FR-25.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:126-136<br>src/routes/seu/core/packs.ts:253-269</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Review becomes mandatory for a transition when a Quality Gate of type requires_accepted_review names its Review Gate.<br>Gap: neither the Review nor the Review Gate has a mandatory or optional attribute. A Review Gate alone enforces nothing, and optional is the absence of a Quality Gate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review outcomes remain immutable.<br>Ref: FR-25.5, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/actions/completeReview.ts:7-14<br>src/routes/seu/core/reviews.ts:99-108<br>tests/review-finding-event-lifecycle-table.test.ts:124-137</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The complete-review action refuses when an outcome exists and the transition table has no hop back to In Progress, so the outcome is written once. The event lifecycle test asserts that a second outcome is refused.<br>The guard is in the action. The table itself has no trigger.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review categories include Requirements, Architecture, Design, Code, Security, Test, Deployment and Operational Reviews. Packs may add categories.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:8<br>src/routes/seu/web/reviews.ts:60-75<br>src/routes/seu/core/compliance.ts:80-88</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: category is stored and compliance evaluation filters Reviews by category.<br>Gap: category is free text on the form and API. No registry or Pack contribution defines the allowed categories, so the illustrative list and Pack extension are not represented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review defines an identifier, name, category and reviewed object.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:4-9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The columns id, name, category, related_object_type and related_object_id are NOT NULL.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review defines its criteria, outcome, Findings and provenance.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:10-12,22-24<br>src/dblayer/recovery/findings_schema_recovery.sql:5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Columns criteria, outcome, author_id and author_badge exist. Findings reference the Review by review_id (NOT NULL). Criteria are stored but see FR-25.3 for use.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review defines a Review Scope, Required Evidence and Recommendations.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the reviews table and ReviewRow (src/dblayer/seuTypes.ts:755-771) have no scope, required evidence or recommendations field. No other table holds them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review defines Required Participants.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a single reviewer text column.<br>Gap: reviewer is free text with no link to a Participant, and there is no list of required Participants.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review carries a Version.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:15<br>src/dblayer/seuTypes.ts:766</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: an integer version column defaulting to 1.<br>Gap: no code reads or increments it, and Review creation and transition rows do not use version_event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review Gate is a Pack-contributed declaration naming the governed transition for which a Review is required.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:253-269<br>src/routes/seu/core/packs.ts:601-619<br>src/dblayer/recovery/review_gates_schema_recovery.sql:3-17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack validation requires a code, a name and a governedTransition that resolves to an existing transition definition. Publishing upserts a versioned review_gates row keyed by entity type, from state, to state and code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform requires a Review for the governed transition named by a Review Gate.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:126-136<br>src/routes/seu/web/reviews.ts:60-75<br>src/routes/seu/api/reviews.ts:13-35<br>src/routes/seu/core/reviews.ts:22-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Quality Gate with requires_accepted_review blocks the transition unless an Accepted, passing Review carries the Review Gate id.<br>Gap: no code consults review_gates by transition. The web form and the API never pass reviewGateId, so a Review created through them can never satisfy that Quality Gate. Only a direct call to createReview can link a gate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review Gate references zero or more Checklists by identity, limited to Checklists of a Pack with the same code.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:53-70<br>src/routes/seu/core/packs.ts:267-268</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">validateChecklistIds accepts a name declared in the same Pack or the id of a published Checklist whose owning Pack has the same code, and rejects any other reference.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Checklist is a Pack-contributed ordered set of verification statements.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/checklistsDB.ts:5-34<br>src/dblayer/recovery/checklists_schema_recovery.sql:3-13<br>src/routes/seu/core/packs.ts:271-285</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Checklists are published from Pack contributions with an ordered items array. Validation requires a name, at least one item and a statement for each item.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An assigned Participant executes a Checklist against a Deliverable and the execution produces an Evidence record. Governance reads that Evidence, not the Checklist.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts:46-67<br>src/views/seu/seus/detail.ejs:679</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: Checklist statements are copied into a work item context and displayed as text. No code assigns a Checklist to a Participant, records an execution or creates Evidence from one. checklistsDB has no execution table.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Checklist has no independent version or lifecycle. Both come from its Pack.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/checklists_schema_recovery.sql:3-13<br>src/dblayer/checklistsDB.ts:17-24</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The checklists table has no version or status column. The upsert replaces items for the same Pack and name, and the row links to originating_pack_id.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review Gate checklistIds are required (all must complete). The recommendedChecklistIds are advisory and tracked.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/reviewGatesDB.ts:11-61<br>src/dblayer/recovery/review_gates_schema_recovery.sql:18-19<br>src/routes/seu/core/packs.ts:601-619</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: both id arrays are validated, resolved to ids and stored on the Review Gate version.<br>Gap: no code reads checklist_ids or recommended_checklist_ids to require completion or track it. The AND rule has no evaluator.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Checklist referenced by more than one gate executes once and satisfies every referencing gate.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/checklistsDB.ts:17-24<br>src/dblayer/reviewGatesDB.ts:46-51</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Checklist is one row referenced by id, so several gates can name the same one.<br>Gap: with no execution record, there is nothing that runs once or satisfies a gate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review passes through Planned, Prepared, In Progress, Completed, Accepted and Archived.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1132-1182<br>src/domain/engine/entityAdapters.ts:370-388<br>src/routes/seu/core/reviews.ts:89-128<br>tests/review-finding-event-lifecycle-table.test.ts:44-76</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Six transition rows form the linear lifecycle and the birth row creates the Review in Planned. transitionReview moves it through transitionEntity with the actor badge from the row. The definition test checks the rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical Reviews remain permanently available.<br>Ref: §10, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/reviewsDB.ts:43-64<br>src/routes/seu/core/reviews.ts:76-79<br>src/routes/seu/web/reviews.ts:23-58</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No delete function exists in reviewsDB. The SEU listing and the object lookup apply no status filter, so Archived Reviews are returned.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review criteria examples: required Deliverables, mandatory Evidence, Policies, engineering standards, architectural principles, compliance obligations. The Review service interprets them.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:22-74<br>src/dblayer/recovery/reviews_schema_recovery.sql:10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: criteria are accepted at creation as an arbitrary JSON object.<br>Gap: no Review service or criteria engine reads Review.criteria. Nothing checks Deliverables, Evidence or Policies against it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review produces one of Passed, Passed with Recommendations, Rework Required, Failed, Not Applicable or Deferred.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:11-12<br>src/dblayer/seuTypes.ts:753<br>src/views/seu/reviews/index.ejs:107-115</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The table CHECK constraint and the ReviewOutcome type list the six values. Completion requires one of them from the form.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review does not set the next engineering state. Governance consumes the outcome.<br>Ref: §12, §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:126-136<br>src/routes/seu/core/compliance.ts:80-88<br>src/actions/completeReview.ts:7-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Completion changes only the Review. Quality Gate evaluation counts a Review as qualifying when it is Accepted with Passed or Passed with Recommendations and carries the gate id.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reviews may generate Findings. A Finding is an observation made during a Review.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/findings.ts:24-81<br>src/dblayer/findingsDB.ts:6-30</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">createFinding takes a Review, resolves the author, writes the Finding through the birth row and publishes its event. Findings store review_id, object, severity, title and description.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Finding can lead to Obligations, Evidence requests, Decisions and follow-up Reviews.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/findings.ts:122-146<br>src/routes/seu/web/reviews.ts:145-156</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: convertFindingToObligation creates an Obligation, links obligation_id and moves the Finding to Converted. A High or Critical Finding also raises an Attention Item.<br>Gap: no path creates an Evidence request, a Decision or a follow-up Review from a Finding.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Findings are independent engineering objects with complete traceability.<br>Ref: §13, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/findings_schema_recovery.sql:3-22<br>src/dblayer/seed/data/transitionDefinitions.json:1184-1217<br>src/routes/seu/core/traceability.ts:90-171<br>tests/review-model.test.ts:196-209</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Findings have their own table, id, author, birth row and Open, Converted, Resolved and Waived states. The Deliverable explanation lists Findings with their Review and Obligation links.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple Review requirements apply simultaneously and compose into Effective Review Requirements.<br>Ref: §14, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:231-233<br>src/routes/seu/core/packs.ts:253-269</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Review Gates of several Packs enter the composition pool, and a duplicate slot inside one Pack is rejected.<br>Gap: no step turns the pool into an Effective Review Requirements result for a transition. The Quality Gate path reads one gate id.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review composition is deterministic.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:231-233</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review Gates use the shared composition pool, so ordering follows the composition engine. No Review-specific resolved result exists to compare between runs, and no test checks determinism for Review Gates.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review preserves the reviewed object, criteria and generated Findings.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:6-7,10<br>src/dblayer/recovery/findings_schema_recovery.sql:5<br>src/dblayer/reviewsDB.ts:33-64</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The reviewed object and criteria are columns of the Review. Findings link by review_id and are listed by findingsDB.findByReviewId.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review preserves a timestamp.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:16-17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">created_at and updated_at are NOT NULL timestamptz columns.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review preserves supporting Evidence, related Decisions and the Engineering Behavior Model version.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the reviews table has no evidence, decision or EBM version column, and no link table exists. Only the Finding to Obligation link exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Review preserves its reviewing Participants.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:14,22-24</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: author_id (the creating Participant) and a single reviewer text.<br>Gap: the Participants who start, complete and accept the Review are not stored on the row. They appear only in published events.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review history is immutable.<br>Ref: §15, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/reviewsDB.ts:66-84<br>src/domain/engine/entityAdapters.ts:370-388</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the only writes are state and a once-only outcome, and every hop publishes an event with actor and badge.<br>Gap: no state history table and no database guard. Immutability depends on the application and on the event log.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review subsystem publishes ReviewPlanned.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1132-1141<br>src/routes/seu/core/reviews.ts:62-71</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The row names ReviewPlanned and the service publishes it with the actor and badge. The lifecycle test asserts the event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review subsystem publishes ReviewStarted.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1151-1157<br>src/routes/seu/core/reviews.ts:111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The row names ReviewStarted and the service publishes it with the actor and badge. The lifecycle test asserts the event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review subsystem publishes ReviewCompleted.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1159-1166<br>src/routes/seu/core/reviews.ts:111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The In Progress to Completed row names ReviewCompleted and publishTransition publishes it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review subsystem publishes ReviewPassed when the outcome is Passed or Passed with Recommendations.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:112-115<br>tests/review-finding-event-lifecycle-table.test.ts:104-123</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">On completion the outcome event is ReviewPassed for the two passing outcomes, published with the transition correlation id.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review subsystem publishes ReviewFailed.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:112-115<br>tests/review-finding-event-lifecycle-table.test.ts:124-137</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: ReviewFailed is published for Failed.<br>Gap: the same event is published for Rework Required and Not Applicable, which the specification does not call failures. The event cannot distinguish them except through the payload outcome.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review subsystem publishes ReviewDeferred.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:112-115<br>tests/review-finding-event-lifecycle-table.test.ts:124-137</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deferred outcome publishes ReviewDeferred.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review subsystem publishes FindingCreated.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/findings.ts:56-65<br>src/dblayer/seed/data/transitionDefinitions.json:1184-1192</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Finding birth row names FindingCreated and createFinding publishes it with the actor and badge.<br>Note: createFinding raises an Attention Item after the publish, which is code after an event publication.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review subsystem publishes FindingResolved.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1203-1209<br>src/routes/seu/core/findings.ts:94-112</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Open to Resolved row names FindingResolved and applyFindingHop publishes it before FindingTransitioned.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review Model supports deterministic execution.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:89-128</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: lifecycle hops are deterministic table-driven transitions.<br>Gap: review execution against criteria does not exist, so there is no execution to be deterministic.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review Model supports multiple review types.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: category is stored per Review and filterable.<br>Gap: types are free text. See §7.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Review Model supports concurrent Reviews.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:19-20<br>src/dblayer/reviewsDB.ts:53-64</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No uniqueness or lock limits Reviews per object or per SEU, and each Review has its own row and lifecycle.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reviews evaluate engineering objects without modifying them.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/review-model.test.ts:55-85</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §4. The lifecycle test covers it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review criteria are declarative.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/reviews_schema_recovery.sql:10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See FR-25.3. Declared and stored, never interpreted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review outcomes are immutable.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">tests/review-finding-event-lifecycle-table.test.ts:124-137</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See FR-25.5.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Findings are traceable.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:90-171</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §13.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple Review Packs can be composed.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:231-233</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §14. Review Gates pool but are not resolved.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Review history remains permanently available.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/reviewsDB.ts:43-64</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §10.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Review domain model.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:753-771<br>src/dblayer/recovery/reviews_schema_recovery.sql:3-26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ReviewRow, ReviewOutcome, ReviewGateRow and ChecklistRow types with matching tables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Review execution service.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/reviews.ts:22-128</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: createReview and transitionReview run the governed lifecycle.<br>Gap: no step evaluates the object against criteria.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Review criteria engine.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: no module interprets Review.criteria or the Review Gate Checklists. Searches of src/domain and src/routes find no reader.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Finding management service.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/findings.ts<br>src/dblayer/findingsDB.ts:5-84</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">createFinding, listFindingsByReview, transitionFinding and convertFindingToObligation cover creation, listing, lifecycle and conversion.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Review registry.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/reviewGatesDB.ts:63-81<br>src/dblayer/reviewsDB.ts:43-64</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: versioned Review Gate registry and per-SEU and per-object Review lookups.<br>Gap: no cross-SEU Review registry or catalogue of Review categories.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Review APIs.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/reviews.ts:13-135<br>src/dblayer/seed/data/routeAuthority.json:388-412</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: API routes create and list Reviews, create and list Findings and convert a Finding, each with a route_authority row.<br>Gap: the API transition routes for Reviews and Findings are commented out (lines 49-70 and 101-116), so lifecycle hops run only through the web routes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Review events.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1132-1217<br>src/routes/seu/core/reviews.ts:111-125</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Birth and hop events for Review and Finding are wired in the transition table, plus ReviewTransitioned and FindingTransitioned. See §16.</td>
    </tr>
  </tbody>
</table>

## Summary

| Measure | Count |
|---|---|
| Total intents analysed | 69 |
| Fully met ✅ | 34 |
| Partially met ⚠️ | 30 |
| Not met ❌ | 4 |
| Not verifiable ❓ | 1 |

Major implementation gaps:

- Review.criteria is stored but no criteria engine reads it, so no evaluation against criteria occurs (§1, §11, §19).
- Review Gates are not enforced on their own. The web form and API never pass reviewGateId, so a Review made through them cannot satisfy a requires_accepted_review Quality Gate (§9).
- Checklist execution does not exist. checklistIds and recommendedChecklistIds are stored and never evaluated, and no Evidence is produced from a Checklist (§9).
- Review Scope, Required Evidence, Recommendations, supporting Evidence, related Decisions and the EBM version are not stored (§8, §15).
- Review Gates pool through composition but no Effective Review Requirements result is produced (§14).
- Findings do not lead to Evidence requests, Decisions or follow-up Reviews (§13).
- ReviewFailed is also published for Rework Required and Not Applicable (§16).
- Review category is free text with no Pack-extensible registry (§7).
- The Review and Finding transition API routes are commented out (§19).
