# Anthropic AI adapter: proposed structure (CR-150 step 8)

**Status:** Proposal. Nothing is built.
**Date:** 2026-11-19
**Builds on:** steps 1 to 7 of [CR-150](change-requests/CR-150-ai-participant-skills-and-provider-adapters.md).

## 1. What the adapter must do

1. Be the screen of an AI Participant. It receives the assignment (`AssignmentOut`, with `participantId` and `executionContext`).
2. Keep the protocol skill, the bootstrap instruction and its own provider's job skill from the Engineering Capital entries. Ignore the other providers.
3. Compose a provider specific prompt from those skills and the Work Item content.
4. Call its provider and offer the platform operations as tools.
5. Run each tool call through the same core functions the Participant home uses, as the Participant.
6. Hold the authentication to its provider. The platform identity is the Participant's own.

## 2. Verified facts the proposal rests on

| Fact | Evidence |
|---|---|
| The Participant home core functions take a `userId` that is a `participants_master` id, with no session | `participantHome.ts:88`, `:107`, `:174` (`participantsMasterDB.findById(input.userId)`) |
| `raiseMyAttentionItem` and `reportMyStatus` check the Participant owns an engagement and an outstanding Work Item on the SEU | `participantHome.ts:107-135`, `:174-185` |
| Evidence, Knowledge and Decision creation have their own core functions | `evidence.ts:31`, `knowledge.ts:20`, `decisions.ts:11`, `decisionForm.ts` |
| Core create functions resolve the author badge themselves. A non-root actor needs the badge in `authorised_badges`. | test-fixtures skill, `badgeAuthorityEngine.resolveAuthorBadge` |
| The Demo roster is data: `data/demo/participants.json` and `participantBadges.json`, seeded by `demoParticipants.ts` | `demoParticipants.ts:11-14`, `:34` |
| The onboarding registry holds one adapter per Participant `type`, and `AI` is taken by the mock `aiOnboardingAdapter` | `participantOnboardingRegistry.ts` |
| The delivery handler awaits `deliverAssignment` inside the event subscriber | `assignmentDelivery.ts` |

## 3. Files

| File | Role |
|---|---|
| `src/adapters/aiProviderClient.ts` | The provider client interface. `run(request, onToolCall)` runs one conversation and returns when the model stops. The mock and the real client both implement it. |
| `src/adapters/aiSkills.ts` | `selectSkills(executionContext, jobSkillType)` returns the protocol, bootstrap and job texts by Engineering Capital type |
| `src/adapters/aiTools.ts` | The platform tool definitions and their handlers. Each handler calls a core function with the Participant's master id. |
| `src/adapters/anthropicAiAdapter.ts` | The adapter. Key `ai-anthropic`. Builds the Anthropic shaped prompt (tagged sections, output contract last), runs the client, and reports a failed run. |
| `src/adapters/mockAiProviderClient.ts` | A scripted client for tests and the demo. No network. |
| `src/dblayer/constants.ts` | The adapter key, the Engineering Capital type codes of the three skills, and the environment variable name of the API key |
| `src/dblayer/seed/data/demo/participants.json` and `participantBadges.json` | One Anthropic AI Participant with `adapter: ai-anthropic`, the Capability, Role and Work type of the pilot Deliverable, and the badges its tools need |
| `src/dblayer/seed/demo/demoParticipants.ts` | Reads and validates `adapter` against the registry |

The generic onboarding loop (`seedParticipantsMaster`) is unchanged. The pilot Participant comes from the Demo roster, because the onboarding registry allows one adapter per `type`.

## 4. Tools offered to the AI

| Tool | Core function |
|---|---|
| `provide_evidence` | `createEvidence` (signature to be read) |
| `create_knowledge` | `createKnowledgeItem` (signature to be read) |
| `create_decision` | `createDecisionFromForm` |
| `raise_attention_item` | `raiseMyAttentionItem` |
| `report_status` | `reportMyStatus` |

Tool names stay provisional, as in the job skill draft. Each handler returns the core function's result to the model, so a rule failure (for example "Evidence is needed to claim completion") reaches the AI as text.

## 5. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| 1 | Run the model inside the event subscriber, or in the background. A real run can take minutes and would hold the subscriber. | `deliverAssignment` starts the run, returns `delivered: true`, and logs failures. A failed run raises an Attention Item through the Participant. |
| 2 | Badges for the AI Participant | Grant the same badges a human on the pilot Capability holds, through `participantBadges.json`. No new authority mechanism. |
| 3 | API key source | An environment variable, named in `constants.ts`. The adapter reads it when it makes the first real call. The mock needs none. |
| 4 | Tool loop location | Inside the provider client, so the adapter stays provider neutral about conversation mechanics. |

## 6. Tests

| Test | Coverage |
|---|---|
| Skill selection | Only the protocol, bootstrap and Anthropic job entries are kept. Other providers' entries are ignored. |
| Prompt | The prompt holds the three skills and the Work Item objective, and ends with the output contract |
| Tools | A scripted mock run raises an Attention Item, provides Evidence and reports status. Each lands on the platform as the Participant. |
| Failure | A mock run that throws raises an Attention Item and does not mark the Work Item complete |
| Registry | The adapter key is registered, and the Demo seed rejects an unknown key |

## 7. Not in this step

The real Anthropic client and the first live run are step 9. The `claude-api` reference is read then.
