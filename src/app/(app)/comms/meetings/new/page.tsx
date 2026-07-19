import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { MeetingForm } from "@/components/comms/meeting-form";

export const metadata: Metadata = { title: "Record a meeting" };

export default async function NewMeetingPage() {
  const ctx = await requireSection("comms");
  const { data: profiles } = await ctx.supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name");

  const members = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || p.email,
  }));

  return (
    <CreatePage
      title="Record a meeting"
      hint="What happened, who was there, and what came of it — so nobody has to reconstruct it later."
    >
      <MeetingForm members={members} />
    </CreatePage>
  );
}
