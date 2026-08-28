"use client";

import { useId, useState } from "react";
import { Mail, Send } from "lucide-react";
import { sendClientEmail } from "@/lib/actions/client-email";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import {
  CLIENT_EMAIL_KINDS,
  type ClientEmailKind,
} from "@/lib/email/kinds";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import { useAction } from "@/lib/use-action";

/**
 * The send box, on the two team-side pages that publish to a customer.
 *
 * ── Why it is a panel and not a button ─────────────────────────────────────
 *
 * A bare "Email the client" button is a thing you press by accident, and what
 * it does is unrecallable. Making it a panel forces the four facts a sender
 * needs into view before the press: WHICH of the three emails this is, WHO it
 * goes to by name, WHICH LANGUAGE it will be written in, and what — if anything
 * — it will say in our own words. The two-step confirm used elsewhere for
 * deletes would only add a click; the risk here isn't the second press, it's
 * not knowing what the first one sends.
 *
 * ── The kind dial ──────────────────────────────────────────────────────────
 *
 * It used to be fixed by the page: the input-pack page could only nudge about
 * the pack, the client-view page could only announce progress, and the payment
 * reminder did not exist because there was no page obviously "about" money to
 * hang it off. That mapping was an accident of where the panel happened to sit,
 * and it cost a producer a navigation every time the thing worth saying wasn't
 * the thing the page they were on could say.
 *
 * So the page now sets the DEFAULT and the sender sets the kind. Three visible
 * options rather than a dropdown, for the reason `Segmented` was extracted: the
 * alternatives are the information — a producer who did not know a payment
 * reminder existed finds out by looking at the box, not by opening a menu.
 *
 * The blurb, the placeholder and the button label all follow the dial, because
 * a control that changed nothing visible except a hidden argument would be a
 * control nobody trusted.
 *
 * ── The language toggle ────────────────────────────────────────────────────
 *
 * Set by the sender, defaulting to English for the same reason a client account
 * defaults to it (lib/locale.ts): the person who set the account up has to be
 * able to read the first thing it produces. It is NOT the client's `kagu-locale`
 * cookie — that is a fact about a browser, and a client who last opened the
 * portal on a colleague's laptop would be mailed in that colleague's language.
 *
 * ── Why the note is optional and free text ─────────────────────────────────
 *
 * The numbers write themselves; the sentence explaining why this arrived today
 * cannot. Left blank the email is still complete — a headline, a meter and a
 * link — so the box never becomes a form somebody has to fill in to send a
 * routine update.
 */

const KINDS: Record<
  ClientEmailKind,
  { tab: string; title: string; blurb: string; button: string; placeholder: string }
> = {
  inputs: {
    tab: "Input pack",
    title: "Remind them about the input pack",
    blurb: "A nudge with what's still open in the pack, and a link to it.",
    button: "Send reminder",
    placeholder:
      "Optional. Something like: we're starting on the menu next week, so the offerings table is the one to get in first.",
  },
  progress: {
    tab: "Progress",
    title: "Tell them where the build is",
    blurb: "The headline percentage, what's next, and a link to the full plan.",
    button: "Send update",
    placeholder:
      "Optional. Something like: the design phase wrapped this week — the next thing you'll see from us is the staging link.",
  },
  finance: {
    tab: "Payment",
    title: "Remind them about a payment",
    blurb:
      "What's outstanding, which invoices are still open, the next scheduled payment, and a link to the statement.",
    button: "Send payment reminder",
    placeholder:
      "Optional. Something like: no rush on this one — we're sending it now so it lands before your month-end run.",
  },
};

export function SendClientEmail({
  projectId,
  defaultKind,
  people,
}: {
  projectId: string;
  /**
   * Which of the three the dial opens on — the one the page it sits on is
   * about. A default, not a lock: all three are always sendable from here.
   */
  defaultKind: ClientEmailKind;
  /** The client accounts on this project, by name — rendered so the sender sees them. */
  people: string[];
}) {
  const { pending, run, toast } = useAction();
  const [kind, setKind] = useState<ClientEmailKind>(defaultKind);
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [note, setNote] = useState("");
  const noteId = useId();
  const config = KINDS[kind];

  // Nobody to write to. Said here rather than by hiding the panel: a producer
  // wondering why they cannot email a client is better served by the reason
  // than by an absence they have to go and ask about.
  if (people.length === 0) {
    return (
      <Panel>
        <PanelHeader title="Email the client" />
        <p className="px-4 py-4 text-[calc(13px*var(--text-scale,1))] text-faint">
          Nobody has a client account on this project yet. Give someone one in
          Admin and share this project with them, and this becomes a send box.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader
        title="Email the client"
        action={
          <Segmented
            label="Language of the email"
            size="sm"
            options={LOCALES.map((option) => ({
              key: option.key,
              label: option.short,
              title: option.label,
            }))}
            value={locale}
            onChange={setLocale}
            disabled={pending}
          />
        }
      />

      <div className="space-y-4 p-4">
        {/* Not a `Field`: that renders a `<label htmlFor>`, and the control
            below is a group of buttons rather than one focusable input — a
            label pointing at nothing is worse for a screen reader than no
            label, which is why `Segmented` names itself with `aria-label`. */}
        <div className="space-y-1.5">
          <p className="text-[calc(13px*var(--text-scale,1))] font-medium text-muted">
            What to send
          </p>
          <Segmented
            label="What to send"
            className="max-w-full"
            options={CLIENT_EMAIL_KINDS.map((key) => ({
              key,
              label: KINDS[key].tab,
              title: KINDS[key].title,
            }))}
            value={kind}
            onChange={setKind}
            disabled={pending}
          />
        </div>

        <p className="flex items-start gap-1.5 text-[calc(13px*var(--text-scale,1))] text-faint">
          <Mail className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {config.blurb} Goes to {people.join(", ")}.
          </span>
        </p>

        <Field label="Add a note" htmlFor={noteId} hint="Optional — it appears above the link, in your words.">
          <Textarea
            id={noteId}
            value={note}
            maxLength={1000}
            disabled={pending}
            placeholder={config.placeholder}
            onChange={(event) => setNote(event.target.value)}
            // The note reaches an Arabic reader inside an RTL email, so the box
            // it is typed in follows the language the email will be sent in
            // rather than the app's own direction.
            dir={locale === "ar" ? "rtl" : "ltr"}
          />
        </Field>

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(
                async () => {
                  const result = await sendClientEmail(projectId, kind, locale, note);
                  // Toasted here rather than through `run`'s `success` option,
                  // which takes a fixed string. The sentence worth reading is
                  // the one the action wrote — "Sent to 2 people", or "Sent to
                  // 2, but 1 failed: …" — and this component cannot know it.
                  if (result?.ok) toast.success(result.message);
                  return result;
                },
                { onSuccess: () => setNote("") }
              )
            }
          >
            <Send className="size-3.5" aria-hidden />
            {pending ? "Sending…" : config.button}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
