import "server-only";
import { emailConfig } from "@/lib/email/config";

/**
 * The one place KaguOs talks to Resend.
 *
 * ── Why `fetch`, and not the `resend` package ──────────────────────────────
 *
 * The whole of the API this app uses is one POST with a JSON body. The SDK
 * wraps that in a dependency, a version to keep current and a second opinion
 * about retries, and buys nothing back — there is no streaming, no webhook
 * verification and no pagination here. Written against the HTTP endpoint, the
 * transport is forty lines that any reader can check against Resend's docs.
 *
 * ── One request per recipient, never one request with several `to` ─────────
 *
 * A project can be shared with two people, and two people at the same client is
 * the common case — but `client_projects` is a SET, so the two addresses on a
 * project are not guaranteed to work at the same company. Putting them in one
 * `to` array puts each customer's address in the other's mail header. Separate
 * requests cost a round-trip and remove the possibility.
 *
 * ── Nothing in here throws ─────────────────────────────────────────────────
 *
 * Every caller is a server action whose job is to report back in a toast, and a
 * mail provider having a bad afternoon must not become a red error screen over
 * a project page that rendered perfectly. Failures come back as a report the
 * action turns into a sentence.
 */

const ENDPOINT = "https://api.resend.com/emails";

/** Resend gives up on a single send well inside this; the cap is for a hung socket. */
const TIMEOUT_MS = 10_000;

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  /**
   * The plain-text alternative. Required rather than optional: a message with
   * no text part scores as spam almost everywhere, and the first email this app
   * ever sends to a customer is not the place to find that out.
   */
  text: string;
  /**
   * Groups the send in Resend's dashboard, so a bounce can be traced back to
   * the thing that triggered it. ASCII letters, digits, `_` and `-` only —
   * that is the provider's rule, and it is enforced here rather than discovered
   * as a 422.
   */
  tag?: string;
  /**
   * Makes a retry safe. Two clicks on Send, or a Vercel retry of the same
   * invocation, reach Resend as one email when they carry the same key.
   */
  idempotencyKey?: string;
};

export type SendReport = {
  sent: number;
  failed: number;
  /** True when this environment has no Resend credentials — nothing was attempted. */
  skipped: boolean;
  /** The first failure's message, for a toast. Null when everything went out. */
  error: string | null;
};

function cleanTag(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60);
}

async function sendOne(
  message: EmailMessage,
  config: NonNullable<ReturnType<typeof emailConfig>>
): Promise<string | null> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  if (message.idempotencyKey) {
    headers["Idempotency-Key"] = message.idempotencyKey.slice(0, 256);
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      // Explicitly uncached. A POST is not cached by default, but this is a
      // side effect with a body that repeats across sends (same subject, same
      // template) and nothing about it should ever be deduplicated by a layer
      // that does not know an email left the building.
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
        ...(message.tag ? { tags: [{ name: "kind", value: cleanTag(message.tag) }] } : {}),
      }),
    });

    if (response.ok) return null;

    // Resend answers a refusal with `{ statusCode, name, message }`. The
    // message is the useful half ("The kagusoftware.com domain is not
    // verified"), so it is read out rather than reporting a bare status.
    const body = (await response.json().catch(() => null)) as
      | { message?: string; name?: string }
      | null;
    return body?.message ?? `Resend refused the send (HTTP ${response.status}).`;
  } catch (error) {
    // A timeout arrives here as a TimeoutError, a DNS failure as a TypeError.
    // Neither is worth distinguishing to the person who pressed Send.
    console.error("[email] send failed", error);
    return error instanceof Error && error.name === "TimeoutError"
      ? "The email provider did not answer in time."
      : "Could not reach the email provider.";
  }
}

/**
 * Send a batch, one request each, and report what happened.
 *
 * Sends run concurrently: the failure of one recipient must not stop the other,
 * and a serial loop over five addresses is five round-trips of latency on a
 * server action somebody is watching a spinner for.
 */
export async function sendEmails(messages: EmailMessage[]): Promise<SendReport> {
  if (messages.length === 0) {
    return { sent: 0, failed: 0, skipped: false, error: null };
  }

  const config = emailConfig();
  if (!config) {
    // Loud in the server log, quiet everywhere else. On a dev machine this is
    // the expected state, and it should be obvious why no email arrived.
    console.warn(
      `[email] RESEND_API_KEY / EMAIL_FROM are not set — ${messages.length} message(s) not sent.`
    );
    return { sent: 0, failed: 0, skipped: true, error: null };
  }

  const results = await Promise.all(messages.map((message) => sendOne(message, config)));
  const failures = results.filter((result): result is string => result !== null);

  return {
    sent: results.length - failures.length,
    failed: failures.length,
    skipped: false,
    error: failures[0] ?? null,
  };
}
