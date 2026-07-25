import Link from "next/link";

/**
 * The app's own top-level segments, so a pasted deep link into the product
 * becomes a real client-side navigation rather than a page load.
 */
const SECTIONS =
  "debug|work|learn|management|marketing|messages|comms|admin|account";

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
}: {
  body: string;
  mentionNames?: Set<string>;
  myName?: string;
}) {
  const parts = body.split(PATTERN);

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
              className={
                isMe
                  ? "rounded bg-primary/15 px-1 font-medium text-primary-dim"
                  : "font-medium text-primary-dim"
              }
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
              <Link href={href} className="text-primary-dim underline underline-offset-2 hover:text-primary">
                {target}
              </Link>
            ) : (
              <a
                href={href}
                target="_blank"
                // noreferrer as well as noopener: without it the destination
                // learns which internal page linked to it.
                rel="noopener noreferrer"
                className="text-primary-dim underline underline-offset-2 hover:text-primary"
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
