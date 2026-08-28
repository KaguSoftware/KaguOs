"use server";

import { selectOrThrow } from "@/lib/data/query";
import type { SessionContext } from "@/lib/data/session";
import { guard, text } from "@/lib/actions/portal-write";
import type { ActionResult } from "@/lib/actions/account";
import { parseLocale } from "@/lib/locale";
import { buildClientEmail, type MailableProject } from "@/lib/email/client-mail";
import { CLIENT_EMAIL_TAGS, parseClientEmailKind } from "@/lib/email/kinds";
import { clientRecipients } from "@/lib/email/recipients";
import { sendEmails } from "@/lib/email/send";

/**
 * The three emails KaguOs sends to a customer, all fired by hand from the
 * project's own pages.
 *
 * ── Why by hand, and not from a trigger on the row ─────────────────────────
 *
 * Because the obvious triggers are all wrong. "Email on every milestone update"
 * fires while a producer is mid-edit and mails a client four times in a minute
 * about a plan that was being rearranged, not progressed. "Email when the pack
 * goes stale" needs a definition of stale that nobody has, and a client who is
 * deliberately waiting on their accountant gets nagged weekly for it. "Email
 * when a payment falls due" would dun a customer for an invoice we had not got
 * round to raising. The person who knows the message is worth sending is the
 * person who made the change, and they are already looking at the page it
 * happened on.
 *
 * What the button removes is the retyping, not the judgement: the numbers, the
 * link and the language come from the same data the page is rendering.
 *
 * ── One action, a kind on the wire ─────────────────────────────────────────
 *
 * It was two exported actions, one per email, back when the page decided which
 * one you got. The send box now carries the choice (`lib/email/kinds.ts`), and
 * a dial with three positions is one action with a narrowed argument rather
 * than three endpoints the component has to keep a lookup table for. Everything
 * that differs between the three lives in `email/client-mail.ts`; everything
 * that is the same — who may send, who receives, what comes back in a toast —
 * lives here and is written once.
 *
 * ── The guard ──────────────────────────────────────────────────────────────
 *
 * `guard()` from `portal-write.ts`, unchanged and for the same reason it exists
 * there: this is a thing addressed to a customer, so the people who may send it
 * are exactly the people who may publish to the portal — edit on Work or on
 * Management, never a client, never showcase. Reusing it rather than writing a
 * third opinion is the whole point of that file.
 *
 * ⚠️ Showcase is refused by the guard, which matters more here than anywhere
 * else it is applied: a demo runs on fake rows in front of a room, and the one
 * thing that must never escape a demo is an email.
 *
 * ── Failure is reported, not swallowed ─────────────────────────────────────
 *
 * The opposite of `notify.ts` and `email/team.ts`, deliberately. Those fire
 * inside `after()` because nobody asked for them; this is somebody pressing
 * Send and watching for a result, and "sent to 2 people" versus "the domain
 * isn't verified" is the difference between knowing and assuming a client was
 * told.
 */

/** The note box, bounded. It reaches a customer verbatim, so it is trimmed and capped. */
const MAX_NOTE = 1000;

/** "Sent to 2 people." — the toast, and the one sentence worth getting right. */
function report(sent: number, failed: number, skipped: boolean, error: string | null): ActionResult {
  if (skipped) {
    return {
      ok: false,
      message: "Email isn't configured on this environment — set RESEND_API_KEY and EMAIL_FROM.",
    };
  }
  if (sent === 0) {
    return { ok: false, message: error ?? "Nothing was sent." };
  }
  if (failed > 0) {
    return {
      ok: true,
      message: `Sent to ${sent}, but ${failed} failed: ${error}`,
    };
  }
  return { ok: true, message: `Sent to ${sent} ${sent === 1 ? "person" : "people"}.` };
}

/**
 * Same discriminated-union shape as `Guarded` in portal-write.ts, and for the
 * same reason: an early return that carries a message has to be distinguishable
 * from a success at the type level, or every call site needs a non-null
 * assertion to reach the context it was handed.
 */
type Opened =
  | { stop: { ok: false; message: string }; ctx?: undefined; project?: undefined; recipients?: undefined }
  | {
      stop?: undefined;
      ctx: SessionContext;
      project: MailableProject;
      recipients: { userId: string; email: string; name: string | null }[];
    };

/** Shared preamble: check the caller, then read the project they named. */
async function open(projectId: string): Promise<Opened> {
  const { ctx, stop } = await guard(projectId);
  if (stop) return { stop };

  const { data: project } = await selectOrThrow(
    ctx.supabase
      .from("projects")
      .select("id, name, intake_pack")
      // Real projects only. The guard has already refused a showcase SESSION,
      // and this refuses a demo ROW reached from a normal one — two different
      // holes, and mail is not the place to assume the first covers the second.
      .eq("id", projectId)
      .eq("is_demo", false)
      .maybeSingle(),
    "project for email"
  );
  if (!project) {
    return { stop: { ok: false as const, message: "That project no longer exists." } };
  }

  const recipients = await clientRecipients(ctx, projectId);
  if (recipients.length === 0) {
    return {
      stop: {
        ok: false as const,
        message: "Nobody has a client account on this project yet — share it in Admin first.",
      },
    };
  }

  return { ctx, project: project as MailableProject, recipients };
}

/**
 * Write one of the three, to every client account on the project.
 *
 * `rawKind` and `rawLocale` arrive from a client component, so they are strings
 * until proven otherwise — both are narrowed by their own parser exactly as the
 * portal's layout narrows the locale cookie, because between them they decide
 * which query runs and which words a customer reads.
 */
export async function sendClientEmail(
  projectId: string,
  rawKind: string,
  rawLocale: string,
  rawNote: string
): Promise<ActionResult> {
  const opened = await open(projectId);
  if (opened.stop) return opened.stop;
  const { ctx, project, recipients } = opened;

  const kind = parseClientEmailKind(rawKind);
  const locale = parseLocale(rawLocale);
  const note = text(rawNote, MAX_NOTE);

  const email = await buildClientEmail(ctx, project, kind, locale, note);

  const { sent, failed, skipped, error } = await sendEmails(
    recipients.map((recipient) => ({
      to: recipient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tag: CLIENT_EMAIL_TAGS[kind],
    }))
  );

  return report(sent, failed, skipped, error);
}
