"use client";

import { useState } from "react";
import { ExternalLink, Link2, Plus, X } from "lucide-react";
import { createMarketingLink, deleteMarketingLink } from "@/lib/actions/marketing";
import { useAction } from "@/lib/use-action";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { CreateForm, CreateOverlay } from "@/components/ui/create";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UrlInput } from "@/components/ui/typed-inputs";
import type { MarketingLink } from "@/lib/types";

/**
 * The link shelf (0070): the Drive folder, the brand kit, the ideas doc — the
 * URLs the team keeps re-asking each other for. Two homes, one component: the
 * General tab (team shelf, no clientId) and a client workspace (their Drive
 * folder — clientId rides a hidden input on the add form). Adding one goes
 * through a CreateOverlay, per the create-flow house rule.
 */
export function LinksPanel({
  links,
  canWrite,
  clientId,
}: {
  links: MarketingLink[];
  canWrite: boolean;
  clientId?: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <Panel>
      <PanelHeader
        title="Links"
        action={
          canWrite && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" aria-hidden />
              Add link
            </Button>
          )
        }
      />
      {links.length === 0 ? (
        <p className="px-4 py-5 text-[calc(13px*var(--text-scale,1))] text-faint">
          {clientId
            ? "This client's Drive folder, brand kit, report docs — pin them here so nobody asks for them twice."
            : "The team's own Drive folder, templates, the ideas doc — pin them here so nobody asks for them twice."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {links.map((link) => (
            <LinkRow key={link.id} link={link} canWrite={canWrite} />
          ))}
        </ul>
      )}

      <CreateOverlay
        title="Add a link"
        hint="Anything the whole team reaches for — a Drive folder, a shared doc, a dashboard."
        open={adding}
        onClose={() => setAdding(false)}
      >
        <CreateForm
          action={createMarketingLink}
          fieldLabels={{ title: "Name", note: "Note" }}
          submitLabel="Add link"
          onCancel={() => setAdding(false)}
          onDone={() => setAdding(false)}
        >
          {clientId && <input type="hidden" name="client_id" value={clientId} />}
          <Field label="Name" htmlFor="mlink-title">
            <Input id="mlink-title" name="title" maxLength={160} autoFocus />
          </Field>
          <Field label="URL" htmlFor="mlink-url">
            <UrlInput id="mlink-url" name="url" />
          </Field>
          <Field label="Note" htmlFor="mlink-note" hint="What's in there, in a few words.">
            <Input id="mlink-note" name="note" maxLength={500} />
          </Field>
        </CreateForm>
      </CreateOverlay>
    </Panel>
  );
}

function LinkRow({ link, canWrite }: { link: MarketingLink; canWrite: boolean }) {
  const { pending, run } = useAction();
  return (
    <li className="group flex items-center gap-3 px-4 py-2.5">
      <Link2 className="size-3.5 shrink-0 text-faint" aria-hidden />
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-w-0 items-center gap-1.5 text-sm text-ink underline-offset-2 hover:text-primary-dim hover:underline"
      >
        <span className="truncate">{link.title}</span>
        <ExternalLink className="size-3 shrink-0 text-faint" aria-hidden />
      </a>
      {link.note && (
        <span className="hidden min-w-0 truncate text-xs text-faint sm:block">
          {link.note}
        </span>
      )}
      {canWrite && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => deleteMarketingLink(link.id))}
          aria-label={`Remove ${link.title}`}
          className="ml-auto cursor-pointer rounded p-1 text-faint opacity-0 transition-[color,opacity] duration-150 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 disabled:pointer-events-none"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </li>
  );
}
