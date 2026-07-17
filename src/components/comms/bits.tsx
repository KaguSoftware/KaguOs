"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Mail,
  MessageSquare,
  Phone,
  StickyNote,
  Trash2,
  Users,
} from "lucide-react";
import {
  addContactLink,
  createContact,
  deleteContact,
  deleteContactLink,
  deleteInteraction,
  logInteraction,
  setContactStatus,
  updateContact,
} from "@/lib/actions/comms";
import { CreateForm } from "@/components/ui/create";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ConfirmButton } from "@/components/ui/button";
import { EmailInput, UrlInput } from "@/components/ui/typed-inputs";
import { useAction } from "@/lib/use-action";
import { formatDate } from "@/lib/utils";
import type {
  Contact,
  ContactInteraction,
  ContactKind,
  ContactLink,
  ContactStatus,
  InteractionKind,
  MembersMap,
} from "@/lib/types";

const INTERACTION_META: Record<
  InteractionKind,
  { label: string; icon: typeof Phone }
> = {
  call: { label: "Call", icon: Phone },
  email: { label: "Email", icon: Mail },
  meeting: { label: "Meeting", icon: Users },
  message: { label: "Message", icon: MessageSquare },
  note: { label: "Note", icon: StickyNote },
};

const INTERACTION_OPTIONS = (
  Object.keys(INTERACTION_META) as InteractionKind[]
).map((k) => ({ value: k, label: INTERACTION_META[k].label }));

export const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  new: "New",
  contacted: "Contacted",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
  active: "Active",
  dormant: "Dormant",
};

export const CONTACT_STATUS_TONE: Record<ContactStatus, BadgeTone> = {
  new: "neutral",
  contacted: "info",
  negotiating: "amber",
  won: "green",
  lost: "danger",
  active: "green",
  dormant: "faint",
};

const LEAD_STATUSES: ContactStatus[] = [
  "new", "contacted", "negotiating", "won", "lost",
];
const CLIENT_STATUSES: ContactStatus[] = ["active", "dormant", "lost"];

function statusOptions(kind: ContactKind) {
  const list = kind === "client" ? CLIENT_STATUSES : LEAD_STATUSES;
  return list.map((s) => ({ value: s, label: CONTACT_STATUS_LABEL[s] }));
}

export function ContactStatusPicker({
  contactId,
  kind,
  status,
}: {
  contactId: string;
  kind: ContactKind;
  status: ContactStatus;
}) {
  const { pending, run } = useAction();
  const [value, setValue] = useState<ContactStatus>(status);

  return (
    <Dropdown
      className="w-40"
      value={value}
      options={statusOptions(kind)}
      disabled={pending}
      onChange={(next) => {
        const was = value;
        run(() => setContactStatus(contactId, next as ContactStatus), {
          optimistic: () => setValue(next as ContactStatus),
          rollback: () => setValue(was),
        });
      }}
    />
  );
}

