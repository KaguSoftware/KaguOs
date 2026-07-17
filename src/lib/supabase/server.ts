import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * The request's Supabase client. Wrapped in React cache() so every caller in a
 * request — layout, page, and the data helpers — shares ONE instance.
 *
 * That sharing is load-bearing, not just tidy: helpers like getMembersMap are
 * cache()-keyed on the client they're handed, so a fresh client per call would
 * silently miss those caches and re-run the same query on every caller.
 */
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — the proxy handles session refresh.
          }
        },
      },
    }
  );
});
