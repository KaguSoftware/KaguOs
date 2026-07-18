import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { Brainstorm } from "@/components/debug/brainstorm";

export const metadata: Metadata = { title: "Brainstorm" };

export default async function BrainstormPage() {
  const ctx = await requireSection("debug");

  // Same roster shape as /debug/new: projects for the board picker, and the
  // Work-members-only "suggest for" list when the user is an admin.
  const [{ data: projects }, members, { data: workMemberships }] =
    await Promise.all([
      ctx.supabase
        .from("projects")
        .select("id, name")
        .eq("is_demo", ctx.showcase)
        .order("name"),
      getMembersMap(ctx.supabase),
      ctx.isAdmin
        ? ctx.supabase
            .from("section_memberships")
            .select("user_id")
            .eq("section", "work")
        : Promise.resolve({ data: [] as { user_id: string }[] }),
    ]);

  const suggestOptions = ctx.isAdmin
    ? (workMemberships ?? [])
        .map((m) => ({ value: m.user_id, label: members[m.user_id]?.name }))
        .filter((o): o is { value: string; label: string } => Boolean(o.label))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  return <Brainstorm projects={projects ?? []} suggestOptions={suggestOptions} />;
}
