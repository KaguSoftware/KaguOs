import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { PageHeader } from "@/components/shell/page-header";
import { DebugBoard } from "@/components/debug/board";
import { LinkButton } from "@/components/ui/link-button";
import type { DebugTask } from "@/lib/types";

export const metadata: Metadata = { title: "Debug" };

export default async function DebugPage() {
  const ctx = await requireSection("debug");

  // Archived tasks (done 7+ days) only reach admins — they're the ones who see
  // the cleanup section. Everyone else gets live tasks only.
  const taskQuery = ctx.supabase
    .from("debug_tasks")
    .select("*")
    .eq("is_demo", ctx.showcase)
    .order("created_at", { ascending: false });
  if (!ctx.isAdmin) taskQuery.is("archived_at", null);

  const [{ data: tasks }, { data: projects }, members] = await Promise.all([
    taskQuery,
    ctx.supabase
      .from("projects")
      .select("id, name")
      .eq("is_demo", ctx.showcase)
      .order("name"),
    getMembersMap(ctx.supabase),
  ]);

  return (
    <>
      <PageHeader
        title="Kagu Debug"
        description="See what's left, claim what you want."
        action={
          <LinkButton href="/debug/new">
            <Plus className="size-3.5" aria-hidden />
            New task
          </LinkButton>
        }
      />
      <DebugBoard
        initialTasks={(tasks ?? []) as DebugTask[]}
        projects={projects ?? []}
        members={members}
        meId={ctx.userId}
        isAdmin={ctx.isAdmin}
      />
    </>
  );
}
