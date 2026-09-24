"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bug,
  ChevronRight,
  Contact as ContactIcon,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  accentForPath,
  accentMix,
  accentVar,
  type AccentKey,
} from "@/lib/section-accent";
import { SIDEBAR_COOKIE, SIDEBAR_COOKIE_MAX_AGE } from "@/lib/sidebar-pref";
import { istanbulGreeting } from "@/lib/greeting";
import { RiseText } from "@/components/ui/rise-text";
import type { Section } from "@/lib/types";
import { signOut } from "@/lib/actions/account";
import { Logo } from "@/components/shell/logo";
import { NotificationBell } from "@/components/shell/notification-bell";
import {
  SidebarPresence,
  StatusButton,
  TeamSheet,
} from "@/components/shell/sidebar-presence";
import { useLivePresence } from "@/lib/use-live-presence";
import type { Pulse } from "@/lib/data/pulse";
import type { MembersMap, Notification, PresencePerson } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section?: Section;
  adminOnly?: boolean;
  /** The selected-state colour. One hue per section, so the tab you're on is
      identifiable by colour alone, before you've read the label. The values
      live in globals.css; this is only the key — see lib/section-accent.ts. */
  accent: AccentKey;
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, accent: "dashboard" },
  { href: "/work", label: "Work", icon: FolderKanban, section: "work", accent: "work" },
  { href: "/learn", label: "Learn", icon: GraduationCap, section: "learn", accent: "learn" },
  {
    href: "/management/finance",
    label: "Management",
    icon: Landmark,
    section: "management",
    accent: "management",
  },
  { href: "/debug", label: "Debug", icon: Bug, section: "debug", accent: "debug" },
  {
    href: "/testing",
    label: "Testing",
    icon: FlaskConical,
    section: "testing",
    accent: "testing",
  },
  // Chat has its own gate (0052) — the same audience the presence panel shows.
  {
    href: "/messages",
    label: "Messages",
    icon: MessagesSquare,
    section: "chat",
    accent: "messages",
  },
  {
    href: "/marketing",
    label: "Marketing",
    icon: Megaphone,
    section: "marketing",
    accent: "marketing",
  },
  { href: "/comms", label: "Comms", icon: ContactIcon, section: "comms", accent: "comms" },
];

/** Admin is gated, so it lives outside NAV — but both the rail and the mobile
    board render it, so it's defined once here. */
const ADMIN_ITEM: NavItem = {
  href: "/admin",
  label: "Admin",
  icon: ShieldCheck,
  accent: "admin",
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  const root = href.split("/").slice(0, 2).join("/");
  return pathname === href || pathname.startsWith(root + "/") || pathname === root;
}

function NavLink({
  item,
  pathname,
  badge,
  collapsed,
  folding,
  index = 0,
}: {
  item: NavItem;
  pathname: string;
  /** Position in the rail — staggers the label's rise on first paint. */
  index?: number;
  /** Unread count pill, right-aligned. Hidden at 0/null — a permanent "0" is noise. */
  badge?: number | null;
  /** Icon-only rail: the label moves into the tooltip, the count becomes a dot. */
  collapsed?: boolean;
  /** The rail is about to collapse — the label sinks out first. */
  folding?: boolean;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const unread = typeof badge === "number" && badge > 0 ? badge : null;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      // The label is the accessible name in both states; collapsed it also
      // becomes the native tooltip, so the rail stays learnable by hover.
      aria-label={item.label}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative flex items-center overflow-hidden rounded-md py-1.5 text-sm transition-colors duration-150",
        collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
        active ? "text-ink" : "text-muted hover:bg-raised/60 hover:text-ink"
      )}
    >
      {/* The accent only exists while selected — an always-coloured rail would
          be a rainbow, and the point is to mark ONE row. It wipes in from the
          left each time the row BECOMES active (mounting is the trigger), so
          moving between sections draws the eye to where you landed. */}
      {active && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 origin-left motion-safe:animate-[wipe-x_360ms_var(--ease-mac)_both]"
          style={{ backgroundColor: accentMix(item.accent, 16) }}
        />
      )}
      <span className={cn("relative", collapsed && "grid size-5 place-items-center")}>
        <Icon
          className="size-4"
          style={active ? { color: accentVar(item.accent) } : undefined}
          aria-hidden
        />
        {/* Collapsed there's no room for a count, but silence would be worse
            than imprecision — an unread dot still says "something's waiting". */}
        {collapsed && unread !== null && (
          <span
            className="absolute -right-1 -top-1 size-2 rounded-full bg-primary ring-2 ring-surface"
            aria-hidden
          />
        )}
      </span>
      {/* Labels rise out of their row in turn on first paint and on every
          expand — the rail persists across navigations, so never per click. */}
      {!collapsed && (
        <RiseText duration={600} className="relative" delay={index * 40 + 120} folding={folding}>
          {item.label}
        </RiseText>
      )}
      {!collapsed && unread !== null && (
        <span className="relative ml-auto rounded-full bg-primary px-1.5 font-mono text-[calc(11px*var(--text-scale,1))] font-medium text-primary-ink">
          {unread}
        </span>
      )}
      {collapsed && unread !== null && (
        <span className="sr-only">{unread} unread</span>
      )}
    </Link>
  );
}

