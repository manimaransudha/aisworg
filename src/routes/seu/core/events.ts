import { eventsDB } from "../../../dblayer/eventsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import type { EventRow } from "../../../dblayer/seuTypes.js";

// The SEU's own events (commissioning/lifecycle) plus every event published
// against a Deliverable belonging to it (Deliverable transitions publish with
// originatingObjectType 'Deliverable' and the Deliverable's own id, per Ch.29's
// event-per-object model — this merges the two so the SEU's event log reads
// as the SEU's full execution history, not just its own lifecycle events).
export async function getSeuEvents(seuId: string): Promise<EventRow[]> {
  const [{ data: seuEvents }, { data: deliverables }] = await Promise.all([
    eventsDB.findByOriginatingObject("SEU", seuId),
    deliverablesDB.findBySeuId(seuId),
  ]);

  const deliverableEventLists = await Promise.all(
    (deliverables ?? []).map((d) => eventsDB.findByOriginatingObject("Deliverable", d.id))
  );

  const all = [...(seuEvents ?? []), ...deliverableEventLists.flatMap((r) => r.data ?? [])];
  return all.sort((a, b) => Number(a.sequence) - Number(b.sequence));
}
