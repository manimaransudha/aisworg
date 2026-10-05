---
name: implementation-traceability
description: Compare a specification against the implemented codebase and produce intent-level implementation traceability, including specification references, source-code citations, implementation findings, and implementation gaps. Use when asked to verify, audit, trace, assess, or compare specification against its implementation.
---

# Implementation Traceability

## Purpose

Analyse a specification against the actual implementation in the code repository.

The objective is to determine, for **every meaningful intent** expressed anywhere in the specification:

1. What the specification intends.
2. Where that intent is stated in the specification. 
3. What the code actually implements.
4. Where the implementation exists in the source code.
5. Whether the implementation satisfies the intent.
6. What is missing, incomplete, different, or unverifiable.

The analysis must cover the ENTIRE specification, including all sections and subsections.

Do not limit the analysis to sections explicitly called "Requirements", "Functional Requirements", or "Acceptance Criteria".

---

# Core Principle

Determine what the specification intends, determine what the code actually does, and compare the two.

Do not infer implementation merely from:

- matching names
- similarly named functions
- comments
- TODOs
- documentation
- type definitions
- unused code
- test names
- route names
- database columns
- configuration entries
- imports
- partially implemented functions

Code must provide credible evidence that the intended behaviour is actually implemented.

Never claim that an intent is implemented without investigating the relevant execution path.

---

# Inputs

The user will normally provide or identify:

- a specification
- the repository containing the implementation. By default, this will be the current project folder.

The specification may be:

- a Markdown file
- a text file
- a document
- a requirements document
- a feature description
- a collection of specification sections

The default specification path is design/foundations/03_Book 3 (Refined).

If multiple possible specifications exist, ask the user to identify the correct one rather than arbitrarily selecting one.

---

# Analysis Scope

The complete specification is the authoritative source for the analysis.

Inspect every:

- section
- subsection
- requirement
- business rule
- workflow
- behaviour
- constraint
- validation rule
- data requirement
- persistence requirement
- integration requirement
- error-handling requirement
- security requirement
- permission requirement
- UI requirement
- API requirement
- state-transition requirement
- calculation
- condition
- exception
- dependency
- lifecycle behaviour
- other statement that expresses intended system behaviour

Explanatory prose does not automatically become an intent.

Distinguish between:

1. Contextual/explanatory text
2. Normative intent
3. Examples
4. Constraints
5. Implementation-specific instructions

Analyse normative intent and implementation-relevant constraints.

---

# Phase 1: Read and Decompose the Specification

Read the complete specification before evaluating implementation.

Do not start by searching the repository for individual keywords from the first section.

First construct a mental intent inventory.

For each relevant specification section:

- preserve the section hierarchy
- identify distinct intents
- separate compound requirements into independently verifiable intents
- retain the original meaning
- avoid inventing requirements not present in the specification

Each intent should be sufficiently atomic that it can independently be classified as:

- Fully met
- Partially met
- Not met
- Not verifiable

Example:

Specification:

> Users can pause an assessment and resume it later from the point at which they paused.

This contains at least two implementation concerns:

1. The assessment can be paused.
2. The paused state can be persisted and later restored.

Do not reduce these into one finding if the implementation could satisfy one but not the other.

---

# Phase 2: Establish Specification References

Every intent must retain a specification reference.

Prefer:

`§ 4.2.1`


If the specification does not have numbered sections, use the document heading hierarchy.

When useful, include a short quotation or paraphrase identifying the relevant specification statement.

Do not invent section numbers.

---

# Phase 3: Investigate the Repository

For each intent, investigate the repository to identify actual implementation evidence.

Use a progressively deeper investigation:

1. Search for domain terminology.
2. Search for relevant routes, controllers, services, components, functions, classes and database objects.
3. Open the candidate source files.
4. Follow calls into dependent implementation layers.
5. Inspect persistence and data flow where relevant.
6. Inspect configuration where relevant.
7. Inspect tests where they provide evidence of actual implemented behaviour.
8. Inspect related modules when the implementation crosses module boundaries.

