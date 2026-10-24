# Audit of Traceability Reports 01 to 04

Scope: 01 Pack, 02 Capability, 03 Service, 04 Template. The reports were not edited.

## Method and limits

- Every cited path and line range was checked mechanically. All 206 citations (58, 51, 50 and 47 per report) point at existing files and in-range lines.
- Each row's cited code was then read. Where a finding asserted a specific fact, that fact was checked against the repository.
- Only the opening lines of long cited ranges were read. A citation not listed below was found relevant on that reading, which does not prove every sentence of its finding.
- Test files cited in these reports were not opened. 01 to 04 cite none.

## Summary

| Report | Rows | Wrong citation | Rating or finding wrong | Hedged or unverified | Missing row | No citation on a row that needs one |
|---|---|---|---|---|---|---|
| 01 Pack | 44 | 6 | 1 | 1 | 0 | 1 |
| 02 Capability | 33 | 3 | 0 | 0 | 0 | 2 |
| 03 Service | 32 | 3 | 3 | 1 | 0 | 0 |
| 04 Template | 30 | 0 | 2 | 0 | 1 | 0 |

## 01 Pack

| Row | Issue | Correction |
|---|---|---|
| #6 PM-002 | Cites `packs.ts:119-126` (`packMetadataFromSeed`). The strategy validation is elsewhere. | Cite `packs.ts:168-181`. |
| #7 PM-003 | Cites `packs.ts:179-181` (composition strategy arity). The finding is about semver. | Cite `packs.ts:161` (`semverError("packVersion")`). |
| #9 PM-005 | The gap says child rows "were not shown to hold a Pack id in this review". `originating_pack_id` or `pack_id` exists on capabilities, authority_rules, checklists, policies, quality_gates, review_gates, services, compliance and metric tables. | Remove the hedge. The rating is likely ✅ and needs a pass over each contribution kind. |
| #14 §6.6 | Cites `packs.ts:370-396`, which is the Technology and Domain competency check. It does not show the absence of an Integration restriction. | Cite the Pack category validation block, or state the gap with no citation. |
| #15 §7 | Cites `packs.ts:175-181` (composition strategy). The finding is about installation classification. | Cite `packs.ts:164`. |
| #28 §11 | Cites `packsDB.ts:193-203` (`findActiveByCodes`). The finding names `findVersionsByCode`. | Cite `packsDB.ts:214-221`. |
| #39 §16 | ✅ with no citation. | Add the citation. |
| #41 §17 | Cites `packsDB.ts:225-235` (`findById`). The finding says listing orders by category. | Cite the listing query that orders by category. |
| #38, #43 | `packsDB.ts:164-172` and `profileCompositionUnravel.ts:80-103` do not show a single-Active-per-code guarantee or compatible-Pack resolution. | Re-cite or state the gap without a citation. |

## 02 Capability

| Row | Issue | Correction |
|---|---|---|
| #3 FR-2.3 | ⚠️ with no citation. | Cite the UUID primary key and the per-tenant or per-Pack unique keys. |
| #11 CM-004 | The claim "the schema has no uniqueness on participant" has no schema citation. It holds (`capability_fulfilments_schema_recovery.sql` has a primary key only). | Cite `capability_fulfilments_schema_recovery.sql`. |
| #14 §7 | Cites `packs.ts:288-289`, which derives deliverable names. The upsert is at `packs.ts:499-512`. | Re-cite. |
| #20 §11 | Cites `capabilitiesDB.ts:32-60` and `capabilityDefinitionsDB.ts:133-156`. They show find by code and by code and version, not discovery by originating Pack or by Objective. | Cite the actual lookups the finding names. |
| #31 §17 | The commented-out API fulfil route is stated but not cited. | Cite `src/routes/seu/api/seus.ts`. |

Completeness: FR-2.1 to FR-2.7, CM-001 to CM-006, §7 to §14, the ten events, §15 to §17 are all covered.

## 03 Service

| Row | Issue | Correction |
|---|---|---|
| #3 SVC-003 | Rated ⚠️ while the finding states no defect. | Rate ✅, or state a real gap. |
| #4 SVC-004 | Rated ✅. The Service schema requires only `code`, `name`, `capabilityCode`. `serviceLevel` is optional with no `minItems`, and `[]` satisfies NOT NULL. The row itself says the grammar "was not confirmed". The `services` table defaults `service_level` to `'{}'`, an object, where the type is an array. | Rate ⚠️. Gap: a Service can be created with no Service Level. |
| #10 FR-3.5 | Rated ❌ while the finding describes implemented Service Definition events. | Rate ⚠️ with the same gap text. |
| #25 §14 | Cites `transitionEngine.ts:138-163`, which publishes `PolicyApplied`. | Cite `entityTransition.ts:83-93` (`publishTransition`). |
| #18 §10 | Cites `dispatchEngine.ts:100-130` (the no-available-participant event). It does not show eligibility and dispatch as separate engines. | Re-cite. |
| #6 SVC-006 | Cites `servicesDB.ts:11-69`. The claim that no code writes measurements to Service tables is a universal negative with no search recorded. | Record the search or re-cite. |

Verified: `servicesDB.ts:45` is the only `INSERT INTO services`, so #1 stands. Events ServiceRequested, ServiceDelivered, ServiceLevelMet and ServiceLevelBreached are absent, so #26 stands.
Completeness: FR-3.1 to FR-3.7, SVC-001 to SVC-006, §7 to §17 are covered.

## 04 Template

| Row | Issue | Correction |
|---|---|---|
| §8 Template Categories | No row. 04 has no category row, while 05 (Profile) has one. The templates table has no category column. | Add a row. The section is illustrative and says further categories come through Packs. |
| #9 FR-4.4 | The finding says no code reads the parent. `inheritedTemplateContent` (`sdkAuthoring.ts:569-590`) copies the parent's code, name, purpose, Pack lists and deliverable catalogue into a new Draft, and `createAuthoringDraft` (`sdkAuthoring.ts:731-743`) uses it. The report cites neither. | State inheritance as a copy at creation plus validation (`templates.ts:343-384`). The rating stays ⚠️. |
| #10 §9 | The finding says "a child must restate every parent Pack. There is no automatic carry-over". The creation-time copy above carries parent Packs and deliverables into the Draft. | Rewrite the gap. Carry-over happens at creation. Later parent changes are not reflected and no delta is stored. |
| #2, #3, #26 | Citations `compositionEngine.ts:235-258` and `profileCompositionUnravel.ts:95-290` are broad and mostly Profile or Pack code. | Narrow to the Template-specific lines (`profileCompositionUnravel.ts:107-117,168-181`). |

Completeness otherwise: FR-4.1 to FR-4.8, §4 to §7, §9 to §19 are covered.

## Recommended next step

Correct the rows above in place for 01 to 04, re-read each corrected citation, and re-count the summaries. The Pack #9 and Template #9 and #10 changes alter findings. The Service #3, #4 and #10 changes alter ratings. Awaiting your decision to proceed.
