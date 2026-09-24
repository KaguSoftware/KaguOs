"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { MeetingList, NoteList } from "@/components/comms/internal";
import { TabStrip } from "@/components/ui/tab-strip";
import type { CommsMeeting, CommsNote, MembersMap } from "@/lib/types";

type Tab = "external" | "meetings" | "notes";

const TABS: { key: Tab; label: string }[] = [
  { key: "external", label: "External" },
  { key: "meetings", label: "Meetings" },
  { key: "notes", label: "Notes" },
];

/**
 * Comms, split the way Kemal asked for (2026-07-19): outward-facing work and
 * inward-facing record-keeping are different jobs that happened to share a name.
 *
 * The split is WITHIN the section, not a seventh sidebar entry — "who we talk
 * to" and "what we said to each other" belong under one heading, and adding a
 * nav item for each would make the sidebar (and the mobile tile grid) longer
 * without making anything easier to find.
 *
 * Contacts stay server-rendered and arrive as `external`; only the internal
 * halves are client components, because only they mutate in place.
 */
export function CommsWorkspace({
  external,
  meetings,
  notes,
  members,
  meId,
}: {
  external: React.ReactNode;
  meetings: CommsMeeting[];
  notes: CommsNote[];
  members: MembersMap;
  meId: string;
}) {
  const [active, setActive] = useState<Tab>("external");

  const action =
    active === "meetings"
      ? { href: "/comms/meetings/new", label: "Record a meeting" }
      : active === "external"
        ? { href: "/comms/new", label: "New contact" }
        : null; // Notes add inline — a create page for one line would be absurd.

  return (
    <>
      <PageHeader
        title="Kagu Comms"
        description="Who we talk to outside, and what we said to each other inside."
        action={
          action ? (
            <LinkButton href={action.href}>
              <Plus className="size-3.5" aria-hidden />
              {action.label}
            </LinkButton>
          ) : undefined
        }
      />

      <TabStrip
        tabs={TABS}
        active={active}
        onSelect={setActive}
        ariaLabel="Comms subsections"
      />

      <div key={active} className="motion-safe:animate-page-in">
        {active === "external" && external}
        {active === "meetings" && (
          <MeetingList meetings={meetings} members={members} />
        )}
        {active === "notes" && (
          <NoteList notes={notes} members={members} meId={meId} />
        )}
      </div>
    </>
  );
}