Do not stop at the first matching file.

Do not assume that a function's name describes what the function actually does.

---

## Trace the Actual Execution Path

Where applicable, trace the implementation through the real execution path.

For example:

```text
Route
  ↓
Controller
  ↓
Service / Domain Logic
  ↓
Repository / Database
  ↓
External Service
  ↓
Response / UI
```

The exact architecture may differ.

Follow the repository's actual architecture.

If an intent depends on multiple components, cite the relevant implementation locations rather than citing only the first entry point.

Implementation Evidence Rules

A code citation is valid evidence only when the cited code materially contributes to satisfying the intent.

Strong evidence includes:

- executable business logic
- validation logic
- state transitions
- persistence operations
- API behaviour
- UI behaviour
- calculations
- condition handling
- authorization checks
- error handling
- integration logic

Weak or insufficient evidence includes:

- comments describing intended behaviour
- TODOs
- unused functions
- dead code
- names alone
- documentation claiming the behaviour exists
- tests without corresponding implementation
- mocks that do not represent production behaviour

Tests may be cited as supporting evidence, but passing tests alone do not prove that the complete specification intent is implemented.

**Do Not Confuse Presence With Behaviour**

The following are not sufficient conclusions:

"There is a pauseAssessment() function, therefore pause is implemented."

Instead determine:

- Is the function reachable?
- Is it invoked by the relevant workflow?
- Does it perform the required state transition?
- Is the resulting state persisted if required?
- Does subsequent behaviour consume that state?
- Are relevant edge cases handled?
- Does the behaviour match the specification?

The same principle applies to APIs, database tables, UI controls, configuration and other implementation artefacts.

# Phase 4: Compare Intent Against Implementation

For every intent, compare the intended behaviour with the actual implementation.

Classify the result using exactly one of these values:

- Fully met: when the available implementation evidence demonstrates that the intent is implemented. The implementation does not need to use the same terminology or structure as the specification. Semantic equivalence is sufficient.

- Partially met: when some but not all of the intent is implemented. Typical cases: only part of a workflow exists, one condition is handled but another is missing, persistence exists but restoration does not, the happy path exists but specified error handling does not, the feature works for some supported cases but not all specified cases, the implementation materially differs from part of the specification etc. The Finding must explicitly identify what is implemented and what is missing.

- Not met: when the specification intent requires implementation and no credible implementation evidence was found. Do not use Not met merely because a keyword search failed. Investigate sufficiently before concluding that something is absent.

- Not verifiable: when the repository does not contain enough evidence to establish whether the intent is satisfied. Examples: behaviour depends on an external system unavailable in the repository, implementation is generated outside the repository, required runtime configuration is unavailable, a third-party service provides the behaviour and cannot be inspected, the relevant implementation is intentionally opaque. Use this sparingly.

# Phase 5: Identify Gaps

A gap is a difference between the specified intent and the implemented behaviour.

For every Partially met or Not met result, clearly describe the gap.

A useful finding has this structure:

Implemented:
<what the code actually does>

Gap:
<what the specification requires that the implementation does not provide>

Do not merely write:

"Not fully implemented."

Explain exactly what is missing.

Also identify deviations where the implementation behaves differently from the specification.

## Code Citations

Every Fully met and Partially met finding should normally contain one or more source-code citations.

Use:

path/to/file.js:42-67

For example:

src/services/assessmentService.js:142-158

When multiple files form the implementation chain:

src/routes/assessment.js:34-47
src/controllers/assessmentController.js:81-109
src/services/assessmentService.js:142-158

Use the smallest useful line range that establishes the evidence.

Do not cite an entire file when a smaller range is sufficient.

Do not invent a source-code citation for missing functionality.

For Not Verifiable, explain what evidence is unavailable.

## Output

The primary output must be a traceability table with exactly these columns:

|Intent	| Specification Reference	| Code Citation	| Finding	| Intent Met|

Do not replace these columns with a different schema. The table has to be multiline. Use <br> to break sentences.

