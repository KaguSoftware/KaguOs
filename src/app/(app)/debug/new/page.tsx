import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewTaskForm } from "@/components/debug/new-task-form";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage() {
  const ctx = await requireSection("debug");
  const { data: projects } = await ctx.supabase
    .from("projects")
    .select("id, name")
    .order("name");

  return (
    <CreatePage
      title="New debug task"
      hint="Posted unassigned — whoever wants it claims it from the board."
    >
      <NewTaskForm projects={projects ?? []} />
    </CreatePage>
  );
}
