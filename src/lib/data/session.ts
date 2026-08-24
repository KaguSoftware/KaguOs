import { cache } from "react";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  SECTION_LABELS,
  type Profile,
  type ProfileKind,
  type Section,
} from "@/lib/types";

/**
 * How much a membership lets you do. 'write' is the default and the only thing
 * that existed before 0053 — a 'read' member sees the section and can change
 * nothing in it.
 */
export type SectionAccess = "read" | "write";

/** How stale last_seen_at must be before we bother writing a fresh one. */
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export type SessionContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  profile: Profile;
  /** Sections you can SEE. Membership alone; says nothing about writing. */
  sections: Set<Section>;
  /**
   * Per-section write tier. Kept alongside `sections` rather than folded into
   * it: canAccess() has 40+ call sites, and a single Map would make "can read"
   * and "can write" look identical at every one of them — when the whole point
   * of the tier is that those two questions must stay visibly different.
   */
  access: Map<Section, SectionAccess>;
  isAdmin: boolean;
  /** When true, the app shows obviously-fake demo data (client showcase). */
  showcase: boolean;
  /**
   * Member or client (0062). A client is an outsider with a login — someone at
   * a Marketing client who approves their own cuts — and belongs to no section.
   *
   * Kept as the raw kind rather than only a boolean because the interesting
   * question at most call sites is "which surface does this person get", and a
   * two-valued name answers it more legibly than `!isClient`.
   */
  kind: ProfileKind;
  /**
   * 0062's MARKETING tenant. Retired with the approval portal (0068) and kept
   * answering null by the database ever since (0071, 0072 §5) — the field
   * survives because the additive-only rule on session_context() says a key
   * that shipped never changes shape, not because anything sets it.
   */
  clientId: string | null;
  /**
   * The projects a CLIENT account may see — empty for every member, and empty
   * for a client nobody has assigned anything to yet (0072 §1).
   *
   * An array rather than the single scalar 0062 used, because a business can
   * have two things being built for it. It mirrors private.client_project_ids()
   * in the database, which is where the rule is actually enforced; this copy
   * exists so the UI never asks for rows it will not get back.
   */
  clientProjectIds: string[];
};

/**
 * Loads the signed-in user's profile + memberships; redirects to /login if
 * signed out. Wrapped in React cache() so layout + page share one lookup per
 * request instead of hitting the database twice.
 */
export const getSessionContext = cache(async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createClient();

  // getClaims() verifies the JWT LOCALLY against the project's ES256 JWKS —
  // no auth-server round-trip (unlike getUser(), which costs a full ~300ms
  // network call). The proxy already refreshed the token on this request, so
  // the claims are fresh. If the project ever reverts to a legacy HS256 shared
  // secret, getClaims() would fall back to a network call — still correct.
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");

  // One RPC, not two queries. The profile and the memberships are always needed
  // together and always gate the rest of the page, so they're fetched in a
  // single trip (see 0017_session_context_rpc.sql). The database answers in
  // microseconds; what costs ~305ms is the flight to it — so trips, not query
  // count, are what to optimise. The function reads auth.uid() internally, so
  // there's no id to pass and nothing for a client to tamper with.
  //
  // ⚠️ Deliberately NOT wrapped in selectOrThrow. This is the one place where a
  // failed read must NOT throw: a missing/failed session means "signed out", and
  // the correct response is the redirect below, not an error screen. Throwing
  // here would turn an expired token into a crash on every route, including the
  // path out to /login.
  const { data: row } = await supabase.rpc("session_context");
  const ctx = row as {
    profile: Profile;
    sections: Section[];
    // Optional so a stale RPC (migration not yet applied, or a rollback) can't
    // lock the whole company out — see the permissive default in canWrite.
    access?: Record<Section, SectionAccess>;
    // Also optional, for the same deploy-window reason — but note the default
    // below goes the OTHER way. A missing `access` must read as "full write" or
    // the company loses its own app; a missing `kind` must read as "member",
    // which is the same permissive direction because the restricted principal
    // is the client. Both defaults describe the world before 0062.
    kind?: ProfileKind;
    client_id?: string | null;
    // Added by 0072. Optional for the same deploy-window reason as the two
    // above, and defaulted to [] — a client whose assignments haven't arrived
    // yet sees an empty portal, never someone else's project.
    client_project_ids?: string[] | null;
  } | null;
  if (!ctx?.profile) redirect("/login");

  const profile = ctx.profile;
  const sections = new Set<Section>(ctx.sections ?? []);
  const access = new Map<Section, SectionAccess>(
    Object.entries(ctx.access ?? {}) as [Section, SectionAccess][]
  );

  // Stamp "last seen", throttled + off the critical path. Only write when the
  // stored value is missing or older than the throttle window, so an active user
  // costs at most one tiny update every 5 min, not one per page. after() runs it
  // once the response has shipped — it never delays the page.
  const lastSeen = profile.last_seen_at ? Date.parse(profile.last_seen_at) : 0;
  if (Date.now() - lastSeen > LAST_SEEN_THROTTLE_MS) {
    after(async () => {
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", userId);
    });
  }

  // `kind` is read from the RPC's own key, not from `profile.kind`, so that the
  // one place this value is decided is the same place `client_id` comes from.
  const kind: ProfileKind = ctx.kind ?? profile.kind ?? "member";
  const isClient = kind === "client";

  return {
    supabase,
    userId,
    profile,
    sections,
    access,
    // A client is never an admin and never showcases. The database refuses both
    // (0062 §1 as a constraint, §4 in the gate functions); mirrored here so the
    // UI cannot render an admin nav or a showcase banner for one even if a row
    // somehow carried the flag.
    isAdmin: profile.is_admin && !isClient,
    showcase: Boolean(profile.showcase_mode) && !isClient,
    kind,
    clientId: isClient ? (ctx.client_id ?? null) : null,
    // Gated on `isClient` rather than passed through: a member's assignments
    // are meaningless (they see Work in full), and an array that's non-empty
    // for a member would make every `clientProjectIds.length` check in the app
    // read as "this person is a client" when it isn't.
    clientProjectIds: isClient ? (ctx.client_project_ids ?? []) : [],
  };
});

