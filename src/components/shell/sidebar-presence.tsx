"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { updateMyStatus } from "@/lib/actions/account";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TimePicker } from "@/components/ui/time-picker";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, type StatusKind, type PresencePerson } from "@/lib/types";

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

function tillLabel(until: string) {
  return new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

/** ISO expiry → "HH:MM" for the TimePicker; "" if none or already elapsed. */
function toTimeInput(until: string | null, now: number) {
  if (!until || Date.parse(until) <= now) return "";
  const d = new Date(until);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * "HH:MM" (local) → ISO for today, rolled to tomorrow if that clock time has
 * already passed — so "till 09:00" set at 22:00 means tomorrow morning.
 */
function fromTimeInput(hhmm: string, now: number): string | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

type Draft = { kind: StatusKind; text: string; call: boolean; until: string };

/**
 * Always-open presence panel for the sidebar. Unlike the old top-right popover,
 * this is visible on every page: an editor for MY status (dirty-aware Save, not
 * auto-save) plus a compact read-only list of the team. Kept short enough to sit
 * above the account row without the sidebar scrolling.
 */
export function SidebarPresence({
  people,
  meId,
}: {
  people: PresencePerson[];
  meId: string;
}) {
  const { pending, run } = useAction();
  const now = new Date().getTime();

  const me = people.find((p) => p.id === meId);

  // The saved server value, as a Draft — the baseline we diff against for dirty.
  const serverDraft: Draft = {
    kind: me?.status_kind ?? "none",
    text: me?.status_text ?? "",
    call: me?.available_to_call ?? false,
    until: toTimeInput(me?.status_until ?? null, now),
  };

  const [draft, setDraft] = useState<Draft>(serverDraft);
  // Adopt server changes during render (app-wide anti-flash pattern), but only
  // when the user has NO unsaved edits — never clobber what they're typing.
  const [seenMe, setSeenMe] = useState(me);
  if (seenMe !== me) {
    setSeenMe(me);
    if (!dirty(draft, seenMe, now)) setDraft(serverDraft);
  }

  const isDirty = dirty(draft, me, now);

  function save() {
    run(
      () =>
        updateMyStatus({
          kind: draft.kind,
          text: draft.text,
          availableToCall: draft.call,
          until: draft.kind === "none" ? null : fromTimeInput(draft.until, now),
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

  return (
    <div className="space-y-2 border-t border-line px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-faint">
        Your status
      </p>

      {me && (
        <div className="space-y-1.5">
          <Dropdown
            className="w-full"
            value={draft.kind}
            options={STATUS_OPTIONS}
            searchThreshold={0}
            onChange={(v) => {
              const kind = v as StatusKind;
              setDraft((d) => ({
                ...d,
                kind,
                // Leaving custom drops the free text; clearing drops the expiry.
                text: kind === "custom" ? d.text : "",
                until: kind === "none" ? "" : d.until,
              }));
            }}
          />

          {draft.kind === "custom" && (
            <Input
              value={draft.text}
              maxLength={80}
              placeholder="What's up?"
              aria-label="Custom status"
              onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
            />
          )}

          {draft.kind !== "none" && (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-muted">Till</span>
              <TimePicker
                className="flex-1"
                value={draft.until}
                ariaLabel="Status expires at"
                placeholder="Open-ended"
                onChange={(v) => setDraft((d) => ({ ...d, until: v }))}
              />
            </div>
          )}

          <Checkbox
            checked={draft.call}
            disabled={pending}
            onChange={() => setDraft((d) => ({ ...d, call: !d.call }))}
            label="Available to call"
          />

          <Button
            variant="primary"
            size="sm"
            className="w-full"
            disabled={pending || !isDirty}
            onClick={save}
          >
            {isDirty ? "Save status" : "Saved"}
          </Button>
        </div>
      )}

      {/* Compact team list — read-only, everyone else's current status. */}
      {others.length > 0 && (
        <ul className="space-y-1 pt-1">
          {others.map((p) => {
            const online = isOnline(p.last_seen_at, now);
            const status = statusLine(p, now);
            return (
              <li key={p.id} className="flex items-center gap-2">
                <span className="relative shrink-0" aria-hidden>
                  <span
                    style={{ color: p.color }}
                    className="flex size-5 items-center justify-center rounded-full border border-line-strong bg-raised text-[9px] font-semibold"
                  >
                    {initials(p.name)}
                  </span>
                  <span
                    className={cn(
                      "absolute -bottom-px -right-px size-1.5 rounded-full border border-surface",
                      online ? "bg-primary" : "bg-line-strong"
                    )}
                  />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted">
                  {status ?? (online ? "Online" : p.name)}
                </span>
                {p.available_to_call && (
                  <Phone
                    className="size-3 shrink-0 text-primary-dim"
                    aria-label="Available to call"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** True when the local draft differs from the saved server row. */
function dirty(draft: Draft, me: PresencePerson | undefined, now: number): boolean {
  const server: Draft = {
    kind: me?.status_kind ?? "none",
    text: me?.status_text ?? "",
    call: me?.available_to_call ?? false,
    until: toTimeInput(me?.status_until ?? null, now),
  };
  return (
    draft.kind !== server.kind ||
    (draft.kind === "custom" && draft.text !== server.text) ||
    draft.call !== server.call ||
    (draft.kind !== "none" && draft.until !== server.until)
  );
}
