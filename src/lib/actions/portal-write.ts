import "server-only";
import { revalidatePath } from "next/cache";
import {
  canWrite,
  getSessionContext,
  isClient,
  type SessionContext,
} from "@/lib/data/session";

/**
 * The door every write to the client portal goes through, and the small
 * validators that stand behind it.
 *
 * A plain module rather than a second `"use server"` file: those may only
 * export async functions, so a guard shared between `client-portal.ts` and
 * `payment-plans.ts` has to live somewhere that isn't one. Both files publish
 * things a CUSTOMER reads, and the whole point of extracting this is that they
 * cannot drift into two different answers about who is allowed to.
 *
 * ── The guard, and why it isn't `blockIfReadOnly` ───────────────────────────
 *
 * It mirrors the RLS policies exactly: `can_write('work') OR
 * can_write('management')` (0074 §3, 0075 §2c). Neither `blockIfReadOnly`
 * variant expresses that — they each take ONE section — and calling
 * blockIfReadOnly("work") would refuse the finance person whose whole job this
 * is, with a message about a section they can see perfectly well.
 *
 * A client is refused in its own arm, above everything. It should be
 * unreachable (these actions are imported only by pages inside the teammate
 * shell), and the database refuses it independently — but a client account
 * writing its own milestones would be the portal telling a customer a thing the
 * customer told it, which is worth two lines to make impossible.
 */

export type Guarded =
  | { ctx: SessionContext; stop?: undefined }
  | { ctx?: undefined; stop: { ok: false; message: string } };

export async function guard(projectId: string): Promise<Guarded> {
  if (!projectId) return { stop: { ok: false, message: "Missing project." } };

  const ctx = await getSessionContext();

  if (isClient(ctx)) {
    return { stop: { ok: false, message: "That isn't something your account can do." } };
  }
  if (ctx.showcase) {
    return {
      stop: {
        ok: false,
        message: "Showcase mode is read-only — exit showcase to make changes.",
      },
    };
  }
  if (!canWrite(ctx, "work") && !canWrite(ctx, "management")) {
    return {
      stop: {
        ok: false,
        message: "You need edit access to Work or Management to publish this.",
      },
    };
  }
  return { ctx };
}

/**
 * Both sides of every one of these rows, refreshed together.
 *
 * A milestone marked done changes what the CLIENT sees, and the client's pages
 * are server-rendered — revalidating only the member's own route would leave
 * the portal reading a stale plan until it happened to re-render. The portal's
 * pages are listed individually because they are separate routes with separate
 * caches; `/portal` is not a prefix wildcard.
 */
export function revalidateBoth(projectId: string) {
  revalidatePath(`/work/projects/${projectId}/client`);
  revalidatePath(`/work/projects/${projectId}`);
  revalidatePath("/portal");
  revalidatePath("/portal/progress");
  revalidatePath("/portal/finance");
}

/* ── Small validators, so a direct POST can't write nonsense ──────────────── */

/** Trimmed, capped, and null rather than "" — the columns are nullable text. */
export function text(value: unknown, max: number): string | null {
  const trimmed = String(value ?? "").trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

/** `YYYY-MM-DD` or null. Anything else is dropped rather than guessed at. */
export function date(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/** A money figure above zero, to two places, or null. */
export function amountOf(value: unknown): number | null {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

/**
 * A percentage, clamped into 0–100 and rounded to two places.
 *
 * Clamped rather than rejected: this is the number behind a bar a customer
 * reads, somebody will eventually paste 150 into it, and a check constraint
 * turning that into a red toast helps nobody. An empty field is 0, which is
 * what a blank weight means — "this phase hasn't been sized yet".
 */
export function percentOf(value: unknown, fallback = 0): number {
  const raw = String(value ?? "").replace(/,/g, ".").trim();
  if (raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(Math.min(100, Math.max(0, parsed)) * 100) / 100;
}

/** A positive whole number, capped — a count of payments to generate. */
export function countOf(value: unknown, max: number): number | null {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return null;
  const whole = Math.floor(parsed);
  return whole >= 1 ? Math.min(whole, max) : null;
}
