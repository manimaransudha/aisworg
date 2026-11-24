---
name: spec-and-design
description: Rules for reading the Book 3 specification and for designing or proposing changes against it — spec location, definition vs execution aspect, the EBM rule, and the reuse of the dependency engine and composition strategy. Use whenever the user asks to review, interpret or audit a chapter, to design or propose a fix, or to build SEU-driven behaviour (dispatch, work item, obligation, policy, capability fulfilment, deliverable, commissioning).
---

# Spec and design

- When design/foundations chapters exist for the area, read them thoroughly first; the code lags/diverges from spec. Do not relitigate settled or out-of-scope decisions because a chapter audit mentions them.
- Specifications are in design/foundations/03_Book 3 (Refined). Code may use a refined construct but follows the specification conceptually.
- The specification is read-only. Add or update only the implementation section at the end of a chapter.
- A chapter can have a definition aspect and an execution aspect, even when it does not say so. Identify which one applies before interpreting a chapter or designing from it. A Pack is definition only. The SEU chapter holds both aspects.
- The EBM defines the behaviour of the SEU. The SEU and every SEU-driven entity (dispatch, work item, obligation, policy, capability fulfilment, deliverable and anything related) take what they need from the SEU's EBM. They never read the Template, Profile or Pack directly. Commissioning reads Capabilities from the EBM's pool, which derives them from the Deliverable Catalogue through the Services the composed Packs contribute.
- The dependency engine already has an implementation. Reuse it.
- The composition strategy already has an implementation. Reuse it.
- A design proposal is complete and grounded in the specifications and in what is already implemented.
- Change Requests: see the change-request skill. Do not edit CR files unless the user asks.
