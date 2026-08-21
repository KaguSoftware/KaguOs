import { Panel, PanelHeader } from "@/components/ui/panel";
import { CreativeCard } from "@/components/marketing/creative-card";
import type { Creative, MembersMap } from "@/lib/types";

/**
 * MY QUEUE — the personal work list, extracted from the old landing page when
 * the section pivoted to a dashboard (2026-08-21). Same strict partition as
 * before: every video lands in exactly ONE group, decided by the first rule
 * that matches, because four independent filters overlap and a queue that
 * double-counts is a queue nobody trusts.
 *
 * The order of the rules IS the priority order of the work.
 */
export function MyQueue({
  creatives,
  members,
  userId,
  today,
  canWrite,
  house,
}: {
  /** Already excludes `live` — the queue is about work remaining. */
  creatives: Creative[];
  members: MembersMap;
  userId: string;
  today: string;
  canWrite: boolean;
  house: boolean;
}) {
  const sentBack: Creative[] = [];
  const overdue: Creative[] = [];
  const waitingOnClient: Creative[] = [];
  const mine: Creative[] = [];

  for (const creative of creatives) {
    const isMine =
      creative.owner_id === userId || creative.editor_id === userId;
    const isLate = creative.publish_on !== null && creative.publish_on < today;

    if (creative.status === "changes_requested") sentBack.push(creative);
    else if (isMine && isLate) overdue.push(creative);
    else if (creative.status === "client_review") waitingOnClient.push(creative);
    else if (isMine) mine.push(creative);
    // Anything else belongs to a colleague and is not late: it is on their
    // queue, and showing it here would make this list a second board.
  }

  return (
    <div className="space-y-5">
      <QueueGroup
        title="Sent back"
        hint="Changes were asked for. These come first."
        rows={sentBack}
        members={members}
        canWrite={canWrite}
        house={house}
      />
      <QueueGroup
        title="Overdue"
        hint="Past their publish date and not live."
        rows={overdue}
        members={members}
        canWrite={canWrite}
        house={house}
      />
      <QueueGroup
        title="Yours"
        hint="You're the producer or the editor."
        rows={mine}
        members={members}
        canWrite={canWrite}
        house={house}
        emptyLine="Nothing on you right now."
      />
      <QueueGroup
        title="With the client"
        hint="Waiting on someone else. Nothing to do but chase."
        rows={waitingOnClient}
        members={members}
        canWrite={canWrite}
        house={house}
      />
    </div>
  );
}

/**
 * A group renders nothing when empty — except "Yours", where an empty personal
 * list is information. "Sent back" and "Overdue" are alarms: their absence is
 * the good state, and two permanent "all clear" boxes would be noise.
 */
function QueueGroup({
  title,
  hint,
  rows,
  members,
  canWrite,
  house,
  emptyLine,
}: {
  title: string;
  hint: string;
  rows: Creative[];
  members: MembersMap;
  canWrite: boolean;
  house: boolean;
  emptyLine?: string;
}) {
  if (rows.length === 0 && !emptyLine) return null;

  return (
    <Panel>
      <PanelHeader
        title={
          <span className="flex items-baseline gap-2">
            {title}
            <span className="font-mono text-xs font-normal text-faint tabular-nums">
              {rows.length}
            </span>
          </span>
        }
        action={<span className="text-xs text-faint">{hint}</span>}
      />
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-[calc(13px*var(--text-scale,1))] text-faint">{emptyLine}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((creative) => (
            <li key={creative.id}>
              <CreativeCard
                creative={creative}
                members={members}
                canWrite={canWrite}
                house={house}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
