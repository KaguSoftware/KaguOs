import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewTaskForm } from "@/components/debug/new-task-form";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage() {
  await requireSection("debug");

  return (
    <CreatePage
      title="New debug task"
      hint="Posted unassigned — whoever wants it claims it from the board."
    >
      <NewTaskForm />
    </CreatePage>
  );
}
