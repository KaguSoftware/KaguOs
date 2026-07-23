import type { Metadata } from "next";
import { canAccess, requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow } from "@/lib/data/query";
import { Brainstorm } from "@/components/debug/brainstorm";

export const metadata: Metadata = { title: "Brainstorm" };

export default async function BrainstormPage() {
  const ctx = await requireSection("debug");

  // Same roster shape as /debug/new: projects for the board picker, and the
  // Work-members-only "suggest for" list for anyone on the work team
  // (Parsa, 2026-07-23 — was admin-only).
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

  const suggestOptions = canAccess(ctx, "work")
    ? workMemberships
        .map((m) => ({ value: m.user_id, label: members[m.user_id]?.name }))
        .filter((o): o is { value: string; label: string } => Boolean(o.label))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  return <Brainstorm projects={projects} suggestOptions={suggestOptions} />;
}
