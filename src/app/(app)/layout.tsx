import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext, getUserId } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { getPresence } from "@/lib/data/presence";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { Sidebar } from "@/components/shell/sidebar";
import { CommandPalette } from "@/components/shell/command-palette";
import { ShowcaseBanner } from "@/components/shell/showcase";
import { ToastProvider } from "@/components/ui/toast";
import type { Notification } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The user id comes from the LOCALLY-verified JWT, so it costs nothing and is
  // available before the profile lookup returns. That lets the notifications
  // query — which only needs the id — start in the same wave as the session
  // fetch instead of waiting a full round-trip behind it.
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect("/login");

  // One wave: the profile lookup, the notifications, and the members map all
  // fly together. getMembersMap is cache()-deduped against the page's own call.
  const [ctx, { data: notifRows }, members] = await Promise.all([
    getSessionContext(),
    supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    getMembersMap(supabase),
  ]);

  // Presence for the always-open sidebar panel (needs ctx for access/showcase
  // gating). cache()-deduped, so a page that also reads it pays nothing.
  const presence = await getPresence(ctx);

  return (
    <ToastProvider>
      {/*
        Skip link — the first tab stop on every page. Without it a keyboard user
        tabs through all six section links, search, the bell, and the account row
        before reaching the content, on EVERY navigation. Invisible until
        focused, so it costs sighted users nothing.
      */}
      <a
        href="#main"
        className="sr-only left-4 top-4 z-50 rounded-md border border-line-strong bg-raised px-3 py-2 text-[13px] text-ink focus-visible:not-sr-only focus-visible:fixed"
      >
        Skip to content
      </a>
      <CommandPalette
        sections={[...ctx.sections]}
        isAdmin={ctx.isAdmin}
        showcase={ctx.showcase}
      />
      {/* App-wide live updates: the notification bell and team presence refresh
          the moment a notification lands or someone changes status. Skipped in
          showcase — notifications are hidden and presence is demo-irrelevant. */}
      {!ctx.showcase && <LiveRefresh tables={["notifications", "profiles"]} />}
      <div className="flex min-h-dvh flex-col md:flex-row">
        <Sidebar
          sections={[...ctx.sections]}
          isAdmin={ctx.isAdmin}
          showcase={ctx.showcase}
          name={ctx.profile.full_name}
          email={ctx.profile.email}
          // Notifications have no demo equivalent (no is_demo column) and carry
          // real titles/actors, so they're hidden entirely while showcasing —
          // a client demo must never surface the team's real activity.
          notifications={ctx.showcase ? [] : ((notifRows ?? []) as Notification[])}
          members={members}
          presence={presence}
          meId={ctx.userId}
        />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          {ctx.showcase && <ShowcaseBanner />}
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
