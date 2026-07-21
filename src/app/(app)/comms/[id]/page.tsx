import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import {
  ContactInteractions,
  ContactLinks,
  ContactStatusPicker,
  CONTACT_STATUS_LABEL,
  CONTACT_STATUS_TONE,
  DeleteContactButton,
  EditContactPanel,
} from "@/components/comms/bits";
import type { Contact, ContactInteraction, ContactLink } from "@/lib/types";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("comms");

  const [{ data: contact }, links, interactions, members] = await Promise.all([
      // Gate the contact on the demo/real split — a real contact id is notFound
      // in showcase, so its real links/interactions never render in a demo.
      selectOrThrow(
        ctx.supabase
          .from("contacts")
          .select("*")
          .eq("id", id)
          .eq("is_demo", ctx.showcase)
          .maybeSingle(),
        "contact"
      ),
      rowsOrThrow(
        ctx.supabase
          .from("contact_links")
          .select("*")
          .eq("contact_id", id)
          .eq("is_demo", ctx.showcase)
          .order("created_at", { ascending: true }),
        "contact_links"
      ),
      rowsOrThrow(
        ctx.supabase
          .from("contact_interactions")
          .select("*")
          .eq("contact_id", id)
          .eq("is_demo", ctx.showcase)
          .order("happened_on", { ascending: false })
          .order("created_at", { ascending: false }),
        "contact_interactions"
      ),
      getMembersMap(ctx.supabase),
    ]);
  if (!contact) notFound();

  const c = contact as Contact;
  const owner = c.owner_id ? members[c.owner_id] : null;
  const interactionList = interactions as ContactInteraction[];

  return (
    <>
      <Link
        href="/comms"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All contacts
      </Link>
      <PageHeader
        title={c.name}
        description={c.company ?? (c.kind === "client" ? "Client" : "Lead")}
        action={
          <ContactStatusPicker contactId={c.id} kind={c.kind} status={c.status} />
        }
      />

      <div className="grid max-w-3xl gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={c.kind === "client" ? "green" : "info"}>
            {c.kind === "client" ? "Client" : "Lead"}
          </Badge>
          <Badge tone={CONTACT_STATUS_TONE[c.status]}>
            {CONTACT_STATUS_LABEL[c.status]}
          </Badge>
          {owner && (
            <span className="text-[13px] text-faint">
              owner{" "}
              <span style={{ color: owner.color }}>{owner.name}</span>
            </span>
          )}
        </div>

        <Panel>
          <PanelHeader title="Details" />
          <div className="p-4">
            <EditContactPanel contact={c} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title={`Interactions (${interactionList.length})`} />
          <ContactInteractions
            contactId={c.id}
            interactions={interactionList}
            members={members}
            meId={ctx.userId}
            isAdmin={ctx.isAdmin}
          />
        </Panel>

        <Panel>
          <PanelHeader title={`Linked resources (${links.length})`} />
          <ContactLinks contactId={c.id} links={links as ContactLink[]} />
        </Panel>

        <div>
          <DeleteContactButton contactId={c.id} />
        </div>
      </div>
    </>
  );
}
