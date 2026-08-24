import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { NameForm, PasswordForm } from "@/components/account/account-forms";

export const metadata: Metadata = { title: "Your account" };

/**
 * The client's account page — deliberately two forms and nothing else.
 *
 * The teammate version at /account also carries an identity colour, a text-size
 * preference, chat alert settings and the roster of everyone else's colours.
 * All four belong to the teammate shell; the last one is a roster, which a
 * client must never see (0062 §5). Rather than gate them one by one on a shared
 * page, the portal gets its own — the same reason the two shells are separate
 * route groups at all.
 *
 * Both forms are the teammate components, unchanged: `updateName` and
 * `updatePassword` act on the caller's OWN row and pass through no section
 * gate, so they are correct for either principal without a special case.
 */
export default async function PortalAccountPage() {
  const ctx = await requireClient();

  return (
    <>
      <Link
        href="/portal"
        className="mb-4 inline-flex items-center gap-1.5 text-[calc(13px*var(--text-scale,1))] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back
      </Link>
      <PageHeader title="Your account" description={ctx.profile.email} />
      <div className="grid max-w-2xl gap-6">
        <Panel>
          <PanelHeader title="Your name" />
          <NameForm currentName={ctx.profile.full_name} />
        </Panel>
        <Panel>
          <PanelHeader title="Password" />
          <PasswordForm />
        </Panel>
      </div>
    </>
  );
}
