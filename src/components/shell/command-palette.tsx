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
  Lightbulb,
  Loader2,
  Megaphone,
  Plus,
  Search,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { searchContent, type SearchHit } from "@/lib/actions/search";
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

// A row in the palette: either a nav action or a piece of content (task/idea/…).
type Item = {
  key: string;
  label: string;
  sub?: string;
  href: string;
  icon: LucideIcon;
  typeLabel?: string; // e.g. "task", "project" — shown for content hits
};

const HIT_ICON: Record<SearchHit["type"], LucideIcon> = {
  task: Bug,
  project: FolderKanban,
  idea: Lightbulb,
  contact: Users,
  sprint: GraduationCap,
};

const HIT_TYPE_LABEL: Record<SearchHit["type"], string> = {
  task: "task",
  project: "project",
  idea: "idea",
  contact: "contact",
  sprint: "sprint",
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
  showcase,
}: {
  sections: Section[];
  isAdmin: boolean;
  showcase: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [content, setContent] = useState<SearchHit[] | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The cached content belongs to exactly one data world (real vs showcase).
  // When showcase mode flips, drop the cache DURING RENDER so real rows loaded
  // before entering showcase can never surface in a client demo (and demo rows
  // never linger after exiting). The next open refetches, and searchContent is
  // showcase-filtered server-side.
  const [seenShowcase, setSeenShowcase] = useState(showcase);
  if (seenShowcase !== showcase) {
    setSeenShowcase(showcase);
    setContent(null);
  }

  const available = useMemo(
    () =>
      ALL.filter((c) => {
        if (c.adminOnly) return isAdmin;
        if (c.section) return isAdmin || sections.includes(c.section);
        return true;
      }),
    [sections, isAdmin]
  );

  // Nav actions as unified Items (always shown).
  const actionItems = useMemo<Item[]>(
    () =>
      available.map((c) => ({
        key: `cmd:${c.id}`,
        label: c.label,
        sub: c.hint,
        href: c.href,
        icon: c.icon,
      })),
    [available]
  );

  const q = query.trim().toLowerCase();

  const actionResults = useMemo<Item[]>(() => {
    if (!q) return actionItems;
    return available
      .filter((c) =>
        `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""}`.toLowerCase().includes(q)
      )
      .map((c) => ({
        key: `cmd:${c.id}`,
        label: c.label,
        sub: c.hint,
        href: c.href,
        icon: c.icon,
      }));
  }, [q, available, actionItems]);

  // Content hits only appear once you type — an empty palette stays a clean list
  // of actions, not every task/contact in the company.
  const contentResults = useMemo<Item[]>(() => {
    if (!q || !content) return [];
    return content
      .filter(
        (h) =>
          h.label.toLowerCase().includes(q) ||
          (h.sub?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 50) // keep the list snappy; typing more narrows it
      .map((h) => ({
        key: `${h.type}:${h.id}`,
        label: h.label,
        sub: h.sub,
        href: h.href,
        icon: HIT_ICON[h.type],
        typeLabel: HIT_TYPE_LABEL[h.type],
      }));
  }, [q, content]);

  const results = useMemo(
    () => [...actionResults, ...contentResults],
    [actionResults, contentResults]
  );

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
      // Load searchable content once (first open), then reuse it for the session.
      // One wave of small queries; every keystroke after filters it in-memory.
      if (content === null && !loadingContent) {
        setLoadingContent(true);
        searchContent()
          .then((hits) => setContent(hits))
          .catch(() => setContent([])) // fail soft — actions still work
          .finally(() => setLoadingContent(false));
      }
    }
  }, [open, content, loadingContent]);

  // Reset the highlight to the first hit whenever the query changes. During
  // render, not in an effect: an effect would paint one frame with the old
  // highlight still on a row that no longer matches what was typed.
  const [seenQuery, setSeenQuery] = useState(query);
  if (seenQuery !== query) {
    setSeenQuery(query);
    setActive(0);
  }

  function choose(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
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
            placeholder="Jump to a page, or search tasks, projects, people…"
            data-no-ring
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
          />
          {loadingContent && (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-faint" aria-hidden />
          )}
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint sm:block">
            esc
          </kbd>
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-faint">
            {q && loadingContent ? "Searching…" : `Nothing matches “${query}”.`}
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1.5">
            {results.map((item, i) => {
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(item)}
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
                    <span className="truncate text-sm text-ink">{item.label}</span>
                    {item.sub && (
                      <span className="truncate text-xs text-faint">· {item.sub}</span>
                    )}
                    {item.typeLabel && (
                      <span className="ml-auto shrink-0 rounded border border-line px-1.5 py-px text-[10px] uppercase tracking-wide text-faint">
                        {item.typeLabel}
                      </span>
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
