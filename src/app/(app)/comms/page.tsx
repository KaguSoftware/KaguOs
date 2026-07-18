import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { PageHeader } from "@/components/shell/page-header";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { Badge } from "@/components/ui/badge";
import { CONTACT_STATUS_TONE, CONTACT_STATUS_LABEL } from "@/components/comms/bits";
import { formatDate } from "@/lib/utils";
import type { Contact } from "@/lib/types";

export const metadata: Metadata = { title: "Comms" };

export default async function CommsPage() {
  const ctx = await requireSection("comms");

  const [{ data: contacts }, { data: interactions }, members] =
    await Promise.all([
      ctx.supabase
        .from("contacts")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("updated_at", { ascending: false }),
      // Every interaction, newest-first — reduced below to the latest per contact.
      // One extra query in the existing wave (~3ms), not a per-row round-trip.
      ctx.supabase
        .from("contact_interactions")
        .select("contact_id, happened_on, summary")
        .eq("is_demo", ctx.showcase)
        .order("happened_on", { ascending: false })
        .order("created_at", { ascending: false }),
      getMembersMap(ctx.supabase),
    ]);

  const rows = (contacts ?? []) as Contact[];
  // First seen wins because the query is already sorted newest-first.
  const lastByContact = new Map<string, { happened_on: string; summary: string }>();
  for (const it of interactions ?? []) {
    if (!lastByContact.has(it.contact_id)) {
      lastByContact.set(it.contact_id, {
        happened_on: it.happened_on,
        summary: it.summary,
      });
    }
  }

  const leads = rows.filter((c) => c.kind === "lead");
  const clients = rows.filter((c) => c.kind === "client");

  return (
    <>
      <LiveRefresh tables={["contacts", "contact_interactions"]} />
      <PageHeader
        title="Kagu Comms"
        description="Leads, clients, and everything tied to them."
        action={
          <LinkButton href="/comms/new">
            <Plus className="size-3.5" aria-hidden />
            New contact
          </LinkButton>
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={Users}
            title="No contacts yet"
            hint="Track every lead and client here — status, owner, and links to everything about them."
            action={
              <LinkButton href="/comms/new">
                <Plus className="size-3.5" aria-hidden />
                New contact
              </LinkButton>
            }
          />
        </div>
      ) : (
        <div className="grid gap-6">
          <ContactGroup
            title="Leads"
            contacts={leads}
            members={members}
            lastByContact={lastByContact}
          />
          <ContactGroup
            title="Clients"
            contacts={clients}
            members={members}
            lastByContact={lastByContact}
          />
        </div>
      )}
    </>
  );
}

function ContactGroup({
  title,
  contacts,
  members,
  lastByContact,
}: {
  title: string;
  contacts: Contact[];
  members: Record<string, { name: string; color: string }>;
  lastByContact: Map<string, { happened_on: string; summary: string }>;
}) {
  if (contacts.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
        {title} ({contacts.length})
      </h2>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <ul className="divide-y divide-line">
          {contacts.map((c) => {
            const owner = c.owner_id ? members[c.owner_id] : null;
            const last = lastByContact.get(c.id);
            return (
              <li key={c.id}>
                <Link
                  href={`/comms/${c.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-150 hover:bg-raised/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {c.name}
                      {c.company && (
                        <span className="ml-1.5 font-normal text-faint">· {c.company}</span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-faint">
                      {c.email || c.phone || "No contact details"}
                      {owner && (
                        <>
                          {" · "}
                          <span style={{ color: owner.color }}>{owner.name}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex min-w-0 max-w-[16rem] flex-col items-end text-right">
                    {last ? (
                      <>
                        <span className="text-xs text-muted">
                          {formatDate(last.happened_on)}
                        </span>
                        <span className="truncate text-xs text-faint">
                          {last.summary}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-faint">No contact yet</span>
                    )}
                  </div>
                  <Badge tone={CONTACT_STATUS_TONE[c.status]}>
                    {CONTACT_STATUS_LABEL[c.status]}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
