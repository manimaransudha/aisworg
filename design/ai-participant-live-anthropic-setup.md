# Using the live Anthropic API for an AI Participant

**Status:** Setup guide. No live call has been made.
**Date:** 2026-11-19
**Belongs to:** [CR-150](change-requests/CR-150-ai-participant-skills-and-provider-adapters.md)

## 1. Summary

| # | What is needed | Who does it | State |
|---|---|---|---|
| 1 | An API key from an Anthropic API account with billing | The owner, outside the platform | Open |
| 2 | The key in a copy of a Demo Profile, and a new SEU commissioned from it | The owner, on the platform | The mechanism is built |
| 3 | A way for the AI to read the input location and write the output location | Build | Not built. The AI has five tools and none reads or writes a location |
| 4 | Reviewed skill texts, a Deliverable that can complete, and a first test with one Work Item | The owner | Open |

## 2. The API key

- A Claude subscription does not include API access. The API is a separate account in the Anthropic Console, with its own billing.
- The steps are: create the account, add credits or billing, create an API key and set a spend limit.
- The exact Console steps and the pricing have not been verified here. Check them on Anthropic's own pages.
- The platform uses the model `claude-sonnet-5-5` with effort `high`. The model is a constant in `src/dblayer/constants.ts`.

## 3. Wiring the key in the Profile

| Step | Action |
|---|---|
| 1 | Copy a Demo Profile as a new version. |
| 2 | Add a row to `aiProviderCredentials`: provider `anthropic`, endpoint `Anthropic`, and the key. The key input is a password field and the key is shown masked afterwards. |
| 3 | Publish the Profile version. |
| 4 | Commission a new SEU from that Profile version. |
| 5 | Dispatch a Work Item to a Demo AI Participant (adapter `ai-anthropic`). |

How it works, verified in `src/adapters/anthropicCredentials.ts`:

- The key is read from the settled Profile of the SEU's EBM. An SEU commissioned before the change keeps the simulated endpoint.
- Endpoint `Simulated`, the default, calls the simulator. Only `Anthropic` calls the live API.
- The resolver refuses any SEU whose tenant is not `demo`. The client refuses to run when `NODE_ENV` is `test` or `NODE_TEST_CONTEXT` is set.
- The server needs outbound HTTPS to the Anthropic API.
- The key is stored as plain text in the Profile. This is a settled design decision (CR-150, 12a).

## 4. Input and output locations

| Location | Where it comes from | Today |
|---|---|---|
| Input | The Deliverable Definition's `guide_location`. The Work Item generator reads it live. | The Demo value is a link on `guides.example.com`, which is not a real page. |
| Output | The Profile parameter `knowledgeLocations`, one entry per Deliverable code, read by `resolveOutputLocation` in `workItemGenerator.ts`. | The Demo Profiles hold no entry for Source Code, so the output is empty. |

The AI has these tools: `provide_evidence`, `create_knowledge`, `create_decision`, `raise_attention_item` and `report_status`. None of them opens a URL or writes a file. A real run therefore cannot read the guide or place the artefact.

### 4.1 Options

| Part | Option | Effort | Notes |
|---|---|---|---|
| Read | A tool that fetches an http or https URL and returns the text | Small | Limited to the schemes and hosts the owner allows. The input must be a real, reachable page. |
| Write | The AI puts the artefact in the Evidence description. A person places it. | None | The pilot works with the tools that exist. |
| Write | A tool that writes to the location | Larger | One writer per kind of location. GitHub needs a token and S3 needs credentials. The credential would be a Profile parameter, as the API key is. |

A recommended first step is the read tool and the Evidence as the output. A write tool follows once the owner chooses the locations.

## 5. Other points to settle before the first run

| # | Point |
|---|---|
| 1 | The three skill texts are drafts, and the real model follows them. The job skill's pilot section (section 4) is blank. The owner reviews all three. |
| 2 | The tool names are provisional. |
| 3 | Choose a Deliverable with a real guide URL and with no open Policy block or Attention Item. Otherwise the AI reports Blocked or Completed Pending Attention, which is correct but hides what the AI can do. |
| 4 | The client has never run against the live API. Its request options (the effort setting, the fallback beta header and `fallbacks`) are untested. A rejected request raises the Attention Item "The AI run failed" with the error text. |
| 5 | A run takes up to 40 turns (`ANTHROPIC_MAX_TURNS`) with up to 16000 output tokens each (`ANTHROPIC_MAX_TOKENS`). Every dispatch starts a run. The Coding Agent held two Work Items on one Deliverable in the Demo, which doubles the cost of that Deliverable. |
| 6 | The Work Item context is sent to Anthropic, including checklists, locations and Attention Item titles. |
| 7 | The AI's narration after the first turn is not stored. The page shows the Evidence description and the events. |

## 6. First live run

1. Set a spend limit in the Console.
2. Prepare one Deliverable as in 5.3, with a reachable guide URL.
3. Wire the Profile (section 3) and commission a new SEU.
4. Dispatch one Work Item to one Demo AI Participant.
5. Read the Participant page. A failed run shows as an Attention Item on the Deliverable, and a successful one shows the Evidence and the events.
6. Check the usage in the Console.
