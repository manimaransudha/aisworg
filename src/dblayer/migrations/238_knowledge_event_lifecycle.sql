-- Version Feature Plan.md pass for Chapter 16 (Knowledge Model). Same gap
-- shape already fixed for Pack/Template/Profile/Service Definition/Policy
-- Definition: `transition_definitions.event_type`/`.version_event` were NULL
-- for every real Knowledge/KnowledgeScope hop despite `verb` already being
-- populated live (authorityVocabulary.json backfill), and `core/knowledge.ts`
-- was publishing a hardcoded generic `KnowledgeUpdated` literal on every
-- status transition instead of a real per-state event.
--
-- Mapping (owner-confirmed): Knowledge's own 6-state chain lines up against
-- Ch.41 §15's 7 Version event names by name-match where the chapter literally
-- has that state (Validated/Published/Deprecated/Archived), and by position
-- for the two hops with no name match — Observed->Proposed is the first real
-- governed hop (VersionCreated, same placement reasoning as Decision's own
-- Analysed->Proposed), Validated->Accepted takes the remaining VersionActivated
-- slot (owner-confirmed explicitly).
--
-- KnowledgeScope (Acquisition Scope promotion) gets event_type only —
-- version_event stays NULL on all 3 hops (owner-confirmed: "No new version.
-- Existing version's scope is broadened.") — the same treatment SEU/EBM's
-- runtime lifecycle already got in Chapter 8's own pass, for the identical
-- reason: this is not the definition/authoring lifecycle Chapter 41 versions.
UPDATE transition_definitions SET event_type = 'KnowledgeProposed',  version_event = 'VersionCreated'   WHERE entity_type = 'Knowledge' AND from_state = 'Observed'   AND to_state = 'Proposed';
UPDATE transition_definitions SET event_type = 'KnowledgeValidated', version_event = 'VersionValidated' WHERE entity_type = 'Knowledge' AND from_state = 'Proposed'   AND to_state = 'Validated';
UPDATE transition_definitions SET event_type = 'KnowledgeAccepted',  version_event = 'VersionActivated' WHERE entity_type = 'Knowledge' AND from_state = 'Validated'  AND to_state = 'Accepted';
UPDATE transition_definitions SET event_type = 'KnowledgePublished', version_event = 'VersionPublished' WHERE entity_type = 'Knowledge' AND from_state = 'Accepted'   AND to_state = 'Published';
UPDATE transition_definitions SET event_type = 'KnowledgeDeprecated',version_event = 'VersionDeprecated' WHERE entity_type = 'Knowledge' AND from_state = 'Published'  AND to_state = 'Deprecated';
UPDATE transition_definitions SET event_type = 'KnowledgeArchived',  version_event = 'VersionArchived'  WHERE entity_type = 'Knowledge' AND from_state = 'Deprecated'  AND to_state = 'Archived';

UPDATE transition_definitions SET event_type = 'KnowledgeScopePromoted', version_event = NULL WHERE entity_type = 'KnowledgeScope' AND from_state = 'SEU'        AND to_state = 'Capability';
UPDATE transition_definitions SET event_type = 'KnowledgeScopePromoted', version_event = NULL WHERE entity_type = 'KnowledgeScope' AND from_state = 'Capability' AND to_state = 'Enterprise';
UPDATE transition_definitions SET event_type = 'KnowledgeScopePromoted', version_event = NULL WHERE entity_type = 'KnowledgeScope' AND from_state = 'Enterprise' AND to_state = 'Platform';
