# CR-102 — Participant home page

**Raised:** 2026-09-12 · **Origin:** 
Participants should have view of their work and the current quickview is generic. **Status:** 🟢 Built.

quickview/index 
What the user gets to view , depends on the role. 

If the user role is general . i.e. users.role === 'general' (the same field the existing /quickview route already gates on via requireRole('general'); This is not an authority check. ),  they should see their own record information , Name, identifier , status etc. 

They should see their own current seu assignments. The seu assignment should look similar to the seu view (aisworg/seu/seus/), but not have capability fulfilment and the rest of the information on the tabs should be items originating from them or assigned to them.  - I do not know how this page exactly should look. For now I want to start with this . So this has to be a new page. 

## Summary of what was built as first pass 

src/dblayer/participantsMasterDB.ts: added findByUserId to resolve a user's own participants_master identity.
src/dblayer/participantsDB.ts: added findByParticipantMasterId to list every per-SEU engagement for that identity.
src/routes/seu/core/participantHome.ts (new): getParticipantHomeView(userId) builds the master record plus, per SEU engagement, a copy of getSeuDetailView scoped down (via Commands/Work Items) to only the Deliverables/Obligations/Evidence/Decisions/Knowledge/Commands/External Interactions/Events that are assigned to or originate from that Participant — Capability Fulfilment dropped entirely.
src/routes/web/public.js: /quickview now branches on req.session.user.role === 'general' — general users get the new participant view, everyone else keeps the existing "Commissioned SEUs" list.
src/views/quickview/participant.ejs (new page): master record card (Name/Identifier/Type/Status) + one section per SEU engagement, same CR-083 card/state-badge look and vertical-tab layout as seu/seus/detail.ejs, minus Capability Fulfilment.
Note: this first pass is read-only (no transition forms) — I judged that reusing the write forms would require duplicating a lot of the existing detail page's POST-form markup for a "start somewhere" page you said you don't have a final shape for yet. Say if you want the transition actions wired in too.