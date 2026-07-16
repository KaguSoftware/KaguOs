import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewProjectForm } from "@/components/work/new-project-form";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requireSection("work");

  return (
    <CreatePage title="New project" hint="Everything is editable later — start with what you know.">
      <NewProjectForm />
    </CreatePage>
  );
}
