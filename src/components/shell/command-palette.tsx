"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bug,
  Contact,
  FolderKanban,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Plus,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Section } from "@/lib/types";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: LucideIcon;
  section?: Section;
  adminOnly?: boolean;
  keywords?: string;
};

const ALL: Command[] = [
  { id: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard, keywords: "home" },
  { id: "work", label: "Work", hint: "Projects & ideas", href: "/work", icon: FolderKanban, section: "work" },
  { id: "work-new-project", label: "New project", href: "/work/projects/new", icon: Plus, section: "work", keywords: "create add" },
  { id: "work-new-idea", label: "New idea", href: "/work/ideas/new", icon: Plus, section: "work", keywords: "create add" },
  { id: "learn", label: "Learn", hint: "Sprints & progress", href: "/learn", icon: GraduationCap, section: "learn" },
  { id: "management", label: "Management", hint: "Finance & contracts", href: "/management/finance", icon: Landmark, section: "management" },
  { id: "mgmt-new-txn", label: "New transaction", href: "/management/finance/new-transaction", icon: Plus, section: "management", keywords: "create add expense income" },
  { id: "mgmt-new-contract", label: "New contract", href: "/management/contracts/new", icon: Plus, section: "management", keywords: "create add" },
  { id: "debug", label: "Debug", hint: "Claim-a-task board", href: "/debug", icon: Bug, section: "debug" },
  { id: "debug-new", label: "New task", href: "/debug/new", icon: Plus, section: "debug", keywords: "create add bug" },
  { id: "marketing", label: "Marketing", hint: "Campaigns & content", href: "/marketing", icon: Megaphone, section: "marketing" },
  { id: "mkt-new-campaign", label: "New campaign", href: "/marketing/new-campaign", icon: Plus, section: "marketing", keywords: "create add" },
  { id: "comms", label: "Comms", hint: "Leads & clients", href: "/comms", icon: Contact, section: "comms", keywords: "crm contacts" },
  { id: "comms-new", label: "New contact", href: "/comms/new", icon: Plus, section: "comms", keywords: "create add lead client" },
  { id: "admin", label: "Admin", hint: "Users & access", href: "/admin", icon: ShieldCheck, adminOnly: true, keywords: "team users" },
  { id: "account", label: "Account settings", href: "/account", icon: ShieldCheck, keywords: "profile name color password" },
];

export function CommandPalette({
  sections,
  isAdmin,
}: {
  sections: Section[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const available = useMemo(
    () =>
      ALL.filter((c) => {
        if (c.adminOnly) return isAdmin;
        if (c.section) return isAdmin || sections.includes(c.section);
        return true;
      }),
    [sections, isAdmin]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((c) =>
      `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""}`.toLowerCase().includes(q)
    );
  }, [query, available]);

  // Global ⌘K / Ctrl+K toggle, plus a custom event so a click target (the
  // sidebar's search button) can open it too.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // focus after paint
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  function choose(cmd: Command | undefined) {
    if (!cmd) return;
    setOpen(false);
    router.push(cmd.href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      onMouseDown={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg animate-overlay-in overflow-hidden rounded-xl border border-line-strong bg-raised shadow-2xl shadow-black/50"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-3.5">
          <Search className="size-4 shrink-0 text-faint" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(results[active]);
              }
            }}
            placeholder="Jump to… or type an action"
            data-no-ring
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
          />
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint sm:block">
            esc
          </kbd>
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-faint">
            Nothing matches “{query}”.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1.5">
            {results.map((cmd, i) => {
              const Icon = cmd.icon;
              return (
                <li key={cmd.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(cmd)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors duration-75",
                      i === active ? "bg-primary/10" : "hover:bg-surface"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        i === active ? "text-primary-dim" : "text-faint"
                      )}
                      aria-hidden
                    />
                    <span className="text-sm text-ink">{cmd.label}</span>
                    {cmd.hint && (
                      <span className="ml-auto truncate text-xs text-faint">{cmd.hint}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
