"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bug,
  ChevronRight,
  Contact as ContactIcon,
  FolderKanban,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  Search,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Section } from "@/lib/types";
import { signOut } from "@/lib/actions/account";
import { Logo } from "@/components/shell/logo";
import { NotificationBell } from "@/components/shell/notification-bell";
import {
  SidebarPresence,
  StatusButton,
  TeamSheet,
} from "@/components/shell/sidebar-presence";
import type { Pulse } from "@/lib/data/pulse";
import type { MembersMap, Notification, PresencePerson } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section?: Section;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/work", label: "Work", icon: FolderKanban, section: "work" },
  { href: "/learn", label: "Learn", icon: GraduationCap, section: "learn" },
  {
    href: "/management/finance",
    label: "Management",
    icon: Landmark,
    section: "management",
  },
  { href: "/debug", label: "Debug", icon: Bug, section: "debug" },
  // Chat shares Work's gate — the same audience the presence panel shows.
  { href: "/messages", label: "Messages", icon: MessagesSquare, section: "work" },
  { href: "/marketing", label: "Marketing", icon: Megaphone, section: "marketing" },
  { href: "/comms", label: "Comms", icon: ContactIcon, section: "comms" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  const root = href.split("/").slice(0, 2).join("/");
  return pathname === href || pathname.startsWith(root + "/") || pathname === root;
}

