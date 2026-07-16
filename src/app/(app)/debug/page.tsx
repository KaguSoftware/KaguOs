import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { DebugBoard } from "@/components/debug/board";
import { LinkButton } from "@/components/ui/link-button";
import type { DebugTask } from "@/lib/types";

export const metadata: Metadata = { title: "Debug" };

export default async function DebugPage() {
  const ctx = await requireSection("debug");

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    ctx.supabase
      .from("debug_tasks")
      .select("*")
      .order("created_at", { ascending: false }),
    ctx.supabase.from("profiles").select("id, full_name, email"),
  ]);

  const names: Record<string, string> = {};
  for (const p of profiles ?? []) names[p.id] = p.full_name || p.email;

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
        names={names}
        meId={ctx.userId}
        isAdmin={ctx.isAdmin}
      />
    </>
  );
}
