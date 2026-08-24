import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FileUp } from "lucide-react";
import { requireAdmin, type SectionAccess } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateUserForm } from "@/components/admin/create-user-form";
import {
  UserRow,
  type AdminProject,
  type AdminUser,
} from "@/components/admin/user-row";
import type { ProfileKind, Section } from "@/lib/types";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const ctx = await requireAdmin();

  const [profiles, memberships, projects, assignments] = await Promise.all([
    rowsOrThrow(
      // BOTH kinds (0072). This screen is where an account's role is decided,
      // so it is the one list in the app that must show clients alongside
      // colleagues — everywhere else, `kind = 'member'` still holds and
      // check:principals still enforces it. The explicit `.in()` is what keeps
      // this read scoped rather than open: a third kind added tomorrow does not
      // silently appear in the team panel.
      ctx.supabase
        .from("profiles")
        .select("*")
        .in("kind", ["member", "client"])
        .order("created_at"),
      "profiles"
    ),
    rowsOrThrow(
      ctx.supabase.from("section_memberships").select("user_id, section, access"),
      "section_memberships"
    ),
    // What a client account can be pointed at. Real projects only — a demo row
    // would be an assignment to a project that does not exist outside showcase,
    // and `my_client_projects()` filters them out anyway (0072 §2), so offering
    // one here would produce a silently empty portal.
    rowsOrThrow(
      ctx.supabase
        .from("projects")
        .select("id, name, client, status")
        .eq("is_demo", false)
        .order("name"),
      "projects"
    ),
    rowsOrThrow(
      ctx.supabase.from("client_projects").select("user_id, project_id"),
      "client_projects"
    ),
  ]);

  // One entry per user: section -> tier. Absent key means no access at all, so
  // the row needs no separate "sections" list.
  const accessByUser = new Map<string, Partial<Record<Section, SectionAccess>>>();
  for (const m of memberships) {
    const map = accessByUser.get(m.user_id) ?? {};
    map[m.section as Section] = (m.access as SectionAccess) ?? "write";
    accessByUser.set(m.user_id, map);
  }

  const projectsByUser = new Map<string, string[]>();
  for (const a of assignments) {
    const list = projectsByUser.get(a.user_id) ?? [];
    list.push(a.project_id);
    projectsByUser.set(a.user_id, list);
  }

  const allProjects: AdminProject[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    client: p.client ?? null,
    status: p.status,
  }));

  const users: AdminUser[] = profiles.map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    kind: (p.kind ?? "member") as ProfileKind,
    is_admin: p.is_admin,
    color: p.color,
    access: accessByUser.get(p.id) ?? {},
    projectIds: projectsByUser.get(p.id) ?? [],
    last_seen_at: p.last_seen_at ?? null,
  }));

  const team = users.filter((u) => u.kind === "member");
  const clients = users.filter((u) => u.kind === "client");

  return (
    <>
      <PageHeader
        title="Admin"
        description="Create accounts, decide who is staff and who is a client, and control what each of them sees."
        action={
          <Link
            href="/admin/import-debug"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-[calc(13px*var(--text-scale,1))] text-ink transition-colors duration-150 hover:bg-raised"
          >
            <FileUp className="size-3.5" aria-hidden />
            Import debug sheet
          </Link>
        }
      />

      <div className="grid gap-6">
        <Panel>
          <PanelHeader title={`Team (${team.length})`} />
          <div>
            {team.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === ctx.userId}
                projects={allProjects}
              />
            ))}
          </div>
        </Panel>

        {/* Kept as its own panel rather than a filter on the list above. The
            two lists answer different questions — "who works here" and "who are
            we building for" — and a client mixed into the roster is exactly the
            confusion 0062 spent a whole migration preventing. */}
        <Panel>
          <PanelHeader title={`Clients (${clients.length})`} />
          {clients.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No client accounts"
              hint="A client is an outsider with a login: they see the projects you share with them, fill in their own input pack, and nothing else. Switch someone's role above, or create one below."
            />
          ) : (
            <div>
              {clients.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === ctx.userId}
                  projects={allProjects}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Add someone" />
          <CreateUserForm projects={allProjects} />
        </Panel>
      </div>
    </>
  );
}