/** An outsider with a login — see SessionContext.kind. */
export function isClient(ctx: SessionContext) {
  return ctx.kind === "client";
}

export function canAccess(ctx: SessionContext, section: Section) {
  // A client belongs to no section and must never roam. Checked first, above
  // the showcase arm in particular: showcase deliberately grants access to
  // every section, and it is the one clause here that could hand an outsider
  // the whole app. (ctx.showcase is already forced false for clients above —
  // this is the second lock on the same door, because one bad `?? true` in the
  // parsing above would otherwise be enough.)
  if (isClient(ctx)) return false;
  // In showcase mode everyone can roam every section — it's all demo data, so
  // there's nothing real to protect and the point is to show the whole app off.
  return ctx.isAdmin || ctx.showcase || ctx.sections.has(section);
}

/**
 * Can this user CHANGE things in the section — the write half of canAccess.
 *
 * Mirrors private.can_write() in the database (0053), which is where the rule is
 * actually enforced; this exists so the UI can hide affordances that would fail,
 * and so actions can return a sentence instead of an RLS error.
 *
 * The `?? "write"` default is deliberate and permissive: if the access map is
 * empty because the RPC predates 0053, every member behaves exactly as they did
 * before the tier existed. Failing the other way would lock the company out of
 * writing during a deploy window.
 */
export function canWrite(ctx: SessionContext, section: Section) {
  // ⚠️ A client must NEVER satisfy canWrite("marketing"). That check is the
  // whole distance between "approve my video" and "edit the agency's
  // pipeline" — so the client's one write (a review, 0064) is gated on being
  // that creative's approver, and never on this function.
  if (isClient(ctx)) return false;
  // Showcase roams everywhere and writes nowhere — it must not gain a write
  // path here that blockIfShowcase would otherwise have stopped.
  if (ctx.showcase) return false;
  if (ctx.isAdmin) return true;
  if (!ctx.sections.has(section)) return false;
  return (ctx.access.get(section) ?? "write") === "write";
}

/**
 * The signed-in user's id from the LOCAL JWT (getClaims → ES256 verify, no
 * network). Use this in lightweight actions that only need the id and don't
 * want the full session-context fetch. Returns null when signed out.
 */
export async function getUserId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data: claims } = await supabase.auth.getClaims();
  return claims?.claims.sub ?? null;
}

/**
 * The `is_demo` value every list query should filter by. In showcase mode the
 * app shows ONLY demo rows; normally it shows ONLY real rows. Apply this in the
 * data layer so real data never reaches a client that's demoing.
 *
 *   ctx.supabase.from("projects").select("*").eq("is_demo", demoFlag(ctx))
 */
export function demoFlag(ctx: SessionContext): boolean {
  return ctx.showcase;
}

/**
 * Where this person's app STARTS. Members get the teammate dashboard; clients
 * get their portal.
 *
 * Every "send them back" in the app used to be a bare `redirect("/")`, which
 * for a client is a redirect to a page that immediately redirects them here —
 * a loop if it were ever wrong, and a flash of the wrong shell even when right.
 * One function so there is one answer.
 */
