import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { CreatePage } from "@/components/ui/create";
import { NewTaskForm } from "@/components/debug/new-task-form";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage() {
  const ctx = await requireSection("debug");
  // Admins get the "suggest for" field; suggestions target WORK members only
  // (the people who take on this kind of work), so we fetch that roster too.
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

  // Only admins get the "suggest for" field — a soft nudge, not a claim.
  const memberOptions = ctx.isAdmin
    ? (workMemberships ?? [])
        .map((m) => ({ value: m.user_id, label: members[m.user_id]?.name }))
        .filter((o): o is { value: string; label: string } => Boolean(o.label))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  return (
    <CreatePage
      title="New debug task"
      hint="Posted unassigned — whoever wants it claims it from the board."
    >
      <NewTaskForm projects={projects ?? []} memberOptions={memberOptions} />
    </CreatePage>
  );
}