/** Keep in sync with line-sink's duration on <RiseText folding>. */
const FOLD_MS = 150;

/** Keep in sync with the sheet-out / overlay-out durations in globals.css. */
const EXIT_MS = 180;

/**
 * The mobile menu — a full-screen board, not a list of destinations.
 *
 * The old mobile bar was a horizontally-scrolling nav strip: sections past the
 * third were invisible, and account/search/status had nowhere to live. The
 * obvious replacement is a drawer of rows, but every app has that and it
 * answers only "where do you want to go?".
 *
 * This answers "what's going on?" too. It's styled after React Bits'
 * StaggeredMenu: the section's hue wipes in, then each destination rises as a
 * big line of type, and a section with work in it carries its LIVE number
 * (9 open, 3 unread) as a superscript in its own colour. Navigation is still
 * one tap, and the numbers cost no extra round-trip (see lib/data/pulse.ts —
 * it rides in the layout's existing presence wave).
 *
 * Portaled, with the app's standard dismissal contract (backdrop, Escape,
 * scroll lock) and a real exit animation on every path out.
 */
function MobileMenu({
  visible,
  isAdmin,
  pathname,
  name,
  email,
  pulse,
  presence,
  meId,
  unreadMessages,
  canStatus,
  onClose,
}: {
  visible: NavItem[];
  isAdmin: boolean;
  pathname: string;
  name: string | null;
  email: string;
  pulse: Pulse;
  presence: PresencePerson[] | null;
  meId: string;
  unreadMessages: number | null;
  /** Status-section access — without it there's no "who's online" row. */
  canStatus: boolean;
  onClose: () => void;
}) {
  // The sheet has to outlive the "close" click long enough to animate out, so
  // dismissal is a two-step: mark it closing, let the exit animation run, then
  // unmount. EVERY dismissal path goes through `close()` — backdrop, the X,
  // Escape, and following a link — or the sheet would snap away on one of them
  // and feel broken next to the others.
  const [closing, setClosing] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  const close = useCallback(() => {
    setClosing((already) => {
      if (already) return already;
      // Matches sheet-out's duration below. Reduced-motion users have all
      // animations collapsed to ~0ms globally, so this just fires immediately.
      window.setTimeout(onClose, EXIT_MS);
      return true;
    });
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  const items: NavItem[] = isAdmin
    ? [...visible, ADMIN_ITEM]
    : visible;

  const firstName = name?.split(" ")[0] ?? "";
  const overdue = pulse.overdue;

  // The entrance wipe is the hue of the section you opened the menu FROM, so
  // it says where you are as it plays. Portaled outside SectionAccentScope, so
  // it's resolved from the path rather than read from --section-accent.
  const here = accentForPath(pathname);
  const wipe = here
    ? accentMix(here, 55)
    : "color-mix(in oklch, var(--primary-dim) 55%, transparent)";

  // Clock read ONCE on mount, not during render — `Date.now()` in a render body
  // is impure (the sheet is short-lived, so a ticking clock would buy nothing
  // and cost re-renders). Same lazy-initializer pattern as sidebar-presence.
  const [now] = useState(() => Date.now());
  const greeting = istanbulGreeting(now);

  // Who's actually around — the LIVE presence channel, same signal as the
  // desktop panel and the team sheet. This used to be guessed from
  // last_seen_at, which is a DB stamp throttled to one write per 5 minutes
  // (see lib/data/session.ts) and frozen at the layout's render — so on a
  // phone the row said "Nobody online" mid-conversation. The stamp survives
  // only as a bridge for the moments before the channel's first sync (an
  // empty map can't tell "still connecting" from "everyone left").
  const live = useLivePresence(meId);
  const synced = Object.keys(live).length > 0;
  const online = (presence ?? []).filter((p) =>
    synced
      ? live[p.id] === "online"
      : p.last_seen_at && now - Date.parse(p.last_seen_at) < 5 * 60 * 1000
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-50 md:hidden"
    >
      <button
        type="button"
        aria-label="Close menu"
        onClick={close}
        className={cn(
          "absolute inset-0 cursor-default bg-bg/70 backdrop-blur-sm",
          closing
            ? "motion-safe:animate-[overlay-out_180ms_var(--ease-mac)_both]"
            : "motion-safe:animate-[overlay-in_150ms_var(--ease-mac)_both]"
        )}
      />

      {/* Two layers wipe in from the right a beat ahead of the surface — the
          section's hue, then a neutral — so the menu arrives in layers rather
          than all at once. Hidden outright for reduced motion: they'd only
          flash. */}
      {[wipe, "var(--raised)"].map((bg, i) => (
        <div
          key={i}
          aria-hidden
          style={{ backgroundColor: bg, animationDelay: closing ? "0ms" : `${i * 50}ms` }}
          className={cn(
            "pointer-events-none absolute inset-0 motion-reduce:hidden",
            closing
              ? "animate-[panel-out_180ms_var(--ease-mac-in)_both]"
              : "animate-[wipe-in_300ms_var(--ease-mac)_both]"
          )}
        />
      ))}

      <div
        style={{ animationDelay: closing ? "0ms" : "80ms" }}
        className={cn(
          "absolute inset-0 flex flex-col overflow-hidden bg-bg",
          // Slides in over the wipe from the same edge, and every exit sends
          // the whole stack back out that way together.
          closing
            ? "motion-safe:animate-[panel-out_180ms_var(--ease-mac-in)_both]"
            : "motion-safe:animate-[panel-in_360ms_var(--ease-mac)_both]"
        )}
      >
        {/* Two soft brand glows give the screen a light source, so the grid
            sits IN something rather than on flat black. Pointer-events-none so
            they never eat a tap. */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-24 size-72 rounded-full bg-info/8 blur-3xl"
          aria-hidden
        />

        <div className="relative flex items-start justify-between px-5 pb-4 pt-5">
          <div className="min-w-0">
            {/* Rises out of its own line box — the mask is the overflow-hidden
                parent; pb gives descenders room so the mask doesn't clip them. */}
            <p className="overflow-hidden pb-0.5 text-[calc(22px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
              <span className="block origin-bottom motion-safe:animate-[line-rise_600ms_var(--ease-mac)_120ms_both]">
                {greeting}
                {firstName ? `, ${firstName}` : ""}
              </span>
            </p>
            {/* The one line that's about YOU, not about navigation. */}
            <p className="mt-0.5 text-[calc(13px*var(--text-scale,1))] text-muted">
              {overdue > 0 ? (
                <span className="text-danger">
                  {overdue} overdue {overdue === 1 ? "task" : "tasks"}
                </span>
              ) : (
                "Nothing overdue. Nice."
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="-mr-1 shrink-0 rounded-full border border-line bg-surface/70 p-2.5 text-muted transition-[color,background-color,transform] duration-150 ease-mac hover:text-ink active:scale-90"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* StaggeredMenu's list: each section a big line of type that rises
            out of its own mask, one after another. The live number rides as a
            superscript in the section's hue — only when there's work in it, so
            the list still says what's going on, not just where to go. */}
        <nav className="relative flex-1 overflow-y-auto px-5 pb-4 pt-2" aria-label="Sections">
          <ul className="flex flex-col gap-1.5">
            {items.map((item, i) => {
              const active = isActive(pathname, item.href);
              // Messages shares Work's SECTION gate but not its numbers — it
              // carries the unread count, not the project count.
              const stat =
                item.href === "/messages"
                  ? unreadMessages
                    ? { value: unreadMessages, label: "unread", weight: unreadMessages }
                    : undefined
                  : item.section
                    ? pulse.stats[item.section]
                    : undefined;
              const loud = stat && stat.weight > 0 ? stat : null;
              return (
                // pb gives descenders room so the mask doesn't clip them.
                <li key={item.href} className="overflow-hidden pb-0.5">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={close}
                    style={{
                      animationDelay: `${Math.min(i, 9) * 45 + 160}ms`,
                      ...(active ? { color: accentVar(item.accent) } : null),
                    }}
                    className={cn(
                      "group inline-flex origin-bottom items-start gap-1.5 pr-8 leading-none",
                      "text-[calc(clamp(30px,10vw,44px)*var(--text-scale,1))] font-semibold uppercase tracking-[-0.045em]",
                      "transition-[color,transform] duration-150 ease-mac active:scale-[0.98]",
                      "motion-safe:animate-[line-rise_650ms_var(--ease-mac)_both]",
                      !active && "text-ink"
                    )}
                  >
                    {/* Hover borrows the destination's hue — it previews
                        where you're about to go. */}
                    <span
                      className="transition-colors duration-150 group-hover:text-(--hover)"
                      style={{ ["--hover" as string]: accentVar(item.accent) }}
                    >
                      {item.label}
                    </span>
                    {loud && (
                      <span
                        className="mt-[0.1em] font-mono text-[calc(13px*var(--text-scale,1))] font-medium tracking-normal tabular-nums"
                        style={{ color: accentVar(item.accent) }}
                      >
                        {loud.value}
                        <span className="sr-only"> {loud.label}</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Search + who's around + you. The utility rail. */}
        <div className="relative border-t border-line/60 bg-surface/40 px-4 pb-5 pt-3 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => {
              close();
              window.dispatchEvent(new Event("open-command-palette"));
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-raised/60 px-3.5 py-3 text-[calc(14px*var(--text-scale,1))] text-faint transition-[color,border-color,transform] duration-150 ease-mac hover:border-line-strong hover:text-muted active:scale-[0.99]"
          >
            <Search className="size-4" aria-hidden />
            Search anything…
          </button>

          {/* Tap the faces to see everyone's status — the desktop panel does
              this with hover cards, which don't exist on touch. */}
          {canStatus && presence && presence.length > 0 && (
            <button
              type="button"
              onClick={() => setTeamOpen(true)}
              className="mt-3 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-[background-color,transform] duration-150 ease-mac hover:bg-raised/60 active:scale-[0.99]"
            >
              <span className="flex -space-x-1.5">
                {(online.length > 0 ? online : presence).slice(0, 5).map((p) => (
                  <span
                    key={p.id}
                    style={{ backgroundColor: p.color }}
                    className="grid size-6 place-items-center rounded-full border-2 border-bg text-[calc(9px*var(--text-scale,1))] font-semibold text-bg"
                    aria-hidden
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              </span>
              <span className="min-w-0 flex-1 text-[calc(12px*var(--text-scale,1))] text-faint">
                {online.length > 0
                  ? `${online.length} online now`
                  : "Nobody online"}
              </span>
              <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
            </button>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Link
              href="/account"
              onClick={close}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2 transition-[background-color,transform] duration-150 ease-mac hover:bg-raised/60 active:scale-[0.99]"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-raised text-[calc(11px*var(--text-scale,1))] font-medium text-muted">
                {(name || email).slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[calc(13px*var(--text-scale,1))] font-medium text-ink">
                  {name || email}
                </span>
                <span className="block truncate text-[calc(11px*var(--text-scale,1))] text-faint">
                  Account & status
                </span>
              </span>
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="rounded-xl border border-line p-3 text-muted transition-[color,border-color,transform] duration-150 ease-mac hover:border-danger/40 hover:text-danger active:scale-95"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </div>

      {teamOpen && presence && (
        <TeamSheet
          people={presence}
          meId={meId}
          onClose={() => setTeamOpen(false)}
        />
      )}
    </div>,
    document.body
  );
}

export function Sidebar({
  sections,
  isAdmin,
  showcase,
  name,
  email,
  notifications,
  members,
  presence,
  pulse,
  meId,
  unreadMessages,
  defaultCollapsed,
  canStatus,
}: {
  sections: Section[];
  isAdmin: boolean;
  showcase: boolean;
  name: string | null;
  email: string;
  notifications: Notification[];
  members: MembersMap;
  /** Team presence for the always-open panel; null when unavailable (showcase / no Work access). */
  presence: PresencePerson[] | null;
  /** Live section counts for the mobile menu's tiles. */
  pulse: Pulse;
  meId: string;
  /** Unread chat messages (direct + group); null outside the chat audience. */
  unreadMessages: number | null;
  /** Read from the cookie in the layout, so the rail's FIRST paint is already right. */
  defaultCollapsed: boolean;
  /** Status-section access (0052): live dots, statuses, and the status editor. */
  canStatus: boolean;
}) {
  const pathname = usePathname();
  const visible = NAV.filter(
    (item) => !item.section || isAdmin || showcase || sections.includes(item.section)
  );
  const [menuOpen, setMenuOpen] = useState(false);

  // Desktop only — the mobile sheet is a separate, full-screen thing and has
  // nothing to collapse. Seeded from the cookie so there's no expand-then-snap
  // on load (see lib/sidebar-pref.ts for why this isn't localStorage).
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // Collapse is two steps: the labels sink into their masks (`folding`), THEN
  // the width goes — shrinking first would crush the text mid-animation.
  // Expanding needs no step: labels mount as the rail widens and rise on their
  // own. `sweep` re-keys the accent layer so it replays on every toggle.
  const [folding, setFolding] = useState(false);
  const [sweep, setSweep] = useState(0);
  const setRail = useCallback((next: boolean) => {
    const commit = () => {
      setFolding(false);
      setCollapsed(next);
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`;
    };
    setSweep((n) => n + 1);
    if (next && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFolding(true);
      window.setTimeout(commit, FOLD_MS);
    } else {
      commit();
    }
  }, []);
  const railAccent = accentForPath(pathname) ?? "dashboard";

  // Navigating closes the sheet — otherwise it stays open over the page you
  // just asked for, which reads as a broken tap.
  //
  // Reset DURING RENDER against the previous pathname, not in an effect: an
  // effect would commit the open sheet over the new page for a frame first.
  // Same pattern as board.tsx / reminders.tsx (see the prop-adoption notes).
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setMenuOpen(false);
  }

  return (
    <>
      {/* Desktop sidebar. Collapsed it keeps every destination reachable —
          icons stay, labels move into tooltips — so it's a narrower rail, not
          a hidden menu. Only the width animates; nothing slides, because the
          content column reflowing beside it is already the motion. */}
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface md:flex",
          "transition-[width] duration-300 ease-mac motion-reduce:transition-none",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* The section's hue draws across the rail on every toggle. Its own
            clipping wrapper — overflow-hidden on the aside would clip the
            notification popover. */}
        {sweep > 0 && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <span
              key={sweep}
              className="absolute inset-0 origin-left motion-safe:animate-[rail-sweep_520ms_var(--ease-mac)_both] motion-reduce:hidden"
              style={{ backgroundColor: accentMix(railAccent, 22) }}
            />
          </div>
        )}
        <div
          className={cn(
            "relative flex items-center pb-5 pt-5",
            collapsed ? "flex-col gap-3 px-2" : "justify-between px-4"
          )}
        >
          <Link
            href="/"
            aria-label="KaguOs — go to dashboard"
            title={collapsed ? "KaguOs — go to dashboard" : undefined}
            className="flex items-center gap-2.5 rounded-md transition-opacity duration-150 hover:opacity-80"
          >
            <Logo size={24} />
            {!collapsed && (
              <RiseText duration={600} className="relative" delay={60} folding={folding}>
                <span className="text-[calc(15px*var(--text-scale,1))] font-semibold tracking-tight">KaguOs</span>
              </RiseText>
            )}
          </Link>
          <div className={cn("flex items-center", collapsed ? "flex-col gap-1" : "gap-0.5")}>
            <NotificationBell
              notifications={notifications}
              members={members}
              align="left"
            />
            {/* Sits with the bell, at the top of the rail — the two controls
                that act on the sidebar itself, rather than on a destination. */}
            <button
              type="button"
              onClick={() => setRail(!collapsed)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="shrink-0 rounded-md p-1.5 text-faint transition-colors duration-150 hover:bg-raised hover:text-ink"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" aria-hidden />
              ) : (
                <PanelLeftClose className="size-4" aria-hidden />
              )}
            </button>
          </div>
        </div>
        <div className={cn("pb-2", collapsed ? "px-2" : "px-2")}>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            aria-label="Search"
            title={collapsed ? "Search  ⌘K" : undefined}
            className={cn(
              "flex w-full items-center rounded-md border border-line py-1.5 text-[calc(13px*var(--text-scale,1))] text-faint transition-colors duration-150 hover:border-line-strong hover:text-muted",
              collapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
            )}
          >
            <Search className="size-3.5" aria-hidden />
            {!collapsed && (
              <>
                <RiseText duration={600} className="relative" delay={90} folding={folding}>Search…</RiseText>
                <kbd className="ml-auto rounded border border-line px-1 font-mono text-[calc(10px*var(--text-scale,1))]">
                  ⌘K
                </kbd>
              </>
            )}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 px-2" aria-label="Sections">
          {visible.map((item, i) => (
            <NavLink
              key={item.href}
              item={item}
              index={i}
              pathname={pathname}
              badge={item.href === "/messages" ? unreadMessages : null}
              collapsed={collapsed}
              folding={folding}
            />
          ))}
          {isAdmin && (
            <>
              <hr className="my-2 border-line" />
              <NavLink
                item={ADMIN_ITEM}
                index={visible.length}
                pathname={pathname}
                collapsed={collapsed}
                folding={folding}
              />
            </>
          )}
        </nav>
        {presence && presence.length > 0 && (
          <SidebarPresence
            people={presence}
            meId={meId}
            collapsed={collapsed}
            onExpand={() => setRail(false)}
            canStatus={canStatus}
          />
        )}
        <div
          className={cn(
            "flex items-center border-t border-line",
            collapsed ? "flex-col gap-1 p-2" : "gap-2 p-3"
          )}
        >
          <Link
            href="/account"
            aria-label={`Account — ${name || email}`}
            title={collapsed ? `${name || email} — account` : undefined}
            className={cn(
              "rounded-md transition-colors duration-150 hover:bg-raised",
              collapsed
                ? "grid size-9 place-items-center text-[calc(11px*var(--text-scale,1))] font-medium text-muted"
                : "min-w-0 flex-1 px-2 py-1.5"
            )}
          >
            {collapsed ? (
              (name || email).slice(0, 2).toUpperCase()
            ) : (
              <>
                <RiseText duration={600} className="relative" delay={visible.length * 40 + 200} folding={folding}>
                  <span className="block truncate text-[calc(13px*var(--text-scale,1))] font-medium text-ink">
                    {name || email}
                  </span>
                </RiseText>
                <RiseText duration={600} className="relative" delay={visible.length * 40 + 240} folding={folding}>
                  <span className="block truncate text-xs text-faint">{email}</span>
                </RiseText>
              </>
            )}
          </Link>
          {/* Sign-out is destructive and lives behind the label when the rail
              is narrow — a lone icon next to the avatar is too easy to mis-tap. */}
          {!collapsed && (
            <form action={signOut}>
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="rounded-md p-2 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex flex-col border-b border-line bg-surface md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href="/"
            aria-label="KaguOs — go to dashboard"
            className="flex items-center gap-2.5 rounded-md transition-opacity duration-150 hover:opacity-80"
          >
            <Logo size={22} />
            <span className="text-[calc(15px*var(--text-scale,1))] font-semibold tracking-tight">KaguOs</span>
          </Link>
          <div className="flex items-center gap-1">
            {canStatus && presence && presence.length > 0 && (
              <StatusButton people={presence} meId={meId} />
            )}
            <NotificationBell notifications={notifications} members={members} />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="rounded-md p-1.5 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu — a real sheet, not a scrolling strip. The old top bar put
          every section in a horizontally-scrolling row, so sections past the
          third were invisible unless you thought to swipe, and there was no room
          for account, sign-out or presence. A drawer gives each destination a
          full-width row and somewhere for the rest to live. */}
      {menuOpen && (
        <MobileMenu
          visible={visible}
          isAdmin={isAdmin}
          pathname={pathname}
          name={name}
          email={email}
          pulse={pulse}
          presence={presence}
          meId={meId}
          unreadMessages={unreadMessages}
          canStatus={canStatus}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </>
  );
}