export function NewContactForm({
  members,
}: {
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <CreateForm
      action={createContact}
      fieldLabels={{ name: "Name", company: "Company", email: "Email" }}
      submitLabel="Create contact"
      onCancel={() => router.back()}
    >
      <Field label="Name" htmlFor="c-name">
        <Input id="c-name" name="name" maxLength={160} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" htmlFor="c-company">
          <Input id="c-company" name="company" maxLength={160} />
        </Field>
        <Field label="Type" htmlFor="c-kind">
          <Dropdown
            id="c-kind"
            name="kind"
            defaultValue="lead"
            options={[
              { value: "lead", label: "Lead" },
              { value: "client", label: "Client" },
            ]}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="c-email">
          <EmailInput id="c-email" name="email" />
        </Field>
        <Field label="Phone" htmlFor="c-phone">
          <Input id="c-phone" name="phone" maxLength={40} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="c-status">
          <Dropdown
            id="c-status"
            name="status"
            defaultValue="new"
            options={statusOptions("lead")}
          />
        </Field>
        <Field label="Owner" htmlFor="c-owner" hint="Who's handling this.">
          <Dropdown
            id="c-owner"
            name="owner_id"
            defaultValue=""
            options={[
              { value: "", label: "Unassigned" },
              ...members.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
        </Field>
      </div>
      <Field label="Notes" htmlFor="c-notes">
        <Textarea id="c-notes" name="notes" rows={4} />
      </Field>
    </CreateForm>
  );
}

export function EditContactPanel({ contact }: { contact: Contact }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState({
    name: contact.name,
    company: contact.company ?? "",
    kind: contact.kind,
    status: contact.status,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    notes: contact.notes ?? "",
  });

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1 text-sm">
          {contact.email && (
            <p className="text-muted">
              <span className="text-faint">Email · </span>
              {contact.email}
            </p>
          )}
          {contact.phone && (
            <p className="text-muted">
              <span className="text-faint">Phone · </span>
              {contact.phone}
            </p>
          )}
          {contact.notes && (
            <p className="max-w-[70ch] whitespace-pre-wrap pt-1 text-muted">
              {contact.notes}
            </p>
          )}
          {!contact.email && !contact.phone && !contact.notes && (
            <p className="text-faint">No details yet.</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={160} />
        </Field>
        <Field label="Company">
          <Input value={d.company} onChange={(e) => setD({ ...d, company: e.target.value })} maxLength={160} />
        </Field>
        <Field label="Email">
          <Input value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} maxLength={40} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} rows={4} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => updateContact(contact.id, d), {
              success: "Contact updated.",
              onSuccess: () => {
                setEditing(false);
                router.refresh();
              },
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export function ContactLinks({
  contactId,
  links,
}: {
  contactId: string;
  links: ContactLink[];
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [adding, setAdding] = useState(false);

  return (
    <div className="p-4">
      {links.length === 0 && !adding ? (
        <p className="py-2 text-[13px] text-faint">
          No linked resources yet — deals, docs, drives, threads.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                {l.url ? (
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-ink underline-offset-2 hover:text-primary-dim hover:underline"
                  >
                    {l.label}
                    <ExternalLink className="size-3 text-faint" aria-hidden />
                  </a>
                ) : (
                  <p className="text-sm font-medium text-ink">{l.label}</p>
                )}
                {l.note && <p className="mt-0.5 text-xs text-faint">{l.note}</p>}
              </div>
              <ConfirmButton
                size="sm"
                confirmLabel="Delete?"
                disabled={pending}
                onConfirm={() =>
                  run(() => deleteContactLink(l.id, contactId), {
                    success: "Link deleted.",
                    onSuccess: () => router.refresh(),
                  })
                }
              >
                <Trash2 className="size-3.5" aria-hidden />
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form
          className="mt-3 space-y-2 rounded-md border border-line bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => addContactLink(contactId, fd), {
              success: "Link added.",
              onSuccess: () => {
                setAdding(false);
                router.refresh();
              },
            });
          }}
        >
          <Input name="label" placeholder="Label (e.g. Proposal, Drive folder)" maxLength={160} autoFocus />
          <UrlInput name="url" placeholder="URL (optional)" />
          <Input name="note" placeholder="Note (optional)" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              Add
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAdding(true)}>
          Add link
        </Button>
      )}
    </div>
  );
}

export function ContactInteractions({
  contactId,
  interactions,
  members,
  meId,
  isAdmin,
}: {
  contactId: string;
  interactions: ContactInteraction[];
  members: MembersMap;
  meId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [adding, setAdding] = useState(false);

  return (
    <div className="p-4">
      {interactions.length === 0 && !adding ? (
        <p className="py-2 text-[13px] text-faint">
          No interactions logged yet — record the first call, email, or meeting.
        </p>
      ) : (
        <ol className="space-y-3">
          {interactions.map((it) => {
            const meta = INTERACTION_META[it.kind];
            const Icon = meta.icon;
            const who = it.created_by ? members[it.created_by] : null;
            const canDelete = isAdmin || it.created_by === meId;
            return (
              <li key={it.id} className="flex gap-3">
                <span
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-faint"
                  aria-hidden
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-faint">
                      <span className="font-medium text-muted">{meta.label}</span>
                      {" · "}
                      {formatDate(it.happened_on)}
                      {who && (
                        <>
                          {" · "}
                          <span style={{ color: who.color }}>{who.name}</span>
                        </>
                      )}
                    </p>
                    {canDelete && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() => deleteInteraction(it.id, contactId), {
                            success: "Interaction removed.",
                            onSuccess: () => router.refresh(),
                          })
                        }
                        title="Delete"
                        aria-label="Delete interaction"
                        className="text-faint transition-colors duration-150 hover:text-danger disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 max-w-[70ch] whitespace-pre-wrap text-sm text-ink">
                    {it.summary}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {adding ? (
        <form
          className="mt-3 space-y-2 rounded-md border border-line bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => logInteraction(contactId, fd), {
              success: "Interaction logged.",
              onSuccess: () => {
                setAdding(false);
                router.refresh();
              },
            });
          }}
        >
          <div className="flex flex-wrap gap-2">
            <Dropdown
              name="kind"
              defaultValue="call"
              options={INTERACTION_OPTIONS}
              className="w-36"
            />
            <DatePicker name="happened_on" placeholder="Today" className="w-40" />
          </div>
          <Textarea
            name="summary"
            rows={3}
            placeholder="What happened? (agreed scope, sent quote, left voicemail…)"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              Log it
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => setAdding(true)}
        >
          Log an interaction
        </Button>
      )}
    </div>
  );
}

export function DeleteContactButton({ contactId }: { contactId: string }) {
  const { pending, run } = useAction();
  return (
    <ConfirmButton
      size="sm"
      confirmLabel="Really delete this contact?"
      disabled={pending}
      onConfirm={() => run(() => deleteContact(contactId))}
    >
      <Trash2 className="size-3.5" aria-hidden />
      Delete contact
    </ConfirmButton>
  );
}
