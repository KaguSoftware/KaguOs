"use server";

import { selectOrThrow } from "@/lib/data/query";
import type { SessionContext } from "@/lib/data/session";
import { getIntakePack } from "@/lib/data/intake";
import { getProjectMilestones, milestoneProgress } from "@/lib/data/portal";
import { guard, text } from "@/lib/actions/portal-write";
import type { ActionResult } from "@/lib/actions/account";
import { parseLocale, pick, type Locale } from "@/lib/locale";
import { absoluteUrl } from "@/lib/email/config";
import { clientRecipients } from "@/lib/email/recipients";
import { sendEmails } from "@/lib/email/send";
import { inputsReminderEmail, progressUpdateEmail } from "@/lib/email/templates";

/**
 * The two emails KaguOs sends to a customer, both fired by hand from the
 * project's own pages.
 *
 * ── Why by hand, and not from a trigger on the row ─────────────────────────
 *
 * Because both of the obvious triggers are wrong. "Email on every milestone
 * update" fires while a producer is mid-edit and mails a client four times in a
 * minute about a plan that was being rearranged, not progressed. "Email when
 * the pack goes stale" needs a definition of stale that nobody has, and a
 * client who is deliberately waiting on their accountant gets nagged weekly for
 * it. The person who knows the update is worth sending is the person who made
 * it, and they are already looking at the page it happened on.
 *
 * What the button removes is the retyping, not the judgement: the numbers, the
 * link and the language come from the same data the page is rendering.
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
 * inside `after()` because nobody asked for them; these are somebody pressing
 * Send and watching for a result, and "sent to 2 people" versus "the domain
 * isn't verified" is the difference between knowing and assuming a client was
 * told.
 */

/** The note box, bounded. It reaches a customer verbatim, so it is trimmed and capped. */
const MAX_NOTE = 1000;

/**
 * A locale arrives from a client component, so it is a string until proven
 * otherwise — `parseLocale` narrows it to the two known keys exactly as the
 * portal's layout does with the cookie.
 */
function localeOf(value: string): Locale {
  return parseLocale(value);
}

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
      project: { id: string; name: string; intake_pack: string | null };
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

  return {
    ctx,
    project: project as { id: string; name: string; intake_pack: string | null },
    recipients,
  };
}

/**
 * "Your input pack is still open" — sent from the project's Input pack page.
 *
 * The outstanding list is built from the same `buildChecks` pass the client's
 * own checklist renders, so the email cannot name a section the portal thinks
 * is finished.
 */
export async function emailInputsReminder(
  projectId: string,
  rawLocale: string,
  rawNote: string
): Promise<ActionResult> {
  const opened = await open(projectId);
  if (opened.stop) return opened.stop;
  const { ctx, project, recipients } = opened;

  const locale = localeOf(rawLocale);
  const note = text(rawNote, MAX_NOTE);

  const pack = await getIntakePack(ctx, project.id, project.intake_pack);

  // Optional cards are excluded from both the meter and this list, exactly as
  // `progressOf` excludes them — a client should not be chased for the sub-
  // recipes their business does not have.
  const outstanding = pack.checks
    .filter((check) => !check.ok && !check.optional)
    .map((check) => pick(locale, check.label, check.labelAr));

  const email = inputsReminderEmail({
    locale,
    projectName: project.name,
    done: pack.progress.done,
    total: pack.progress.total,
    outstanding,
    note,
    url: absoluteUrl(`/portal/inputs/${project.id}`),
  });

  const { sent, failed, skipped, error } = await sendEmails(
    recipients.map((recipient) => ({
      to: recipient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tag: "inputs_reminder",
    }))
  );

  return report(sent, failed, skipped, error);
}

/**
 * "Progress has been updated" — sent from the project's Client view page.
 *
 * Reads the same numbers the client's progress page will show them when they
 * follow the link: `milestoneProgress` over the CLIENT-VISIBLE phases only, so
 * an email can never quote a percentage that includes a phase the portal is
 * still hiding.
 */
export async function emailProgressUpdate(
  projectId: string,
  rawLocale: string,
  rawNote: string
): Promise<ActionResult> {
  const opened = await open(projectId);
  if (opened.stop) return opened.stop;
  const { ctx, project, recipients } = opened;

  const locale = localeOf(rawLocale);
  const note = text(rawNote, MAX_NOTE);

  const milestones = await getProjectMilestones(ctx, [project.id]);
  const visible = milestones.filter((milestone) => milestone.visible_to_client);
  const progress = milestoneProgress(visible);

  const email = progressUpdateEmail({
    locale,
    projectName: project.name,
    pct: progress.pct,
    done: progress.done,
    total: progress.total,
    // Phase titles are written once, in the language the plan was written in —
    // unlike a pack question they carry no Arabic twin, so they travel as-is.
    nextTitle: progress.next?.title ?? null,
    blocked: progress.blocked.map((milestone) => milestone.title),
    note,
    url: absoluteUrl("/portal/progress"),
  });

  const { sent, failed, skipped, error } = await sendEmails(
    recipients.map((recipient) => ({
      to: recipient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tag: "progress_update",
    }))
  );

  return report(sent, failed, skipped, error);
}
