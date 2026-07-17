import type { Metadata } from "next";
import Link from "next/link";
import { FileUp } from "lucide-react";
import { requireAdmin } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { UserRow, type AdminUser } from "@/components/admin/user-row";
import type { Section } from "@/lib/types";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const ctx = await requireAdmin();

  const [{ data: profiles }, { data: memberships }] = await Promise.all([
    ctx.supabase.from("profiles").select("*").order("created_at"),
    ctx.supabase.from("section_memberships").select("user_id, section"),
  ]);

  const sectionsByUser = new Map<string, Section[]>();
  for (const m of memberships ?? []) {
    const list = sectionsByUser.get(m.user_id) ?? [];
    list.push(m.section as Section);
    sectionsByUser.set(m.user_id, list);
  }

  const users: AdminUser[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    is_admin: p.is_admin,
    color: p.color,
    sections: sectionsByUser.get(p.id) ?? [],
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
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-[13px] text-ink transition-colors duration-150 hover:bg-raised"
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
