import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SIDEBAR_COOKIE } from "@/lib/sidebar-pref";
import { canAccess, canWrite, getSessionContext, getUserId } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { getPresence } from "@/lib/data/presence";
import { getPulse } from "@/lib/data/pulse";
import { getInboxSummary, totalUnread } from "@/lib/data/messages";
import { selectOrThrow } from "@/lib/data/query";
import { ChatLiveRefresh } from "@/components/shell/chat-live-refresh";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { Sidebar } from "@/components/shell/sidebar";
import { CommandPalette } from "@/components/shell/command-palette";
import { ShowcaseBanner } from "@/components/shell/showcase";
import { ToastProvider } from "@/components/ui/toast";
import { TitleUnread } from "@/components/shell/title-unread";
import { UnreadDmPopups } from "@/components/shell/unread-dm-popups";
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

  // Rail width, read server-side so the first paint is already correct — see
  // lib/sidebar-pref.ts. cookies() is already resolved for this request by the
  // Supabase client above, so this costs nothing.
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  // One wave: the profile lookup, the notifications, and the members map all
  // fly together. getMembersMap is cache()-deduped against the page's own call.
  const [ctx, { data: notifRows }, members] = await Promise.all([
    getSessionContext(),
    selectOrThrow(
      supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
      "notifications"
    ),
    getMembersMap(supabase),
  ]);

  // Presence for the always-open sidebar panel + the mobile menu's live tile
  // counts. Both need ctx (access/showcase gating), both are cache()-deduped,
  // and they fly TOGETHER — so the pulse costs no extra round-trip.
  const [presence, pulse, inbox] = await Promise.all([
    getPresence(ctx),
    getPulse(ctx),
    // Feeds BOTH the unread-DM popups below and the Messages nav badge, which is
    // derived from it rather than queried separately — see totalUnread. cache()-
    // deduped against any page that also calls getInboxSummary this request.
    getInboxSummary(ctx),
  ]);
  // Same audience gate as presence, so it's null (and the badge silent) exactly
  // where the panel is absent.
  const unreadMessages = totalUnread(inbox);

  // Minimal, privacy-conscious slice for the popups — sender + preview only,
  // never the group chat (that's the sidebar badge's job, not a popup's).
  const unreadDMs =
    ctx.showcase || !inbox
      ? []
      : Object.entries(inbox.direct)
          .filter(([, t]) => t.unread > 0)
          .map(([partnerId, t]) => ({
            partnerId,
            lastBody: t.last.body,
            lastAt: t.last.created_at,
          }));

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
        writeSections={[...ctx.sections].filter((s) => canWrite(ctx, s))}
        isAdmin={ctx.isAdmin}
        showcase={ctx.showcase}
      />
      {/* App-wide live updates: the notification bell and team presence refresh
          the moment a notification lands or someone changes status. Skipped in
          showcase — notifications are hidden and presence is demo-irrelevant.

          The chat tables are watched SEPARATELY, because a refresh must not fire
          for the thread the user is currently reading — that thread patches
          itself in place. See chat-live-refresh.tsx. */}
      {!ctx.showcase && (
        <>
          <LiveRefresh tables={["notifications", "profiles"]} />
          <ChatLiveRefresh meId={ctx.userId} />
        </>
      )}
      {!ctx.showcase && (
        <UnreadDmPopups threads={unreadDMs} members={members} />
      )}
      {/* Unread in the tab title — this app lives in a background tab, where the
          sidebar badge can't be seen. */}
      {!ctx.showcase && <TitleUnread count={unreadMessages ?? 0} />}
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
          pulse={pulse}
          meId={ctx.userId}
          unreadMessages={unreadMessages}
          defaultCollapsed={sidebarCollapsed}
          canStatus={canAccess(ctx, "status")}
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
