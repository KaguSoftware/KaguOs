import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The app's own top-level segments, so a pasted deep link into the product
 * becomes a real client-side navigation rather than a page load.
 */
const SECTIONS =
  "debug|testing|work|learn|management|marketing|messages|comms|admin|account";

/**
 * One capture group with two alternatives: an absolute web URL (or a bare
 * `www.`), or an internal path into a known section.
 */
const PATTERN = new RegExp(
  `((?:https?://|www\\.)[^\\s]+|/(?:${SECTIONS})(?:[/?#][^\\s]*)?|@[A-Za-z][\\w-]*)`,
  "gi"
);

/** Trailing punctuation belongs to the sentence, not to the link. */
const TRAILING = /[.,;:!?)\]}'"]+$/;

/**
 * Message bodies with their links made clickable.
 *
 * A dev studio's chat is mostly links — PRs, tasks, Figma — and bodies were
 * rendered as plain text in a `<p>`, so every one of them had to be selected and
 * copied by hand.
 *
 * Tokenised and rendered as real elements. NEVER `dangerouslySetInnerHTML`:
 * message bodies are user input, and building HTML from them would turn a chat
 * message into a script injection. Because these are React children, the text
 * around the links is still escaped by React exactly as before.
 */
export function RichText({
  body,
  /** Lowercased first names that resolve to real teammates — `@x` only styles
   *  when it names someone, so an email or a stray @ stays plain text. */
  mentionNames,
  /** My own first name, lowercased: being named should stand out more. */
  myName,
  /** "onAccent" inside your own accent-filled bubble, where the accent-green
   *  link and mention colours would vanish into the fill. */
  tone = "default",
}: {
  body: string;
  mentionNames?: Set<string>;
  myName?: string;
  tone?: Tone;
}) {
  const cls = CLASSES[tone];
  // Line-aware so a `> ` line (what the reply button writes) renders as a
  // quote. Tokens never span a newline — `[^\s]+` stops at whitespace — so
  // per-line tokenising changes nothing for links and mentions. The parent's
  // `whitespace-pre-wrap` turns the re-inserted "\n" strings back into breaks.
  const lines = body.split("\n");
  return (
    <>
      {lines.map((line, li) => {
        const quoted = line.startsWith("> ");
        const content = renderInline(
          quoted ? line.slice(2) : line,
          mentionNames,
          myName,
          cls
        );
        return (
          <Fragment key={li}>
            {li > 0 && "\n"}
            {quoted ? (
              // The `> ` marker becomes the border — showing both would say
              // "quote" twice. inline-block so a wrapping quote keeps its
              // border down the whole left edge, not just the first line.
              <span className={cn("inline-block max-w-full border-l-2 pl-2", cls.quote)}>
                {content}
              </span>
            ) : (
              content
            )}
          </Fragment>
        );
      })}
    </>
  );
}

type Tone = "default" | "onAccent";

const CLASSES: Record<Tone, { quote: string; mention: string; mentionMe: string; link: string }> = {
  default: {
    quote: "border-line-strong text-faint",
    mention: "font-medium text-primary-dim",
    mentionMe: "rounded bg-primary/15 px-1 font-medium text-primary-dim",
    link: "text-primary-dim underline underline-offset-2 hover:text-primary",
  },
  onAccent: {
    quote: "border-current/40 opacity-75",
    mention: "font-semibold underline decoration-current/40 underline-offset-2",
    mentionMe: "rounded bg-black/15 px-1 font-semibold",
    link: "underline underline-offset-2 hover:decoration-2",
  },
};

/** One line's inline content: links and `@mentions` made real, text as-is. */
function renderInline(
  text: string,
  mentionNames: Set<string> | undefined,
  myName: string | undefined,
  cls: (typeof CLASSES)[Tone]
) {
  const parts = text.split(PATTERN);

  return (
    <>
      {parts.map((part, i) => {
        // split() with one capture group yields text at even indices and matches
        // at odd ones.
        if (i % 2 === 0 || !part) return part;

        if (part.startsWith("@")) {
          const token = part.slice(1).toLowerCase();
          if (!mentionNames?.has(token)) return part;
          const isMe = token === myName;
          return (
            <span
              key={i}
              className={isMe ? cls.mentionMe : cls.mention}
            >
              {part}
            </span>
          );
        }

        const trailing = part.match(TRAILING)?.[0] ?? "";
        const target = trailing ? part.slice(0, -trailing.length) : part;
        const internal = target.startsWith("/");
        const href = internal
          ? target
          : target.startsWith("www.")
            ? `https://${target}`
            : target;

        return (
          <span key={i}>
            {internal ? (
              <Link href={href} className={cls.link}>
                {target}
              </Link>
            ) : (
              <a
                href={href}
                target="_blank"
                // noreferrer as well as noopener: without it the destination
                // learns which internal page linked to it.
                rel="noopener noreferrer"
                className={cls.link}
              >
                {target}
              </a>
            )}
            {trailing}
          </span>
        );
      })}
    </>
  );
}
