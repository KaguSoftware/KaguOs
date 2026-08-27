import { arPlural } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { renderEmail, type EmailBlock, type RenderedEmail } from "@/lib/email/layout";

/**
 * The words. One function per thing KaguOs mails, each returning a subject and
 * a rendered body in the reader's language.
 *
 * ── Why the copy is here and not in `lib/i18n.ts` ──────────────────────────
 *
 * That file is explicit about its scope: the portal's chrome, plus what a
 * server action says back in a toast. An email is neither. It is read outside
 * the app, days later, in an inbox next to a hundred other things, and it has
 * to carry its own context — the project's name, why this arrived, who sent it
 * — where a toast can assume the reader is looking at the page it belongs to.
 * Different register, different constraints, different file.
 *
 * What it does borrow is the shape: a bilingual pair per string, interpolated
 * by a function rather than by a `{count}` mini-language, because Arabic and
 * English put the number in different places and inflect the noun after it
 * differently. `arPlural` is imported from the dictionary rather than copied,
 * so the counted-noun rule has one home.
 *
 * ── Who chooses the language ───────────────────────────────────────────────
 *
 * The sender, from the send box, not the client's `kagu-locale` cookie. That
 * cookie is a fact about a browser (see `lib/locale.ts`), and there is no
 * browser in an email — a client who last opened the portal on a colleague's
 * laptop would be mailed in that colleague's language. The producer pressing
 * Send knows which language the person they are writing to reads.
 */

export type ClientEmail = RenderedEmail & { subject: string };

const NOTE_LABEL: Record<Locale, string> = {
  en: "A note from the team",
  ar: "ملاحظة من الفريق",
};

const FOOTER: Record<Locale, string> = {
  en: "Sent by Kagusoftware. You're getting this because you have a client account on KaguOs.",
  ar: "أُرسلت من كاغو سوفتوير. وصلتكم هذه الرسالة لأن لديكم حساب عميل على KaguOs.",
};

/** The producer's own words, appended after the numbers rather than instead of them. */
function noteBlock(locale: Locale, note: string | null): EmailBlock[] {
  const trimmed = note?.trim();
  if (!trimmed) return [];
  return [{ kind: "note", label: NOTE_LABEL[locale], text: trimmed }];
}

/* ── "Your input pack is still open" ──────────────────────────────────────── */

export type InputsReminderInput = {
  locale: Locale;
  projectName: string;
  /** Non-optional checks answered, and how many there are. From `progressOf`. */
  done: number;
  total: number;
  /**
   * The cards still outstanding, already resolved into the reader's language by
   * the caller — the pack carries its own `labelAr` beside each English title
   * and this file has no business re-deriving that.
   */
  outstanding: string[];
  note: string | null;
  url: string;
};

/**
 * The nudge. Sent by hand from the project's input-pack page, so its job is to
 * carry the state of the pack — not to announce that a pack exists, which the
 * client already knows.
 *
 * The outstanding list is capped at five. A client who has answered nothing
 * gets a wall of every section otherwise, which reads as a bill rather than a
 * reminder; five and a count is the same information without the dread.
 */
export function inputsReminderEmail(input: InputsReminderInput): ClientEmail {
  const { locale, projectName, done, total, outstanding, note, url } = input;
  const shown = outstanding.slice(0, 5);
  const rest = outstanding.length - shown.length;
  const ar = locale === "ar";

  const subject = ar
    ? `${projectName}: ما زالت هناك إجابات ناقصة`
    : `${projectName}: your input pack is still open`;

  const heading = ar
    ? `بقيت بضعة أسئلة في ${projectName}`
    : `A few answers are still open on ${projectName}`;

  const intro = ar
    ? "حزمة المدخلات هي الأسئلة التي يقوم عليها البناء — ماذا تقدّمون، ولمن، وكيف تريدونه أن يعمل. ما يكون فيها عند البدء هو ما نبني عليه."
    : "Your input pack is the set of questions the build runs on — what you sell, who it's for, and how you want it to work. Whatever's in there when we start is what we build from.";

  const blocks: EmailBlock[] = [{ kind: "paragraph", text: intro }];

  // A pack with no counted questions is a pack whose catalogue entry has none;
  // a 0% meter would be a statement about our configuration, not their answers.
  if (total > 0) {
    blocks.push({
      kind: "meter",
      label: ar ? "تمت الإجابة" : "Answered",
      pct: Math.round((done / total) * 100),
      caption: ar
        ? arPlural(
            total,
            `${done} من أصل سؤال واحد`,
            `${done} من أصل سؤالين`,
            `${done} من أصل ${total} أسئلة`,
            `${done} من أصل ${total} سؤالًا`
          )
        : `${done} of ${total} answered`,
    });
  }

  if (shown.length > 0) {
    blocks.push({ kind: "paragraph", text: ar ? "ما زال مفتوحًا:" : "Still open:" });
    blocks.push({
      kind: "list",
      items: [
        ...shown,
        ...(rest > 0
          ? [
              ar
                ? arPlural(
                    rest,
                    "وقسم واحد آخر",
                    "وقسمان آخران",
                    `و${rest} أقسام أخرى`,
                    `و${rest} قسمًا آخر`
                  )
                : `and ${rest} more`,
            ]
          : []),
      ],
    });
  }

  blocks.push(...noteBlock(locale, note));

  return {
    subject,
    ...renderEmail({
      locale,
      preheader: ar
        ? `${done} من أصل ${total} — أكملوا ما تبقّى في بوابتكم.`
        : `${done} of ${total} answered — finish the rest in your portal.`,
      heading,
      blocks,
      cta: {
        label: ar ? "افتحوا حزمة المدخلات" : "Open your input pack",
        href: url,
      },
      footer: FOOTER[locale],
    }),
  };
}

