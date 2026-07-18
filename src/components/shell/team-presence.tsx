"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { updateMyStatus } from "@/lib/actions/account";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useAction } from "@/lib/use-action";
import { cn, formatRelative } from "@/lib/utils";
import {
  STATUS_LABELS,
  type StatusKind,
} from "@/lib/types";

/** One teammate as the presence widget needs them. */
export type PresencePerson = {
  id: string;
  name: string;
  color: string;
  last_seen_at: string | null;
  status_kind: StatusKind;
  status_text: string | null;
  available_to_call: boolean;
  /** Optional expiry — "unavailable till 15:00". Null = open-ended. */
  status_until: string | null;
};

/** Seen within this window = "online now" (last_seen writes are ~5-min throttled). */
const ONLINE_WINDOW_MS = 6 * 60 * 1000;

const STATUS_OPTIONS = (
  ["none", "working", "focus", "meeting", "break", "unavailable", "off", "custom"] as StatusKind[]
).map((k) => ({ value: k, label: STATUS_LABELS[k] }));

function isOnline(lastSeen: string | null, now: number) {
  return lastSeen !== null && now - Date.parse(lastSeen) < ONLINE_WINDOW_MS;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** A status whose expiry has passed reads as no status — no write needed. */
function isExpired(until: string | null, now: number) {
  return until !== null && Date.parse(until) <= now;
}

/** "15:00" — the local wall-clock time of an expiry, for the "till …" suffix. */
function tillLabel(until: string) {
  return new Date(until).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLine(p: PresencePerson, now: number) {
  if (isExpired(p.status_until, now)) return null;
  const base =
    p.status_kind === "custom" && p.status_text
      ? p.status_text
      : p.status_kind !== "none"
        ? STATUS_LABELS[p.status_kind]
        : null;
  if (!base) return null;
  return p.status_until ? `${base} · till ${tillLabel(p.status_until)}` : base;
}

/** ISO "…T15:00" → the "HH:MM" the <input type=time> wants; "" if none/elapsed. */
function toTimeInput(until: string | null, now: number) {
  if (!until || Date.parse(until) <= now) return "";
  const d = new Date(until);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

/**
 * "HH:MM" (local) → an ISO timestamp for today, rolled to tomorrow if that
 * clock time has already passed — so "till 09:00" set at 22:00 means tomorrow
 * morning, not a time in the past. Empty input → null (open-ended).
 */
function fromTimeInput(hhmm: string, now: number): string | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

/**
 * Dashboard top-right: who's around. Avatar stack that opens a popover with
 * everyone's status, last-seen, and call availability — plus the editor for
 * your own. Data arrives as server props and refreshes with the page; your own
 * edits are optimistic.
 */
export function TeamPresence({
  people,
  meId,
}: {
  people: PresencePerson[];
  meId: string;
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  // Snapshot once per render pass — enough precision for a 6-minute window.
  // (new Date(), not Date.now() — the react-compiler lint flags the latter as
  // impure in render; same pattern as task-row's overdue check.)
  const now = new Date().getTime();

  const me = people.find((p) => p.id === meId);
  // My editable state, seeded from the server row; adopt server changes during
  // render (the app-wide anti-flash pattern).
  const [draft, setDraft] = useState(() => ({
    kind: me?.status_kind ?? "none",
    text: me?.status_text ?? "",
    call: me?.available_to_call ?? false,
    until: toTimeInput(me?.status_until ?? null, now),
  }));
  const [seenMe, setSeenMe] = useState(me);
  if (seenMe !== me) {
    setSeenMe(me);
    if (me) {
      setDraft({
        kind: me.status_kind,
        text: me.status_text ?? "",
        call: me.available_to_call,
        until: toTimeInput(me.status_until, now),
      });
    }
  }

  function save(next: {
    kind: StatusKind;
    text: string;
    call: boolean;
    until: string;
  }) {
    setDraft(next);
    run(
      () =>
        updateMyStatus({
          kind: next.kind,
          text: next.text,
          availableToCall: next.call,
          // Clearing the status drops any expiry with it.
          until: next.kind === "none" ? null : fromTimeInput(next.until, now),
        }),
      { success: "Status updated." }
    );
  }

  const others = [...people]
    .filter((p) => p.id !== meId)
    .sort(
      (a, b) =>
        Number(isOnline(b.last_seen_at, now)) - Number(isOnline(a.last_seen_at, now)) ||
        Number(b.available_to_call) - Number(a.available_to_call) ||
        a.name.localeCompare(b.name)
    );

  const onlineCount = people.filter((p) => isOnline(p.last_seen_at, now)).length;
  const stack = people.slice(0, 4);

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Team — ${onlineCount} online`}
        className="flex items-center gap-2 rounded-md border border-line bg-surface py-1.5 pl-2 pr-3 transition-colors duration-150 ease-mac hover:border-line-strong hover:bg-raised"
      >
        <span className="flex items-center">
          {stack.map((p, i) => (
            <span
              key={p.id}
              style={{ color: p.color, zIndex: stack.length - i }}
              className={cn(
                "flex size-6 items-center justify-center rounded-full border border-line-strong bg-raised text-[10px] font-semibold",
                i > 0 && "-ml-1.5"
              )}
              aria-hidden
            >
              {initials(p.name)}
            </span>
          ))}
          {people.length > stack.length && (
            <span
              className="-ml-1.5 flex size-6 items-center justify-center rounded-full border border-line-strong bg-raised font-mono text-[10px] text-muted"
              aria-hidden
            >
              +{people.length - stack.length}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span
            className={cn(
              "size-1.5 rounded-full",
              onlineCount > 0 ? "bg-primary" : "bg-line-strong"
            )}
            aria-hidden
          />
          {onlineCount} on
        </span>
      </button>

      {open && (
        <>
          {/* Invisible backdrop — click anywhere outside to close. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="dialog"
            aria-label="Team presence"
            className="absolute right-0 z-40 mt-2 w-80 origin-top-right animate-pop-in rounded-lg border border-line-strong bg-raised/90 shadow-2xl shadow-black/50 backdrop-blur-md"
          >
            {/* Your status */}
            {me && (
              <div className="space-y-2 border-b border-line p-3">
                <p className="text-xs font-medium text-muted">Your status</p>
                <Dropdown
                  className="w-full"
                  value={draft.kind}
                  options={STATUS_OPTIONS}
                  onChange={(v) => {
                    const kind = v as StatusKind;
                    // Picking "Custom…" waits for the text; everything else saves now.
                    if (kind === "custom") setDraft((d) => ({ ...d, kind }));
                    else save({ ...draft, kind, text: "" });
                  }}
                />
                {draft.kind === "custom" && (
                  <Input
                    value={draft.text}
                    maxLength={80}
                    placeholder="What's up? (saves on Enter)"
                    aria-label="Custom status"
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, text: e.target.value }))
                    }
                    onBlur={() => save(draft)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        save(draft);
                      }
                    }}
                  />
                )}
                {/* Optional expiry — "till HH:MM". Only meaningful with a status
                    set; a bare time with no status has nothing to expire. */}
                {draft.kind !== "none" && (
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <span className="shrink-0">Till</span>
                    <input
                      type="time"
                      value={draft.until}
                      aria-label="Status expires at"
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, until: e.target.value }))
                      }
                      onBlur={() => save(draft)}
                      className="h-8 flex-1 rounded-md border border-line bg-surface px-2 text-sm text-ink transition-colors duration-150 hover:border-line-strong focus-visible:border-line-strong scheme-dark"
                    />
                    {draft.until && (
                      <button
                        type="button"
                        onClick={() => save({ ...draft, until: "" })}
                        className="shrink-0 text-faint transition-colors duration-150 hover:text-ink"
                        aria-label="Clear expiry"
                      >
                        clear
                      </button>
                    )}
                  </label>
                )}
                <Checkbox
                  checked={draft.call}
                  disabled={pending}
                  onChange={() => save({ ...draft, call: !draft.call })}
                  label="Available to call"
                />
              </div>
            )}

            {/* Everyone else */}
            <ul className="max-h-80 overflow-y-auto py-1.5">
              {others.map((p) => {
                const online = isOnline(p.last_seen_at, now);
                const status = statusLine(p, now);
                return (
                  <li key={p.id} className="flex items-center gap-2.5 px-3 py-2">
                    <span className="relative shrink-0" aria-hidden>
                      <span
                        style={{ color: p.color }}
                        className="flex size-7 items-center justify-center rounded-full border border-line-strong bg-surface text-[11px] font-semibold"
                      >
                        {initials(p.name)}
                      </span>
                      <span
                        className={cn(
                          "absolute -bottom-px -right-px size-2 rounded-full border border-raised",
                          online ? "bg-primary" : "bg-line-strong"
                        )}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        style={{ color: p.color }}
                        className="block truncate text-[13px] font-medium"
                      >
                        {p.name}
                      </span>
                      <span className="block truncate text-xs text-faint">
                        {status ?? (online ? "Online" : "No status")}
                      </span>
                    </span>
                    {p.available_to_call && (
                      <span
                        title="Available to call"
                        className="flex shrink-0 items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary-dim"
                      >
                        <Phone className="size-3" aria-hidden />
                        call ok
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-[11px] text-faint">
                      {online
                        ? "now"
                        : p.last_seen_at
                          ? formatRelative(p.last_seen_at)
                          : "never"}
                    </span>
                  </li>
                );
              })}
              {others.length === 0 && (
                <li className="px-3 py-4 text-center text-xs text-faint">
                  Nobody else here yet.
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
