import "server-only";
import { rowsOrThrow } from "@/lib/data/query";
import type { SessionContext } from "@/lib/data/session";
import type { Section } from "@/lib/types";

/**
 * Who an email goes to, answered once.
 *
 * ── Read through the caller's client, not the service role ─────────────────
 *
 * `admin.ts` reaches for `createServiceClient()` because it writes rows only an
 * admin may write, and RLS would refuse. Nothing here writes anything: it asks
 * which addresses a project is shared with, which is a question the RLS
 * policies already answer correctly for a Work member (0072 §2). Using the
 * caller's own client means a producer can only ever mail the clients of a
 * project they can see, enforced by the database rather than by this file
 * remembering to check — and it means a bug here leaks nothing the caller could
 * not already read on the page.
 *
 * ── The named foreign key ──────────────────────────────────────────────────
 *
 * `client_projects` has TWO foreign keys into `profiles` — `user_id`, whose
 * access this is, and `created_by`, the admin who granted it. A bare
 * `profiles!inner(…)` is ambiguous and PostgREST refuses the entire request
 * with PGRST201, at runtime only: it typechecks, it builds, and it fails in
 * production. Both pages that run this query name the FK for that reason and so
 * does this.
 */

export type EmailRecipient = {
  userId: string;
  email: string;
  /** Null when the account has no name yet — templates fall back to the project. */
  name: string | null;
};

type ProfileEmbed = {
  full_name: string | null;
  email: string;
};

/**
 * The client accounts a project is shared with.
 *
 * Empty is a normal answer, not an error: a project whose pack nobody has been
 * given access to yet has nobody to mail, and the caller turns that into "share
 * this project with someone in Admin first" rather than into a failed send.
 */
export async function clientRecipients(
  ctx: SessionContext,
  projectId: string
): Promise<EmailRecipient[]> {
  const rows = await rowsOrThrow(
    ctx.supabase
      .from("client_projects")
      .select(
        "user_id, profiles!client_projects_user_id_fkey!inner(full_name, email, kind)"
      )
      .eq("project_id", projectId)
      .eq("profiles.kind", "client"),
    "client_projects recipients"
  );

  return (rows as { user_id: string; profiles: unknown }[]).map((row) => {
    const profile = row.profiles as unknown as ProfileEmbed;
    return {
      userId: row.user_id,
      email: profile.email,
      name: profile.full_name,
    };
  });
}

/**
 * Teammates, for an internal alert. `section` narrows to the people who work in
 * it; omitted, it is everyone at Kagu.
 *
 * `kind = 'member'` is not decoration. A client account is an account, and
 * "email everyone" without that filter is how a customer receives a message
 * about unassigned debug tasks — the same trap `notifyEveryone` documents in
 * `lib/actions/notify.ts`, arriving here in a medium that cannot be unsent.
 */
export async function memberRecipients(
  ctx: SessionContext,
  options: { section?: Section; adminsOnly?: boolean } = {}
): Promise<EmailRecipient[]> {
  const { section, adminsOnly } = options;

  if (section) {
    const rows = await rowsOrThrow(
      ctx.supabase
        .from("section_memberships")
        .select(
          "user_id, profiles!section_memberships_user_id_fkey!inner(full_name, email, kind, is_admin)"
        )
        .eq("section", section)
        .eq("profiles.kind", "member"),
      "section_memberships recipients"
    );

    return (rows as { user_id: string; profiles: unknown }[])
      .map((row) => ({ userId: row.user_id, profile: row.profiles as unknown as ProfileEmbed & { is_admin: boolean } }))
      .filter((row) => !adminsOnly || row.profile.is_admin)
      .map((row) => ({
        userId: row.userId,
        email: row.profile.email,
        name: row.profile.full_name,
      }));
  }

  const query = ctx.supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("kind", "member");

  const rows = await rowsOrThrow(
    adminsOnly ? query.eq("is_admin", true) : query,
    "profiles recipients"
  );

  return (rows as { id: string; full_name: string | null; email: string }[]).map((row) => ({
    userId: row.id,
    email: row.email,
    name: row.full_name,
  }));
}

/**
 * Drop the actor from a list.
 *
 * Same rule the notification bell follows: you are not told about your own
 * doing. It matters more in a mailbox than in a bell, because a producer who
 * mails themselves every progress update learns to filter the whole address.
 */
export function excludeActor(
  recipients: EmailRecipient[],
  userId: string
): EmailRecipient[] {
  return recipients.filter((recipient) => recipient.userId !== userId);
}
