import "server-only";
import { after } from "next/server";
import type { SessionContext } from "@/lib/data/session";
import type { Section } from "@/lib/types";
import { absoluteUrl } from "@/lib/email/config";
import { excludeActor, memberRecipients } from "@/lib/email/recipients";
import { sendEmails } from "@/lib/email/send";
import { teamAlertEmail } from "@/lib/email/templates";

/**
 * Mail the team about something that happened inside KaguOs.
 *
 * ── The shape is `notify.ts`'s, on purpose ─────────────────────────────────
 *
 * `lib/actions/notify.ts` already answers "who should hear about this" for the
 * notification bell, and it answers it with one function per audience, all of
 * them fire-and-forget inside `after()`, all of them swallowing their own
 * errors so a failure never breaks the action that triggered it. An email layer
 * that invented a second convention for the same question would mean two places
 * to look when somebody isn't hearing about something, and eventually two
 * different opinions about whether clients count as "everyone".
 *
 * So: same `after()`, same silence on failure, same exclusion of the actor.
 *
 * ── But NOT the same volume ────────────────────────────────────────────────
 *
 * A bell row is free; an email is not. A notification per debug task is a badge
 * that goes to 12, and a badge at 12 is fine — the same rule in a mailbox is
 * twelve emails and a filter rule that hides the thirteenth, which is how a
 * team stops reading its own alerts. Anything wired to this belongs at the
 * SUMMARY level: "nine tasks have been unassigned for a week", once, on a
 * schedule — not one send per row that crossed a line.
 *
 * Nothing calls this yet. It is the seam the first internal alert plugs into.
 */

export type TeamEmailInput = {
  /** Narrow to the people who work in one section. Omitted: everyone at Kagu. */
  section?: Section;
  adminsOnly?: boolean;
  /** Doubles as the subject, so write it as a whole sentence. */
  heading: string;
  /** One line per fact. */
  lines: string[];
  /** Where to go and do something about it — a path, made absolute here. */
  path: string;
  ctaLabel: string;
  /** Groups the send in Resend's dashboard. */
  tag: string;
};

export function emailTeam(ctx: SessionContext, input: TeamEmailInput): void {
  after(async () => {
    try {
      // Showcase is a session showing obviously-fake data to a room of people.
      // Sending real mail off the back of demo rows would be the one part of
      // the demo that leaves the building.
      if (ctx.showcase) return;

      const recipients = excludeActor(
        await memberRecipients(ctx, {
          section: input.section,
          adminsOnly: input.adminsOnly,
        }),
        ctx.userId
      );
      if (recipients.length === 0) return;

      const email = teamAlertEmail({
        heading: input.heading,
        lines: input.lines,
        cta: { label: input.ctaLabel, href: absoluteUrl(input.path) },
      });

      await sendEmails(
        recipients.map((recipient) => ({
          to: recipient.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          tag: input.tag,
        }))
      );
    } catch (error) {
      // Same contract as notify.ts: best-effort, never surfaced. `sendEmails`
      // does not throw, so anything caught here came from the recipient lookup.
      console.error("[email] team alert failed", error);
    }
  });
}
