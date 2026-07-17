import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import {
  DeleteSprintButton,
  DuplicateSprintButton,
  EditSprintForm,
  GoalsEditor,
  ParticipantsEditor,
  ResourcesEditor,
} from "@/components/learn/sprint-forms";
import type { Sprint, SprintGoal, SprintResource } from "@/lib/types";

export const metadata: Metadata = { title: "Edit sprint" };

export default async function EditSprintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAdmin();

  const [
    { data: sprint },
    { data: resources },
    { data: participants },
    { data: goals },
    { data: learnMembers },
  ] = await Promise.all([
    ctx.supabase.from("sprints").select("*").eq("id", id).maybeSingle(),
    ctx.supabase
      .from("sprint_resources")
      .select("*")
      .eq("sprint_id", id)
      .order("created_at"),
    ctx.supabase.from("sprint_participants").select("user_id").eq("sprint_id", id),
    ctx.supabase
      .from("sprint_goals")
      .select("*")
      .eq("sprint_id", id)
      .order("sort_order")
      .order("created_at"),
    ctx.supabase
      .from("section_memberships")
      .select("user_id, profiles(id, full_name, email)")
      .eq("section", "learn"),
  ]);
  if (!sprint) notFound();

  const people = (learnMembers ?? [])
    .map((m) => {
      const profile = m.profiles as unknown as {
        id: string;
        full_name: string | null;
        email: string;
      } | null;
      return profile
        ? { id: profile.id, name: profile.full_name || profile.email }
        : null;
    })
    .filter((p): p is { id: string; name: string } => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const participantIds = (participants ?? []).map((p) => p.user_id);

  return (
    <>
      <Link
        href={`/learn/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        View sprint
      </Link>
      <PageHeader title="Edit sprint" description={(sprint as Sprint).title} />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="grid gap-6">
          <Panel>
            <PanelHeader title="Sprint settings" />
            <EditSprintForm sprint={sprint as Sprint} />
          </Panel>
          <Panel>
            <PanelHeader title="Participants" />
            <ParticipantsEditor
              sprintId={id}
              people={people}
              current={participantIds}
            />
          </Panel>
        </div>
        <div className="grid gap-6">
          <Panel>
            <PanelHeader title="Goals" />
            <GoalsEditor sprintId={id} goals={(goals ?? []) as SprintGoal[]} />
          </Panel>
          <Panel>
            <PanelHeader title="Resources" />
            <ResourcesEditor
              sprintId={id}
              resources={(resources ?? []) as SprintResource[]}
            />
          </Panel>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <DuplicateSprintButton sprintId={id} />
        <DeleteSprintButton sprintId={id} />
      </div>
    </>
  );
}
