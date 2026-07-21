import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { NewPostForm } from "@/components/marketing/bits";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  const ctx = await requireSection("marketing");

  const [campaigns, marketingMembers] = await Promise.all([
    rowsOrThrow(
      ctx.supabase.from("marketing_campaigns").select("id, name").eq("is_demo", ctx.showcase).order("name"),
      "marketing_campaigns"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("section_memberships")
        .select("user_id, profiles(id, full_name, email)")
        .eq("section", "marketing"),
      "section_memberships"
    ),
  ]);

  const members = marketingMembers
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
    .filter((p): p is { id: string; name: string } => p !== null);

  return (
    <CreatePage title="New content post" hint="One piece of content on the calendar.">
      <NewPostForm campaigns={campaigns} members={members} />
    </CreatePage>
  );
}
