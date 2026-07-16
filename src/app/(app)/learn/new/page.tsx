import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewSprintForm } from "@/components/learn/new-sprint-form";

export const metadata: Metadata = { title: "New sprint" };

export default async function NewSprintPage() {
  await requireAdmin();

  return (
    <CreatePage
      title="New learning sprint"
      hint="You'll land on the sprint page next to pick participants, goals and resources."
    >
      <NewSprintForm />
    </CreatePage>
  );
}
