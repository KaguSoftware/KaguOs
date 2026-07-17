import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and this call — it refreshes the
  // auth token, and anything in between risks random logouts.
  //
  // getClaims() (not getUser()) is deliberate and load-bearing: it calls
  // getSession() internally, which reads the cookies and refreshes an expired
  // token exactly like getUser() did — but it then verifies the JWT LOCALLY
  // against the project's ES256 JWKS instead of paying an auth-server
  // round-trip. That round-trip cost ~305ms (Tokyo db) on EVERY request in the
  // app, serially, before any page could start rendering.
  //
  // The local path depends on the project using ASYMMETRIC (ES256) JWT keys.
  // If it ever reverts to a legacy HS256 shared secret, getClaims() falls back
  // to a network getUser() on its own — correct, just slower again.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims.sub ? claims.claims : null;

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
