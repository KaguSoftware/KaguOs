import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewIdeaForm } from "@/components/work/new-idea-form";

export const metadata: Metadata = { title: "New idea" };

export default async function NewIdeaPage() {
  await requireSection("work");

  return (
    <CreatePage
      title="New idea"
      hint="Teammates vote and discuss — the good ones get promoted to projects."
    >
      <NewIdeaForm />
    </CreatePage>
  );
}
