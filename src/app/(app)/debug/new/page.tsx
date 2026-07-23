import type { Metadata } from "next";
import { canAccess, requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { NewTaskForm } from "@/components/debug/new-task-form";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage() {
  const ctx = await requireSection("debug");
  // The whole WORK team gets the "suggest for" field (Parsa, 2026-07-23 — was
  // admin-only); suggestions target WORK members only (the people who take on
  // this kind of work), so we fetch that roster too.
  const [projects, members, workMemberships] = await Promise.all([
    rowsOrThrow(
      ctx.supabase
        .from("projects")
        .select("id, name")
        .eq("is_demo", ctx.showcase)
        .order("name"),
      "projects"
    ),
    getMembersMap(ctx.supabase),
    canAccess(ctx, "work")
      ? rowsOrThrow(
          ctx.supabase
            .from("section_memberships")
            .select("user_id")
            .eq("section", "work"),
          "section_memberships"
        )
      : Promise.resolve([] as { user_id: string }[]),
  ]);

  // A soft nudge, not a claim — hidden outside the work team.
  const memberOptions = canAccess(ctx, "work")
    ? workMemberships
        .map((m) => ({ value: m.user_id, label: members[m.user_id]?.name }))
        .filter((o): o is { value: string; label: string } => Boolean(o.label))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  return (
    <CreatePage
      title="New debug task"
      hint="Posted unassigned — whoever wants it claims it from the board."
    >
      <NewTaskForm projects={projects} memberOptions={memberOptions} />
    </CreatePage>
  );
}