A example output: 

<!-- multiline -->
| Intent | Specification Reference | Code Citation | Finding | Intent Met |
|---|---|---|---|---|
| SDK provides a stable contract between Platform Core and Elements developers | §1 Purpose | src/routes/seu/core/schemaRegistry.ts:61-108 | Each schema version, once created, is immutable; new versions are new rows. <br>Content authored against a version is checked against that exact version indefinitely. | Fully met |
| Platform evolves through SDK extension rather than Runtime Kernel modification | §1 Purpose | src/domain/sdk/formGenerator.ts:15-283<br> src/routes/seu/core/schemaRegistry.ts | A new field on Pack/Template/Profile/etc. is added via a `schema_definitions` row with no code change, provided it reuses an existing widget type.<br> **A genuinely new widget type requires code changes to formGenerator.ts.** | Partially met |
| SDK is the sole supported mechanism for creating production Schemas | §3 Architectural Position | src/routes/seu/core/schemaRegistry.ts:17 (kind registry)<br> src/routes/seu/core/sdkAuthoring.ts | All 7 registered kinds (Pack, Template, Profile, Deliverable, Service, Policy, Capability) are created only through this authoring path. <br>TransitionDefinition is authored through a separate `/authority` form, outside this registry. | Partially met |
| SDK-001: every production Platform Element created via SDK | §5 SDK-001 | src/routes/seu/core/schemaRegistry.ts:17 | True for the 7 registered kinds. <br>TransitionDefinition is a documented exception, authored elsewhere. | Fully met |
| SDK-002: SDK independent of Runtime Kernel implementation | §5 SDK-002 | src/domain/sdk/formGenerator.ts<br> src/routes/seu/core/sdkAuthoring.ts | Validators and generators operate on plain JSON; they call transitionEngine/compositionEngine as consumers but do not alter kernel behavior. | Fully met |
| SDK-003: SDK outputs deterministic | §5 SDK-003 | src/routes/seu/core/schemaRegistry.ts:61-108 | Validation and schema-version comparison are pure functions over input plus DB state, deterministic. <br>**No packaging step exists to evaluate determinism against** (see Packaging intents below). | Partially met |

Refer design/implementation/Chapter_39_SDK_Architecture_Traceability.md for a completed work. 

## Intent

State the intended behaviour concisely.

It should describe the semantic intent rather than simply copying the specification. Use simple sentences. Do not use em-dash type sentences.

## Specification Reference

Identify the exact section/subsection containing the intent.

## Code Citation

Identify the source file and line range containing implementation evidence.

Multiple citations are allowed when the implementation crosses components.

## Finding

Describe what the implementation actually does.

For Partially met and Not met, explicitly describe the gap.

Do not use vague statements such as:

- "This is incomplete."
- "Needs work."
- "Not implemented correctly."
- "There may be an issue."

State the concrete difference between specification and implementation.

## Intent Met

Use exactly:

- Fully met
- Partially met
- Not met
- Not verifiable

## Output Ordering

Preserve the order of the specification.

Findings should appear in the same logical order as the intents occur in the specification.

Do not reorder findings according to:

severity
implementation status
number of code citations
ease of implementation
perceived importance

The output should therefore provide a traceability view of the specification from beginning to end.

## Completeness Requirement

Before producing the final output, verify that every relevant specification section has been considered.

Create an internal coverage check:

Specification section → intents identified → implementation investigated → finding produced

Do not omit a section merely because it appears descriptive.

If a section contains no implementation-relevant intent, it does not require a row, but it should still have been reviewed.

## Avoid False Positives

Do not mark an intent as Fully met because:

- a similarly named function exists
- a database field exists
- an API endpoint exists
- a UI button exists
- a comment says the feature is supported
- a test is named after the requirement
- documentation claims the feature exists

Trace the behaviour.

## Avoid False Negatives

Do not mark an intent as Not met simply because the exact terminology from the specification is absent from the source code.

Implementation terminology may differ from specification terminology.

Search semantically and follow the application's execution flow.

