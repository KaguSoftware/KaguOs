import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/data/session";
import { CreatePage } from "@/components/ui/create";
import { NewIdeaForm } from "@/components/work/new-idea-form";

export const metadata: Metadata = { title: "New idea" };

export default async function NewProjectIdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("work");

  // Resolve the project so the page can name it — and so an idea can't be filed
  // against a project that doesn't exist (or isn't visible in showcase).
  const { data: project } = await ctx.supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .eq("is_demo", ctx.showcase)
    .maybeSingle();
  if (!project) notFound();

  return (
    <CreatePage
      title="New idea"
      hint={`A suggestion for ${project.name}. Teammates vote and discuss it.`}
    >
      <NewIdeaForm project={{ id: project.id, name: project.name }} />
    </CreatePage>
  );
}
