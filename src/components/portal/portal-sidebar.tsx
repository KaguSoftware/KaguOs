"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Route,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/lib/actions/account";
import { Logo } from "@/components/shell/logo";
import { cn } from "@/lib/utils";

/**
 * The client's rail — the same shape the team's sidebar has, and deliberately
 * so.
 *
 * The portal used to be one bar with one destination, on the argument that a
 * sidebar would be six-sevenths empty. That was true when the portal was a
 * single form. It now has four places to be, two of which (money, progress) are
 * things a client checks repeatedly and one of which (inputs) is a long job
 * done over several sittings — and a top bar makes "where am I?" and "what else
 * is there?" both invisible.
 *
 * What it is NOT is the teammate rail with items removed. That component
 * carries presence, the command palette, the notification bell, section
 * membership and a collapse preference cookie — every one of which is a thing a
 * client must never see, and every future addition to it would be a leak
 * waiting for someone to forget the conditional. Same reason the two shells are
 * separate route groups: nothing reaches a client unless it is written here.
 *
 * ── The two counts ──────────────────────────────────────────────────────────
 *
 * The rail carries numbers rather than being a list of names: how many packs
 * still need finishing, how many invoices are past due. Both are the reason
 * somebody opens the portal at all, and a client who has nothing outstanding
 * should be able to see that from any page without navigating.
 */

/**
 * The rail's own words, already resolved to one language by the layout.
 *
 * A bundle of plain strings rather than the `PortalDict` itself: this is a
 * client component, and half of that dictionary is FUNCTIONS — which do not
 * cross the server/client boundary. Resolving them in the layout (where the
 * cookie is read) and sending strings keeps the boundary serialisable and the
 * rail ignorant of locales.
 */
export type PortalNavLabels = {
  dashboardAria: string;
  portalNav: string;
  menu: string;
  openMenu: string;
  closeMenu: string;
  yourAccount: string;
  accountAria: string;
  signOut: string;
  navDashboard: string;
  navDashboardHint: string;
  navInputs: string;
  navInputsHint: string;
  navProgress: string;
  navProgressHint: string;
  navFinance: string;
  navFinanceHint: string;
};

type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  hint: string;
  /** Count pill. Null or 0 renders nothing — a permanent "0" is noise. */
  badge?: number | null;
  /** Amber for "you owe us input", danger for "money is late". */
  tone?: "attention" | "urgent";
};

function useNav(
  labels: PortalNavLabels,
  packsOpen: number,
  overdue: number
): PortalNavItem[] {
  return [
    {
      href: "/portal",
      label: labels.navDashboard,
      icon: LayoutDashboard,
      hint: labels.navDashboardHint,
    },
    {
      href: "/portal/inputs",
      label: labels.navInputs,
      icon: ClipboardList,
      hint: labels.navInputsHint,
      badge: packsOpen,
      tone: "attention",
    },
    {
      href: "/portal/progress",
      label: labels.navProgress,
      icon: Route,
      hint: labels.navProgressHint,
    },
    {
      href: "/portal/finance",
      label: labels.navFinance,
      icon: Receipt,
      hint: labels.navFinanceHint,
      badge: overdue,
      tone: "urgent",
    },
  ];
}

/**
 * `/portal` must match ONLY itself — every other route in the shell starts with
 * it, so a prefix test would light the dashboard up on all four pages.
 */
function isActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Badge({ count, tone }: { count: number; tone: PortalNavItem["tone"] }) {
  return (
    <span
      className={cn(
        "ml-auto rounded-full px-1.5 font-mono text-[calc(11px*var(--text-scale,1))] font-medium",
        tone === "urgent"
          ? "bg-danger/15 text-danger"
          : "bg-amber/15 text-amber"
      )}
    >
      {count}
    </span>
  );
}

function NavRow({
  item,
  pathname,
  onNavigate,
  large,
}: {
  item: PortalNavItem;
  pathname: string;
  onNavigate?: () => void;
  /** The mobile sheet gives each destination a full row with its hint. */
  large?: boolean;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const count = typeof item.badge === "number" && item.badge > 0 ? item.badge : null;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center rounded-md transition-colors duration-150",
        large ? "gap-3 px-3 py-3" : "gap-2.5 px-2.5 py-1.5 text-sm",
        active ? "bg-raised text-ink" : "text-muted hover:bg-raised/60 hover:text-ink"
      )}
    >
      <Icon
        className={cn(large ? "size-5" : "size-4", active && "text-primary-dim")}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate",
            large && "text-[calc(15px*var(--text-scale,1))] font-medium"
          )}
        >
          {item.label}
        </span>
        {large && (
          <span className="block truncate text-[calc(12px*var(--text-scale,1))] text-faint">
            {item.hint}
          </span>
        )}
      </span>
      {count !== null && <Badge count={count} tone={item.tone} />}
    </Link>
  );
}

