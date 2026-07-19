import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { PageHeader } from "@/components/shell/page-header";
import { DebugBoard } from "@/components/debug/board";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { LinkButton } from "@/components/ui/link-button";
import type { DebugFocus, DebugTask } from "@/lib/types";

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

  const [
    { data: tasks },
    { data: projects },
    members,
    { data: workMemberships },
    focusRes,
  ] = await Promise.all([
    taskQuery,
    ctx.supabase
      .from("projects")
      .select("id, name")
      .eq("is_demo", ctx.showcase)
      .order("name"),
    getMembersMap(ctx.supabase),
    // Admins can (re)set the "suggest for" nudge from the inline edit too —
    // same Work-members-only roster as the create page.
    ctx.isAdmin
      ? ctx.supabase
          .from("section_memberships")
          .select("user_id")
          .eq("section", "work")
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    // Showcase mode never surfaces the real board's focus — same rule the
    // dashboard announcement follows. SEVERAL items can be active at once
    // (one per board), hand-ranked; the banner renders them in that order.
    ctx.showcase
      ? null
      : ctx.supabase
          .from("debug_focus")
          .select("*")
          .eq("active", true)
          .order("rank", { ascending: true })
          .order("created_at", { ascending: true }),
  ]);

  const focusItems = (focusRes?.data ?? []) as DebugFocus[];

  const suggestOptions = ctx.isAdmin
    ? (workMemberships ?? [])
        .map((m) => ({ value: m.user_id, label: members[m.user_id]?.name }))
        .filter((o): o is { value: string; label: string } => Boolean(o.label))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  return (
    <>
      {/* Tasks stream through the board's own channel; this is just the focus
          banner, which is server-rendered and so needs a re-pull. */}
      <LiveRefresh tables={["debug_focus"]} />
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
        suggestOptions={suggestOptions}
        focusItems={focusItems}
      />
    </>
  );
}
