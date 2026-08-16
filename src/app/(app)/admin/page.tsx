import type { Metadata } from "next";
import Link from "next/link";
import { FileUp } from "lucide-react";
import { requireAdmin, type SectionAccess } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { UserRow, type AdminUser } from "@/components/admin/user-row";
import type { Section } from "@/lib/types";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const ctx = await requireAdmin();

  const [profiles, memberships] = await Promise.all([
    rowsOrThrow(
      // kind = 'member' (0062). This screen hands out sections and the admin
      // flag, neither of which a client account can hold — listing them here
      // would offer an admin controls that the database refuses, and mix
      // outsiders into the company roster. Client accounts are provisioned and
      // revoked from the Marketing section, where their tenant is visible.
      ctx.supabase.from("profiles").select("*").eq("kind", "member").order("created_at"),
      "profiles"
    ),
    rowsOrThrow(
      ctx.supabase.from("section_memberships").select("user_id, section, access"),
      "section_memberships"
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

  const users: AdminUser[] = profiles.map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    is_admin: p.is_admin,
    color: p.color,
    access: accessByUser.get(p.id) ?? {},
    last_seen_at: p.last_seen_at ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Admin"
        description="Create accounts and control who sees which section."
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
          <PanelHeader title={`Team (${users.length})`} />
          <div>
            {users.map((user) => (
              <UserRow key={user.id} user={user} isSelf={user.id === ctx.userId} />
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Add someone" />
          <CreateUserForm />
        </Panel>
      </div>
    </>
  );
}
