import type { Metadata } from "next";
import { getSessionContext } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { NameForm, PasswordForm } from "@/components/account/account-forms";
import { Badge } from "@/components/ui/badge";
import { SECTION_LABELS, type Section } from "@/lib/types";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const ctx = await getSessionContext();

  return (
    <>
      <PageHeader title="Account" description={ctx.profile.email} />
      <div className="grid max-w-2xl gap-6">
        <Panel>
          <PanelHeader title="Profile" />
          <NameForm currentName={ctx.profile.full_name} />
        </Panel>
        <Panel>
          <PanelHeader title="Password" />
          <PasswordForm />
        </Panel>
        <Panel>
          <PanelHeader title="Your sections" />
          <div className="flex flex-wrap gap-1.5 p-4">
            {ctx.isAdmin && <Badge tone="green">admin</Badge>}
            {[...ctx.sections].map((s) => (
              <Badge key={s}>{SECTION_LABELS[s as Section]}</Badge>
            ))}
            {ctx.sections.size === 0 && !ctx.isAdmin && (
              <p className="text-[13px] text-faint">
                No sections yet — an admin can add you.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
