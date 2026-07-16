"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bug,
  Contact as ContactIcon,
  FolderKanban,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Section } from "@/lib/types";
import { signOut } from "@/lib/actions/account";
import { Logo } from "@/components/shell/logo";
import { NotificationBell } from "@/components/shell/notification-bell";
import type { MembersMap, Notification } from "@/lib/types";

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
  { href: "/marketing", label: "Marketing", icon: Megaphone, section: "marketing" },
  { href: "/comms", label: "Comms", icon: ContactIcon, section: "comms" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  const root = href.split("/").slice(0, 2).join("/");
  return pathname === href || pathname.startsWith(root + "/") || pathname === root;
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
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
    </Link>
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
}: {
  sections: Section[];
  isAdmin: boolean;
  showcase: boolean;
  name: string | null;
  email: string;
  notifications: Notification[];
  members: MembersMap;
}) {
  const pathname = usePathname();
  const visible = NAV.filter(
    (item) => !item.section || isAdmin || showcase || sections.includes(item.section)
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 z-30 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center justify-between px-4 pb-5 pt-5">
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="text-[15px] font-semibold tracking-tight">KaguOs</span>
          </div>
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
            <NavLink key={item.href} item={item} pathname={pathname} />
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
          <div className="flex items-center gap-2.5">
            <Logo size={22} />
            <span className="text-[15px] font-semibold tracking-tight">KaguOs</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell notifications={notifications} members={members} />
            <Link
              href="/account"
              className="rounded-md px-2 py-1 text-[13px] text-muted hover:bg-raised hover:text-ink"
            >
              {name || email}
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-ink"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-2 pb-2"
          aria-label="Sections"
        >
          {visible.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
          {isAdmin && (
            <NavLink
              item={{ href: "/admin", label: "Admin", icon: ShieldCheck }}
              pathname={pathname}
            />
          )}
        </nav>
      </header>
    </>
  );
}