For example:

Specification:

The system preserves the user's current assessment state.

Possible implementation terminology:

- saveProgress()
- persistAttempt()
- updateAttemptState()
- checkpoint()

These may all represent the same intent.

## Cross-Cutting Requirements

When an intent crosses multiple layers, evaluate the complete behaviour.

For example, if the specification requires:

A user can submit an assessment and the submission is permanently recorded.

Do not mark it Fully met merely because an HTTP POST endpoint exists.

Investigate:

UI
→ HTTP request
→ route
→ controller
→ service
→ persistence
→ transaction/error handling

Determine whether the complete intended behaviour is actually achieved.

## Error and Edge Cases

If the specification explicitly describes error handling or edge cases, analyse them as separate intents where appropriate.

For example:

- Normal submission
- Invalid submission
- Expired assessment
- Duplicate submission
- Unauthorized submission
- Persistence failure

Do not assume that implementation of the normal path satisfies the error-path requirements.

## Tests

Tests are evidence, not the implementation itself.

Use tests to:

- confirm expected behaviour
- identify supported scenarios
- identify missing coverage
- understand intended implementation behaviour

However:

A test named should_resume_assessment is not evidence that resume functionality works unless the test and implementation establish that behaviour.

A passing test does not override contradictory implementation evidence.

## Contradictions

If the specification and implementation clearly disagree, report the discrepancy.

Example:

Finding:
The specification requires a 30-minute timeout. The implementation
uses a 60-minute timeout in assessmentService.js:210-218.

Do not silently reinterpret the specification to match the implementation.

## Uncertain Findings

When evidence is ambiguous, state the uncertainty explicitly.

For example:

The controller passes the value to an external service, but the
repository contains no implementation or contract establishing whether
the external service performs the required validation.

Use Not Verifiable when the missing evidence prevents a reliable conclusion.

Do not convert uncertainty into Fully met or Not met.

## Final Summary

After the traceability table, provide a short summary containing:

total intents analysed
Fully met count
Partially met count
Not met count
Not Verifiable count
Major implementation gaps

Do not provide a quality score or percentage unless explicitly requested.

Do not rank the gaps unless explicitly requested.

## Required Behaviour

When invoked for implementation traceability:

1. Locate and read the complete feature specification.
2. Decompose the complete specification into implementation-relevant intents.
3. Preserve specification section hierarchy.
4. Investigate the repository for each intent.
5. Follow actual implementation paths.
6. Cite concrete source-code locations.
7. Compare intended behaviour with actual behaviour.
8. Identify implementation gaps and deviations.
9. Classify every intent as Fully met, Partially met, Not met or Not verifiable.
10. Produce the complete traceability table.
11. Verify that all specification sections were considered.
12. Provide the summary counts.

Do **not** modify application source code while performing this analysis. 

Do **not** modify the specification file while performing this analysis. 

Write the analysis in the output folder design/implementation. Do not dump the analysis in the conversation. The conversation should not report the agent's workings or summary. Operate in a muted mode. Only report task completion.

Do not modify application source code while performing this analysis unless the user explicitly asks for implementation changes.


# Execution Constraints

## No Sub-Agents

Do not use, create, delegate to, or invoke sub-agents for this analysis.

The complete specification analysis and repository investigation must be
performed by the current Claude Code agent.

Do not delegate:

- specification decomposition
- repository searching
- source-code investigation
- implementation tracing
- gap analysis
- finding generation
- completeness verification

Perform the analysis directly using the available repository tools.

---

# Conversation Output

Keep the conversational response FULLY SILENT.

Do not expose the detailed reasoning process, search strategy, intermediate
analysis, or investigation narrative in the conversation.

Do not provide a running explanation of:

- which files are being searched
- which keywords are being searched
- why a particular file was selected
- intermediate hypotheses
- intermediate conclusions
- internal reasoning
- step-by-step repository investigation

The detailed analysis belongs in the final traceability output, not in the
conversation narrative.

I do not want a verbose conversation. The analysis has to still be thorough. 