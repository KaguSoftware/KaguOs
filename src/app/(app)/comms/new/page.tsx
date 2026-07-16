import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewContactForm } from "@/components/comms/bits";

export const metadata: Metadata = { title: "New contact" };

export default async function NewContactPage() {
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
      title="New contact"
      hint="A lead or a client. You can add links and notes once it's created."
    >
      <NewContactForm members={members} />
    </CreatePage>
  );
}
