-- Version Feature Plan.md §3, applied to SEU (Ch.2) and EBM (Ch.3) — same
-- mechanism as migrations 183-188. Unlike every entity fixed so far, both
-- get event_type only; version_event stays NULL on every row for both,
-- confirmed with the owner (2026-09-11):
--   - SEU's lifecycle_state is a runtime EXECUTION lifecycle (a single
--     instance moving Pending -> ... -> Operational -> Retired), not a
--     definition/authoring lifecycle (Draft -> Validated -> Published ->
--     Active, a reusable versioned catalog entry) — the "Revision vs
--     Version" distinction this whole plan is about does not apply to it.
--     Chapter 8 (SEU Commissioning) itself, which drives these transitions,
--     is confirmed the same way: not a versioning-relevant chapter.
--   - EBM's Composed->Validated/Validated->Active hops are explicitly NOT
--     version-significant either, on the owner's own prior word captured in
--     CR-092 Part 9: "did i not say version is not part of validation" —
--     versioning for EBM (a new ebms row, re-composition) is EBMVersioned's
--     own separate, not-yet-built concern, never Validate/Activate's.
--
-- SEU: only the 4 rows CR-092 Part 4/9's real, exercised chain actually
-- calls transitionEngine.evaluate for (finalizeCommissioning's
-- PRE_ASSETS_STEPS + the final Activated->Operational hop) get event_type —
-- these already publish a real, correctly-named event today via an ad hoc
-- `SEU${toState}` string in code; this migration only moves that name into
-- data so the code can read it instead of deriving it (Version Feature
-- Plan.md's own "eventType replaces deriving it from toState at call time"
-- rule). Every other SEU row stays fully NULL, deliberately:
--   - Pending -> Commissioned (verb `commission`): a real, evaluated gate
--     (validateRequest.ts), but no event is ever published off ITS OWN
--     outcome — it only gates whether Validate Request may proceed, and the
--     actual "Commissioned" status change happens later, via the separate
--     Configured -> Commissioned row below. Nothing would ever read this
--     row's event_type.
--   - Pending -> Validated -> Composed -> RuntimeAllocated ->
--     KnowledgeInitialised -> ParticipantsRecruited -> Commissioned:
--     CR-092 Part 4's own deliberately dormant vocabulary chain — "No code
--     wiring yet," re-deferred again in Part 9. No transitionEngine.evaluate
--     call exists anywhere for any of these hops. Left exactly as Part 4
--     left it; wiring these up is a future CR's job, not a side effect of
--     this one.
--   - Operational -> Suspended/Retired, Suspended -> Retired/Operational,
--     Retired -> Archived: Chapter 37 (SEU Lifecycle Management) territory —
--     entirely unbuilt, no code calls these either.
UPDATE transition_definitions
   SET event_type = 'SEUConfigured'
 WHERE entity_type = 'SEU' AND from_state = 'Pending' AND to_state = 'Configured';

UPDATE transition_definitions
   SET event_type = 'SEUCommissioned'
 WHERE entity_type = 'SEU' AND from_state = 'Configured' AND to_state = 'Commissioned';

UPDATE transition_definitions
   SET event_type = 'SEUActivated'
 WHERE entity_type = 'SEU' AND from_state = 'Commissioned' AND to_state = 'Activated';

UPDATE transition_definitions
   SET event_type = 'SEUOperational'
 WHERE entity_type = 'SEU' AND from_state = 'Activated' AND to_state = 'Operational';

-- EBM: only the 2 rows with a real verb, actually evaluated by
-- transitionEbm (core/commissioning.ts), get event_type. Composed ->
-- Retired stays NULL — it has no verb at all (checked directly), and its
-- own EBMRetired event is published as a direct, hardcoded literal from
-- transitionEbm's own dead-reference branch (checkEbmLiveness), never via
-- transitionEngine.evaluate for this specific hop — the same "nothing would
-- ever read it" reasoning as SEU's Pending -> Commissioned row above.
UPDATE transition_definitions
   SET event_type = 'EBMValidated'
 WHERE entity_type = 'EBM' AND from_state = 'Composed' AND to_state = 'Validated';

UPDATE transition_definitions
   SET event_type = 'EBMActivated'
 WHERE entity_type = 'EBM' AND from_state = 'Validated' AND to_state = 'Active';