/** Keep in sync with the overlay-out duration below. */
const EXIT_MS = 180;

function MobileSheet({
  items,
  labels,
  pathname,
  name,
  email,
  onClose,
}: {
  items: PortalNavItem[];
  labels: PortalNavLabels;
  pathname: string;
  name: string | null;
  email: string;
  onClose: () => void;
}) {
  // The sheet has to outlive the close click long enough to animate out, so
  // EVERY dismissal path goes through close() — backdrop, the X, Escape, and
  // following a link. Miss one and that path snaps away while the others glide.
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing((already) => {
      if (already) return already;
      window.setTimeout(onClose, EXIT_MS);
      return true;
    });
  }, [onClose]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [close]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.menu}
      className="fixed inset-0 z-50 md:hidden"
    >
      <button
        type="button"
        aria-label={labels.closeMenu}
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
          "absolute inset-0 flex flex-col overflow-y-auto bg-bg/95 backdrop-blur-xl",
          closing
            ? "motion-safe:animate-[overlay-out_180ms_var(--ease-mac)_both]"
            : "motion-safe:animate-[overlay-in_260ms_var(--ease-mac)_both]"
        )}
      >
        <div className="flex items-center justify-between px-5 pb-4 pt-5">
          <span className="flex items-center gap-2.5">
            <Logo size={22} />
            <span className="text-[calc(15px*var(--text-scale,1))] font-semibold tracking-tight">
              KaguOs
            </span>
          </span>
          <button
            type="button"
            onClick={close}
            aria-label={labels.closeMenu}
            className="rounded-md p-2 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav className="grid gap-1 px-3" aria-label={labels.portalNav}>
          {items.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={close}
              large
            />
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-2 border-t border-line px-3 py-4">
          <Link
            href="/portal/account"
            onClick={close}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-raised/60"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-raised text-[calc(11px*var(--text-scale,1))] font-medium text-muted">
              {(name || email).slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[calc(13px*var(--text-scale,1))] font-medium text-ink">
                {name || email}
              </span>
              <span className="block truncate text-[calc(11px*var(--text-scale,1))] text-faint">
                {labels.yourAccount}
              </span>
            </span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              aria-label={labels.signOut}
              className="rounded-md border border-line p-3 text-muted transition-[color,border-color,transform] duration-150 ease-mac hover:border-danger/40 hover:text-danger active:scale-95"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function PortalSidebar({
  labels,
  name,
  email,
  packsOpen,
  overdue,
}: {
  labels: PortalNavLabels;
  name: string | null;
  email: string;
  /** Packs not yet sent, across every business. */
  packsOpen: number;
  /** Unpaid invoices past their due date, across every business. */
  overdue: number;
}) {
  const pathname = usePathname();
  const items = useNav(labels, packsOpen, overdue);
  const [menuOpen, setMenuOpen] = useState(false);

  // Navigating closes the sheet. Reset DURING RENDER against the previous
  // pathname rather than in an effect — an effect would commit the open sheet
  // over the new page for a frame first. Same pattern as the teammate rail.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setMenuOpen(false);
  }

  return (
    <>
      <aside className="sticky top-0 z-30 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="px-4 pb-5 pt-5">
          <Link
            href="/portal"
            aria-label={labels.dashboardAria}
            className="flex items-center gap-2.5 rounded-md transition-opacity duration-150 hover:opacity-80"
          >
            <Logo size={24} />
            <span className="text-[calc(15px*var(--text-scale,1))] font-semibold tracking-tight">
              KaguOs
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 px-2" aria-label={labels.portalNav}>
          {items.map((item) => (
            <NavRow key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="flex items-center gap-2 border-t border-line p-3">
          <Link
            href="/portal/account"
            aria-label={labels.accountAria}
            className="min-w-0 flex-1 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-raised"
          >
            <p className="truncate text-[calc(13px*var(--text-scale,1))] font-medium text-ink">
              {name || email}
            </p>
            <p className="truncate text-xs text-faint">{email}</p>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              title={labels.signOut}
              aria-label={labels.signOut}
              className="rounded-md p-2 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-surface md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href="/portal"
            aria-label={labels.dashboardAria}
            className="flex items-center gap-2.5 rounded-md transition-opacity duration-150 hover:opacity-80"
          >
            <Logo size={22} />
            <span className="text-[calc(15px*var(--text-scale,1))] font-semibold tracking-tight">
              KaguOs
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/portal/account"
              aria-label={labels.yourAccount}
              className="rounded-md p-2 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
            >
              <UserRound className="size-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={labels.openMenu}
              aria-expanded={menuOpen}
              className="rounded-md p-1.5 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <MobileSheet
          items={items}
          labels={labels}
          pathname={pathname}
          name={name}
          email={email}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </>
  );
}
