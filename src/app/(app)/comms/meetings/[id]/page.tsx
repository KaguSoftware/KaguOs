import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/data/session";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { MeetingForm } from "@/components/comms/meeting-form";
import type { CommsMeeting } from "@/lib/types";

export const metadata: Metadata = { title: "Edit meeting" };

export default async function EditMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("comms");

  const [{ data: meeting }, profiles] = await Promise.all([
    selectOrThrow(
      ctx.supabase.from("comms_meetings").select("*").eq("id", id).maybeSingle(),
      "comms_meeting"
    ),
    rowsOrThrow(
      ctx.supabase.from("profiles").select("id, full_name, email").order("full_name"),
      "profiles"
    ),
  ]);
  if (!meeting) notFound();

  const members = profiles.map((p) => ({
    id: p.id,
    name: p.full_name || p.email,
  }));

  return (
    <CreatePage title="Edit meeting" hint="Correct the record — everyone in Comms sees it.">
      <MeetingForm members={members} meeting={meeting as CommsMeeting} />
    </CreatePage>
  );
}
