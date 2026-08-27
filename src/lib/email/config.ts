import "server-only";

/**
 * Everything the email layer reads out of the environment, resolved once.
 *
 * ── Why a nullable config rather than `process.env.X!` at the call site ────
 *
 * Email is the first thing in KaguOs that leaves the building, and the machine
 * it leaves from is not always configured: a teammate running `next dev` off a
 * fresh clone has no Resend key, and a preview deploy should not be mailing
 * customers from a branch. Reading the key through a function that can answer
 * "not configured" lets every caller degrade the same way — the action returns
 * a sentence saying so instead of throwing a 500 at somebody who pressed Send.
 *
 * The alternative — a build-time assertion — would mean the app refuses to boot
 * on a laptop over a feature nine tenths of it doesn't use.
 */

export type EmailConfig = {
  apiKey: string;
  /** RFC 5322 from-line: `KaguOs <hello@kagusoftware.com>`. */
  from: string;
  /** Where a client's reply lands. Null sends replies back to `from`. */
  replyTo: string | null;
};

/**
 * The Resend credentials, or null when this environment cannot send.
 *
 * `EMAIL_FROM` is required alongside the key rather than defaulted, on purpose:
 * a default would be a guess at a domain, Resend refuses to send from a domain
 * that isn't verified, and the failure would arrive as a 403 from an API
 * nobody was expecting to talk to. Missing config is better said out loud.
 */
export function emailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;

  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  return { apiKey, from, replyTo: replyTo || null };
}

/** Cheap yes/no for a UI that wants to explain itself before anyone presses Send. */
export function emailEnabled(): boolean {
  return emailConfig() !== null;
}

/**
 * The origin every link in an email is built from.
 *
 * ⚠️ Deliberately NOT `VERCEL_URL`. That variable holds the URL of ONE
 * deployment (`kaguos-a1b2c3.vercel.app`) and it changes on every push — baked
 * into an email it produces a link that works the afternoon it was sent and
 * 404s the week the client gets round to opening it. `VERCEL_PROJECT_PRODUCTION_URL`
 * is the stable production domain, which is the only one worth putting in front
 * of a customer, and an explicit `NEXT_PUBLIC_SITE_URL` beats both because it is
 * the custom domain the client already knows.
 *
 * Returned without a trailing slash so callers can concatenate a path that has
 * a leading one without producing `//portal`.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

/** An absolute URL for a portal path — what a client clicks in an email. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
