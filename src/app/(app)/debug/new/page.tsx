import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { CreatePage } from "@/components/ui/create";
import { NewTaskForm } from "@/components/debug/new-task-form";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage() {
  const ctx = await requireSection("debug");
  const [{ data: projects }, members] = await Promise.all([
    ctx.supabase
      .from("projects")
      .select("id, name")
      .eq("is_demo", ctx.showcase)
      .order("name"),
    getMembersMap(ctx.supabase),
  ]);

  // Only admins get the "suggest for" field — a soft nudge, not a claim.
  const memberOptions = ctx.isAdmin
    ? Object.entries(members).map(([id, m]) => ({ value: id, label: m.name }))
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
