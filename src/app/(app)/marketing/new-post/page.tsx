import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewPostForm } from "@/components/marketing/bits";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  const ctx = await requireSection("marketing");

  const [{ data: campaigns }, { data: marketingMembers }] = await Promise.all([
    ctx.supabase.from("marketing_campaigns").select("id, name").order("name"),
    ctx.supabase
      .from("section_memberships")
      .select("user_id, profiles(id, full_name, email)")
      .eq("section", "marketing"),
  ]);

  const members = (marketingMembers ?? [])
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
      <NewPostForm campaigns={campaigns ?? []} members={members} />
    </CreatePage>
  );
}
