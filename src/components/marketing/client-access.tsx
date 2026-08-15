"use client";

import { useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { inviteClientUser, revokeClientUser } from "@/lib/actions/client-users";
import { useAction } from "@/lib/use-action";
import { CreateForm } from "@/components/ui/create";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/typed-inputs";
import { Dropdown } from "@/components/ui/dropdown";
import type { ClientRole } from "@/lib/types";

export type ClientPerson = {
  user_id: string;
  role: ClientRole;
  name: string;
  email: string;
};

/**
 * Who at the client can sign in.
 *
 * This is the most consequential control in the section: it creates a login for
 * someone outside the company. So it says what the account can and cannot do in
 * plain words, right next to the button, rather than assuming whoever clicks it
 * has read the migration.
 */
export function ClientAccess({
  clientId,
  people,
  canWrite,
}: {
  clientId: string;
  people: ClientPerson[];
  canWrite: boolean;
}) {
  const [inviting, setInviting] = useState(false);
  const { pending, run } = useAction();

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          title="Client sign-ins"
          action={
            canWrite &&
            !inviting && (
              <Button size="sm" variant="outline" onClick={() => setInviting(true)}>
                <KeyRound className="size-3.5" aria-hidden />
                Give someone access
              </Button>
            )
          }
        />

        {people.length === 0 && !inviting ? (
          <EmptyState
            icon={KeyRound}
            title="Nobody from this client can sign in yet"
            hint="An approver gets a login that shows two things: cuts waiting on them, and what's gone live. They can't see anything else in KaguOs — not other clients, not the team, not the board."
          />
        ) : (
          <ul className="divide-y divide-line">
            {people.map((person) => (
              <li
                key={person.user_id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{person.name}</p>
                  <p className="text-xs text-faint">{person.email}</p>
                </div>
                <Badge tone={person.role === "approver" ? "green" : "neutral"}>
                  {person.role === "approver" ? "can approve" : "view only"}
                </Badge>
                {canWrite && (
                  <ConfirmButton
                    size="sm"
                    disabled={pending}
                    confirmLabel="Really revoke?"
                    onConfirm={() =>
                      run(() => revokeClientUser(person.user_id, clientId), {
                        success: "Access revoked.",
                      })
                    }
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    <span className="sr-only">Revoke access for {person.name}</span>
                  </ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {inviting && canWrite && (
        <Panel>
          <PanelHeader title="New client sign-in" />
          <div className="px-4 py-4">
            <CreateForm
              action={inviteClientUser}
              fieldLabels={{ full_name: "Name", email: "Email", password: "Temp password" }}
              submitLabel="Create the account"
              onCancel={() => setInviting(false)}
              onDone={() => setInviting(false)}
            >
              <input type="hidden" name="client_id" value={clientId} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="invite-name">
                  <Input id="invite-name" name="full_name" maxLength={80} autoFocus />
                </Field>
                <Field label="Email" htmlFor="invite-email">
                  <EmailInput id="invite-email" name="email" />
                </Field>
              </div>

              <Field
                label="Temp password"
                htmlFor="invite-password"
                hint="At least 8 characters. Send it to them yourself — we don't email it."
              >
                <Input
                  id="invite-password"
                  name="password"
                  type="text"
                  autoComplete="off"
                  minLength={8}
                />
              </Field>

              <Field
                label="What they can do"
                htmlFor="invite-role"
                hint="Either way they only ever see this client's videos."
              >
                <Dropdown
                  id="invite-role"
                  name="role"
                  defaultValue="approver"
                  options={[
                    {
                      value: "approver",
                      label: "Approve cuts",
                      hint: "Can sign off or ask for changes.",
                    },
                    {
                      value: "viewer",
                      label: "View only",
                      hint: "Can follow along, decides nothing.",
                    },
                  ]}
                />
              </Field>
            </CreateForm>
          </div>
        </Panel>
      )}
    </div>
  );
}
