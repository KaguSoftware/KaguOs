/**
 * Query helpers that make a FAILED query fail loudly.
 *
 * ⚠️ The bug these exist to kill: every list query in this app used to destructure
 * ONLY `data` from an awaited query, then fall back to an empty array —
 *
 *     const { data } = await <query>
 *     const rows = (data ?? []) as Row[]
 *
 * which drops `error` on the floor. A missing column, an RLS block, or schema
 * drift after an unapplied migration then renders as a calm, believable EMPTY
 * STATE — "No ideas yet" and "the database rejected that query" look identical
 * on screen. That is exactly how the un-pushed 0014 migration became a
 * company-wide outage that presented as "no data".
 *
 * Wrapping a query in `selectOrThrow` turns that silence into a throw, which
 * the route's `error.tsx` boundary renders as a real failure naming the table
 * and the Postgres error.
 *
 * ── Why these wrap a QUERY and not a WAVE ──────────────────────────────────
 * The pages fire one big `Promise.all` per route, and the entries in it are not
 * uniform. Three shapes must survive untouched:
 *
 *   1. Membership gating: `canAccess(ctx, "work") ? query : null`. A `null`
 *      here means "not a member", which is a legitimate result, NOT an error.
 *      Only the query inside the truthy branch gets wrapped.
 *   2. Stand-ins: `Promise.resolve({ data: [] })` — not a Supabase builder at
 *      all, and has no `error` to check.
 *   3. Head-only counts: `select("id", { count: "exact", head: true })`, where
 *      `data` is null BY DESIGN and `count` carries the payload.
 *
 * So `selectOrThrow` returns the whole result object rather than just rows —
 * `count` survives — and is applied per query, never to the wave.
 *
 * ⚠️ These are plain async functions and MUST stay usable inside `Promise.all`.
 * Every performance property of this app rests on the one-wave-per-route shape
 * (see the comment at the top of the dashboard's wave). Wrap the builder, hand
 * the resulting promise to `Promise.all` as before — never `await` a query
 * above the wave to wrap it, which would serialise a ~305ms round-trip.
 */

/** The part of a Supabase result we care about — structural, so any builder fits. */
type QueryResult<T> = {
  data: T;
  error: { message: string; code?: string; details?: string | null } | null;
  count?: number | null;
};

/**
 * Await a Supabase query and throw if it failed.
 *
 * `label` names the thing being fetched and is the whole point: it turns an
 * opaque failure into "ideas: 42703 column ideas.project_id does not exist",
 * which is diagnosable from the error screen without opening a log.
 *
 * A `maybeSingle()` that matched no row is NOT a failure — it returns
 * `data: null, error: null` and passes straight through, so the existing
 * `if (!row) notFound()` checks keep working exactly as they do today.
 */
export async function selectOrThrow<T, R extends QueryResult<T>>(
  query: PromiseLike<R>,
  label: string
): Promise<R> {
  const result = await query;
  if (result.error) {
    const { code, message, details } = result.error;
    throw new Error(
      `${label}: ${code ? `${code} ` : ""}${message}${details ? ` (${details})` : ""}`
    );
  }
  return result;
}

/**
 * The common list case: throw on error, else the rows (never null).
 *
 * Use this wherever the old code read `(data ?? []) as Row[]`. Prefer
 * `selectOrThrow` when the caller needs `count` or a `maybeSingle()` row.
 */
export async function rowsOrThrow<T>(
  query: PromiseLike<QueryResult<T[] | null>>,
  label: string
): Promise<T[]> {
  const { data } = await selectOrThrow(query, label);
  return data ?? [];
}