function NavLink({
  item,
  pathname,
  badge,
}: {
  item: NavItem;
  pathname: string;
  /** Unread count pill, right-aligned. Hidden at 0/null — a permanent "0" is noise. */
  badge?: number | null;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150",
        active
          ? "bg-raised text-ink"
          : "text-muted hover:bg-raised/60 hover:text-ink"
      )}
    >
      <Icon className={cn("size-4", active && "text-primary-dim")} aria-hidden />
      {item.label}
      {typeof badge === "number" && badge > 0 && (
        <span className="ml-auto rounded-full bg-primary px-1.5 font-mono text-[11px] font-medium text-primary-ink">
          {badge}
        </span>
      )}
    </Link>
  );
}

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
 * This answers "what's going on?" instead. Each section is a tile carrying its
 * LIVE number (9 open, 2 projects, 1 sprint), and **a section with work in it
 * spans the full width** — so the grid physically reshapes to the state of the
 * company. It looks different on a Monday than a Friday, which is the bit a
 * nav list can never do. Navigation is still one tap, and the numbers cost no
 * extra round-trip (see lib/data/pulse.ts — it rides in the layout's existing
 * presence wave).
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
    ? [...visible, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : visible;

  const firstName = name?.split(" ")[0] ?? "";
  const overdue = pulse.overdue;

  // Clock read ONCE on mount, not during render — `Date.now()` in a render body
  // is impure (the sheet is short-lived, so a ticking clock would buy nothing
  // and cost re-renders). Same lazy-initializer pattern as sidebar-presence.
  const [now] = useState(() => Date.now());

  // Istanbul, not the device: the whole team shares one working day, and a
  // teammate travelling shouldn't be greeted "evening" at 10am in Kadıköy.
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "numeric",
      hour12: false,
    }).format(new Date(now))
  );
  const greeting =
    hour < 5 ? "Still up" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  // Who's actually around. Presence is null outside Work / in showcase.
  const online = (presence ?? []).filter(
    (p) => p.last_seen_at && now - Date.parse(p.last_seen_at) < 5 * 60 * 1000
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

      <div
        className={cn(
          "absolute inset-0 flex flex-col overflow-hidden bg-bg/95 backdrop-blur-xl",
          // Full-screen, so it grows from the page rather than sliding in from
          // an edge it no longer has.
          closing
            ? "motion-safe:animate-[overlay-out_180ms_var(--ease-mac)_both]"
            : "motion-safe:animate-[overlay-in_260ms_var(--ease-mac)_both]"
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
            <p className="text-[22px] font-semibold tracking-tight text-ink">
              {greeting}
              {firstName ? `, ${firstName}` : ""}
            </p>
            {/* The one line that's about YOU, not about navigation. */}
            <p className="mt-0.5 text-[13px] text-muted">
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

        {/* The tiles. Each carries its section's LIVE number, and a section
            with work in it spans two columns — so the grid physically reshapes
            to the state of the company instead of being a fixed list. That's
            the thing you can't get from a nav strip. */}
        <nav
          className="relative grid flex-1 auto-rows-min grid-cols-2 content-start gap-2.5 overflow-y-auto px-4 pb-2"
          aria-label="Sections"
        >
          {items.map((item, i) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            // Messages shares Work's SECTION gate but not its numbers — its
            // tile carries the unread count, not the project count.
            const stat =
              item.href === "/messages"
                ? unreadMessages
                  ? { value: unreadMessages, label: "unread", weight: unreadMessages }
                  : undefined
                : item.section
                  ? pulse.stats[item.section]
                  : undefined;
            const loud = (stat?.weight ?? 0) > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={close}
                style={{ animationDelay: `${Math.min(i, 7) * 30 + 60}ms` }}
                className={cn(
                  "group relative flex min-h-28 flex-col justify-between overflow-hidden rounded-2xl border p-3.5",
                  "transition-[border-color,background-color,transform] duration-200 ease-mac active:scale-[0.97]",
                  "motion-safe:animate-[tile-in_320ms_var(--ease-mac)_both]",
                  // A busy section earns the full width.
                  loud && "col-span-2",
                  active
                    ? "border-primary/40 bg-primary/10"
                    : "border-line bg-surface/70 hover:border-line-strong"
                )}
              >
                {active && (
                  <span
                    className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/20 blur-2xl"
                    aria-hidden
                  />
                )}
                <span className="relative flex items-center justify-between">
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-xl transition-colors duration-200",
                      active
                        ? "bg-primary/20 text-primary-dim"
                        : "bg-raised/80 text-faint group-hover:text-muted"
                    )}
                    aria-hidden
                  >
                    <Icon className="size-4.5" />
                  </span>
                  <ChevronRight
                    className="size-4 -translate-x-1 text-faint opacity-0 transition-[opacity,transform] duration-200 ease-mac group-hover:translate-x-0 group-hover:opacity-100"
                    aria-hidden
                  />
                </span>
                <span className="relative mt-3 block">
                  <span
                    className={cn(
                      "block text-[15px] font-medium",
                      active ? "text-ink" : "text-muted group-hover:text-ink"
                    )}
                  >
                    {item.label}
                  </span>
                  {stat && (
                    <span className="mt-0.5 flex items-baseline gap-1.5">
                      <span
                        className={cn(
                          "font-mono text-[19px] font-medium tabular-nums",
                          loud ? "text-ink" : "text-faint"
                        )}
                      >
                        {stat.value}
                      </span>
                      <span className="text-[12px] text-faint">
                        {stat.label}
                      </span>
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Search + who's around + you. The utility rail. */}
        <div className="relative border-t border-line/60 bg-surface/40 px-4 pb-5 pt-3 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => {
              close();
              window.dispatchEvent(new Event("open-command-palette"));
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-raised/60 px-3.5 py-3 text-[14px] text-faint transition-[color,border-color,transform] duration-150 ease-mac hover:border-line-strong hover:text-muted active:scale-[0.99]"
          >
            <Search className="size-4" aria-hidden />
            Search anything…
          </button>

          {/* Tap the faces to see everyone's status — the desktop panel does
              this with hover cards, which don't exist on touch. */}
          {presence && presence.length > 0 && (
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
                    className="grid size-6 place-items-center rounded-full border-2 border-bg text-[9px] font-semibold text-bg"
                    aria-hidden
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              </span>
              <span className="min-w-0 flex-1 text-[12px] text-faint">
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
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-raised text-[11px] font-medium text-muted">
                {(name || email).slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {name || email}
                </span>
                <span className="block truncate text-[11px] text-faint">
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
}) {
  const pathname = usePathname();
  const visible = NAV.filter(
    (item) => !item.section || isAdmin || showcase || sections.includes(item.section)
  );
  const [menuOpen, setMenuOpen] = useState(false);

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
      {/* Desktop sidebar */}
      <aside className="sticky top-0 z-30 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center justify-between px-4 pb-5 pt-5">
          <Link
            href="/"
            aria-label="KaguOs — go to dashboard"
            className="flex items-center gap-2.5 rounded-md transition-opacity duration-150 hover:opacity-80"
          >
            <Logo size={24} />
            <span className="text-[15px] font-semibold tracking-tight">KaguOs</span>
          </Link>
          <NotificationBell
            notifications={notifications}
            members={members}
            align="left"
          />
        </div>
        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            className="flex w-full items-center gap-2.5 rounded-md border border-line px-2.5 py-1.5 text-[13px] text-faint transition-colors duration-150 hover:border-line-strong hover:text-muted"
          >
            <Search className="size-3.5" aria-hidden />
            <span>Search…</span>
            <kbd className="ml-auto rounded border border-line px-1 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 px-2" aria-label="Sections">
          {visible.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              badge={item.href === "/messages" ? unreadMessages : null}
            />
          ))}
          {isAdmin && (
            <>
              <hr className="my-2 border-line" />
              <NavLink
                item={{ href: "/admin", label: "Admin", icon: ShieldCheck }}
                pathname={pathname}
              />
            </>
          )}
        </nav>
        {presence && presence.length > 0 && (
          <SidebarPresence people={presence} meId={meId} />
        )}
        <div className="flex items-center gap-2 border-t border-line p-3">
          <Link
            href="/account"
            className="min-w-0 flex-1 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-raised"
          >
            <p className="truncate text-[13px] font-medium text-ink">
              {name || email}
            </p>
            <p className="truncate text-xs text-faint">{email}</p>
          </Link>
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
            <span className="text-[15px] font-semibold tracking-tight">KaguOs</span>
          </Link>
          <div className="flex items-center gap-1">
            {presence && presence.length > 0 && (
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
          onClose={() => setMenuOpen(false)}
        />
      )}
    </>
  );
}
