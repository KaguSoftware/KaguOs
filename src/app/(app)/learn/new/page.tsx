import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { SprintComposer } from "@/components/learn/sprint-composer";

export const metadata: Metadata = { title: "New sprint" };

export default async function NewSprintPage() {
  const ctx = await requireAdmin();

  const learnMembers = await rowsOrThrow(
    ctx.supabase
      .from("section_memberships")
      .select("user_id, profiles(id, full_name, email)")
      .eq("section", "learn"),
    "section_memberships"
  );

  const members = learnMembers
    .map((m) => {
      const profile = m.profiles as unknown as {
        id: string;
        full_name: string | null;
        email: string;
      } | null;
      return profile
        ? { id: profile.id, name: profile.full_name || profile.email }
        : null;
    })
    .filter((p): p is { id: string; name: string } => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <CreatePage
      title="New learning sprint"
      hint="Build the whole sprint here — participants, goals and resources included."
      wide
    >
      <SprintComposer members={members} />
    </CreatePage>
  );
}