/* ── "Progress has been updated" ──────────────────────────────────────────── */

export type ProgressUpdateInput = {
  locale: Locale;
  projectName: string;
  /** The weighted headline from `milestoneProgress`. */
  pct: number;
  done: number;
  total: number;
  /** The next phase that isn't finished, in the reader's language. */
  nextTitle: string | null;
  /** Phases flagged blocked — the one thing worth saying out loud. */
  blocked: string[];
  note: string | null;
  url: string;
};

/**
 * The update. Deliberately a summary and a link rather than the plan itself:
 * the portal renders every phase, its weight, its dates and its sub-phases, and
 * a copy of that in an email is a copy that goes stale the next time anybody
 * edits a row. What travels well is the headline and what's next.
 */
export function progressUpdateEmail(input: ProgressUpdateInput): ClientEmail {
  const { locale, projectName, pct, done, total, nextTitle, blocked, note, url } = input;
  const ar = locale === "ar";

  const subject = ar
    ? `${projectName} — تحديث على سير العمل`
    : `${projectName} — progress updated`;

  const blocks: EmailBlock[] = [
    {
      kind: "paragraph",
      text: ar
        ? "هذا الملخّص السريع. الخطة الكاملة، بكل مرحلة وتواريخها، موجودة في بوابتكم."
        : "Here's the short version. The full plan — every phase, with its dates — is in your portal.",
    },
    {
      kind: "meter",
      label: ar ? "نسبة الإنجاز" : "Build progress",
      pct,
      caption:
        total === 0
          ? undefined
          : ar
            ? arPlural(
                total,
                `${done} من أصل مرحلة واحدة`,
                `${done} من أصل مرحلتين`,
                `${done} من أصل ${total} مراحل`,
                `${done} من أصل ${total} مرحلةً`
              )
            : `${done} of ${total} phases done`,
    },
  ];

  if (nextTitle) {
    blocks.push({
      kind: "paragraph",
      text: ar ? `التالي: ${nextTitle}` : `Next up: ${nextTitle}`,
    });
  }

  // Named, never folded into the percentage. A bar that quietly absorbs a
  // blockage is how a client finds out about it in a meeting instead — the same
  // rule `milestoneProgress` follows on the page.
  if (blocked.length > 0) {
    blocks.push({
      kind: "paragraph",
      text: ar ? "متوقّف حاليًا:" : "Currently blocked:",
    });
    blocks.push({ kind: "list", items: blocked });
  }

  blocks.push(...noteBlock(locale, note));

  return {
    subject,
    ...renderEmail({
      locale,
      preheader: ar
        ? `${projectName} عند ${Math.round(pct)}% — اطّلعوا على الخطة الكاملة.`
        : `${projectName} is at ${Math.round(pct)}% — see the full plan.`,
      heading: ar ? `حدّثنا وضع ${projectName}` : `We've updated where ${projectName} stands`,
      blocks,
      cta: {
        label: ar ? "اطّلعوا على الخطة الكاملة" : "See the full plan",
        href: url,
      },
      footer: FOOTER[locale],
    }),
  };
}

/* ── Team mail ────────────────────────────────────────────────────────────── */

export type TeamAlertInput = {
  heading: string;
  /** One line per fact. Rendered as a list when there's more than one. */
  lines: string[];
  cta: { label: string; href: string };
};

/**
 * The shape for anything addressed INWARDS — "nine debug tasks have been
 * unassigned for a week", "a client sent their input pack".
 *
 * English only, and that is not an oversight: `(app)` never offers the language
 * toggle (lib/locale.ts), so the teammate reading this already works in an
 * English tool all day and a bilingual internal email would be the only Arabic
 * surface in the building.
 *
 * Nothing calls this yet. It ships with the client mail because the transport,
 * the shell and the recipient lookup are the same three problems, and solving
 * them twice — once when the first internal alert is specified — is how the two
 * halves end up with two different answers about who may be mailed and how
 * often. See `lib/email/team.ts` for the send.
 */
export function teamAlertEmail(input: TeamAlertInput): ClientEmail {
  const { heading, lines, cta } = input;
  const blocks: EmailBlock[] =
    lines.length === 1
      ? [{ kind: "paragraph", text: lines[0] }]
      : [{ kind: "list", items: lines }];

  return {
    subject: heading,
    ...renderEmail({
      locale: "en",
      preheader: lines[0] ?? heading,
      heading,
      blocks,
      cta,
      footer: "Sent by KaguOs to the team. Nobody outside Kagu received this.",
    }),
  };
}
