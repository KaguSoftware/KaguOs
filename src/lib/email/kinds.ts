/**
 * Which of the three things KaguOs mails a customer.
 *
 * ── Why this is its own file ───────────────────────────────────────────────
 *
 * The send box is a CLIENT component and the builder that turns a kind into an
 * email is `server-only`, so the two cannot share a module. `templates.ts` is
 * not server-only but importing it from the browser would drag the whole email
 * shell and the portal dictionary into the client bundle for the sake of three
 * string literals. Four lines in a file of their own is the cheaper answer, and
 * it is the same shape `lib/locale.ts` already uses for the language toggle.
 *
 * ── Why a parser and not a trusted string ──────────────────────────────────
 *
 * The kind arrives at a server action from a client component, which means it
 * is a string until proven otherwise — exactly like the locale beside it. It
 * decides which query runs and which words a CUSTOMER reads, so it is narrowed
 * at the door rather than switched on hopefully.
 */

export const CLIENT_EMAIL_KINDS = ["inputs", "progress", "finance"] as const;

export type ClientEmailKind = (typeof CLIENT_EMAIL_KINDS)[number];

/**
 * Inputs, because the pack is the first thing a project asks a client for and
 * the only one of the three that can be sent before anything else exists.
 */
export const DEFAULT_CLIENT_EMAIL_KIND: ClientEmailKind = "inputs";

export function parseClientEmailKind(value: string | undefined): ClientEmailKind {
  return CLIENT_EMAIL_KINDS.includes(value as ClientEmailKind)
    ? (value as ClientEmailKind)
    : DEFAULT_CLIENT_EMAIL_KIND;
}

/**
 * How a send is grouped in Resend's dashboard, so a bounce can be traced back
 * to the thing that triggered it. Here rather than at the send site because the
 * three tags are one fact about the three kinds, not three separate decisions.
 */
export const CLIENT_EMAIL_TAGS: Record<ClientEmailKind, string> = {
  inputs: "inputs_reminder",
  progress: "progress_update",
  finance: "finance_reminder",
};