export function homeFor(ctx: SessionContext) {
  return isClient(ctx) ? "/portal" : "/";
}

/** Page guard: members (or admins) only — everyone else lands back at their home. */
export async function requireSection(section: Section): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!canAccess(ctx, section)) redirect(homeFor(ctx));
  return ctx;
}

/**
 * Page guard for the client portal — the mirror of requireSection, and the only
 * door into the `(client)` route group.
 *
 * A client with NO assignments is deliberately let through. 0062's version sent
 * them to /login on the grounds that an account with nothing to show is a
 * provisioning bug — true, but the person it punishes is the client, who is
 * handed a login that appears not to work. The portal says "nothing's been
 * shared with you yet" instead, which is the same fact stated to the right
 * audience.
 */
export async function requireClient(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!isClient(ctx)) redirect("/");
  return ctx;
}

/**
 * Guard for one project inside the portal, and the single place the tenant
 * check is written for a route that names a project in its URL.
 *
 * The database refuses the rows either way (0072 §4) — a client asking for
 * another business's pack gets an empty result, not an error. This turns that
 * empty result into a redirect, so the failure reads as "that isn't yours"
 * rather than as a pack that mysteriously has no questions in it.
 */
export async function requireClientProject(
  projectId: string
): Promise<SessionContext> {
  const ctx = await requireClient();
  if (!ctx.clientProjectIds.includes(projectId)) redirect("/portal");
  return ctx;
}

/**
 * The mutating-action guard for the client portal: this person is a client, and
 * this project is one of theirs.
 *
 * Deliberately NOT expressed as a variant of blockIfReadOnly — that function's
 * whole job is section access, which a client can never have. Two guards that
 * look alike and answer different questions is exactly how the wrong one gets
 * called.
 */
export async function blockIfNotMyProject(
  projectId: string
): Promise<{ ok: false; message: string } | null> {
  const ctx = await getSessionContext();
  if (!isClient(ctx)) {
    return { ok: false, message: "That isn't something your account can do." };
  }
  return ctx.clientProjectIds.includes(projectId)
    ? null
    : { ok: false, message: "That project isn't shared with your account." };
}

/**
 * Showcase mode is a read-only tour: while it's on, the user roams every
 * section (see canAccess) but must not mutate anything — writing would create
 * real rows in sections they don't belong to, or pollute the demo set. Mutating
 * server actions call this first and return its result when it's non-null.
 *
 *   const stop = await blockIfShowcase(); if (stop) return stop;
 */
export async function blockIfShowcase(): Promise<{ ok: false; message: string } | null> {
  const ctx = await getSessionContext();
  return ctx.showcase
    ? { ok: false, message: "Showcase mode is read-only — exit showcase to make changes." }
    : null;
}

/**
 * The mutating-action guard for anything that belongs to a section.
 *
 * SUBSUMES blockIfShowcase — call this INSTEAD of it, not after it. Showcase is
 * just the strictest read-only case, and getSessionContext is cache()d so this
 * costs nothing extra. blockIfShowcase stays for the section-less actions
 * (account, notifications, reminders, announcements, showcase itself), which
 * have no section to check.
 *
 *   const stop = await blockIfReadOnly("debug"); if (stop) return stop;
 */
export async function blockIfReadOnly(
  section: Section
): Promise<{ ok: false; message: string } | null> {
  const ctx = await getSessionContext();
  // A client reaching a section action at all means a member-only affordance
  // leaked into the portal. Refuse it in its own arm rather than letting it
  // fall through to the view-only message, which would describe a section this
  // person cannot see and does not know exists.
  if (isClient(ctx))
    return { ok: false, message: "That isn't something your account can do." };
  if (ctx.showcase)
    return {
      ok: false,
      message: "Showcase mode is read-only — exit showcase to make changes.",
    };
  return canWrite(ctx, section)
    ? null
    : {
        ok: false,
        message: `You have view-only access to ${SECTION_LABELS[section]}.`,
      };
}

/**
 * Page guard for routes that exist ONLY to create or edit (/debug/new,
 * /work/projects/new, …). A view-only member shouldn't be handed a form that
 * can't submit — send them back rather than let them type into a dead end.
 */
export async function requireSectionWrite(section: Section): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!canWrite(ctx, section)) redirect(homeFor(ctx));
  return ctx;
}

export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx.isAdmin) redirect(homeFor(ctx));
  return ctx;
}
