"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Phone, Smile, X } from "lucide-react";
import { updateMyStatus } from "@/lib/actions/account";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { useLivePresence, type LiveState } from "@/lib/use-live-presence";
import { cn, formatRelative } from "@/lib/utils";
import {
  STATUS_KINDS,
  STATUS_PRESETS,
  type StatusKind,
  type PresencePerson,
} from "@/lib/types";

/** Preset chips, in editor order. `none` is the explicit "Clear" affordance. */
const PRESET_CHIPS = STATUS_KINDS.filter((k) => k !== "none" && k !== "custom");

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** Duration shortcuts: label + ms. 0 = open-ended. A custom value is allowed
 *  alongside these (the "+" chip) — the server validates a RANGE, not this set. */
const DURATIONS: { label: string; ms: number }[] = [
  { label: "Open", ms: 0 },
  { label: "30m", ms: 30 * MINUTE_MS },
  { label: "1h", ms: HOUR_MS },
  { label: "2h", ms: 2 * HOUR_MS },
  { label: "12h", ms: 12 * HOUR_MS },
];

/** Server-side bounds, mirrored so the UI can't offer an invalid value. */
const CUSTOM_MAX_MS = 7 * 24 * HOUR_MS;

/** Digits only, capped at `max` characters — keeps the h/m fields numeric
 *  without a native number spinner (the app uses custom controls throughout). */
function digits(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}

/** "3h 30m" / "45m" / "2h" — the custom chip's label and the a11y name. */
function formatDuration(ms: number): string {
  const mins = Math.round(ms / MINUTE_MS);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
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

/** "· 40m left" / "· 2h left" — compact remaining time, or null past a day. */
function remainingLabel(until: string | null, now: number): string | null {
  if (!until) return null;
  const ms = Date.parse(until) - now;
  if (ms <= 0 || ms > 24 * 60 * 60 * 1000) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  return `${Math.round(mins / 60)}h left`;
}

/** The status label (note wins over preset label), or null if no status. */
function statusText(p: PresencePerson, now: number): string | null {
  if (p.status_kind === "none" || isExpired(p.status_until, now)) return null;
  if (p.status_text) return p.status_text;
  if (p.status_kind === "custom") return null; // custom with only an emoji
  return STATUS_PRESETS[p.status_kind].label;
}

/** The emoji for a live (non-expired) status, else null. */
function statusEmoji(p: PresencePerson, now: number): string | null {
  if (p.status_kind === "none" || isExpired(p.status_until, now)) return null;
  return p.status_emoji || STATUS_PRESETS[p.status_kind]?.emoji || null;
}

const DOT: Record<LiveState, string> = {
  online: "bg-primary",
  away: "bg-amber",
  offline: "bg-line-strong",
};

/**
 * One teammate row — an avatar carrying two independent signals (a status emoji
 * badge and a live presence dot), the name, a truncating status/last-seen line,
 * and a quiet "reachable" phone glyph. `onClick` (my row only) opens the editor.
 */
function PresenceRow({
  person,
  live,
  now,
  onClick,
  label,
  active,
}: {
  person: PresencePerson;
  live: LiveState;
  now: number;
  onClick?: () => void;
  /** Overrides the name line (e.g. "You"). */
  label?: string;
  /** My row, editor open — highlight it. */
  active?: boolean;
}) {
  const emoji = statusEmoji(person, now);
  const text = statusText(person, now);
  const remaining = remainingLabel(person.status_until, now);
  const interactive = Boolean(onClick);
  const Tag = interactive ? "button" : "div";

  // The sub-line carries the status (or a presence fallback when none is set).
  const sub =
    text ?? (live === "online" ? "Online" : live === "away" ? "Away" : "Offline");

  // Last-seen is ALWAYS shown, in its own right-aligned meta column — so it
  // never competes with the status text for width. "now" when live, else the
  // relative time, else nothing to show.
  const lastSeen =
    live === "online"
      ? "now"
      : person.last_seen_at
        ? formatRelative(person.last_seen_at, new Date(now))
        : null;

  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={onClick}
      aria-label={interactive ? "Edit your status" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left",
        interactive &&
          "transition-colors duration-150 ease-mac hover:bg-raised focus-visible:bg-raised focus-visible:outline-none",
        active && "bg-raised"
      )}
    >
      <span className="relative shrink-0" aria-hidden>
        <span
          style={{ color: person.color }}
          className="flex size-8 items-center justify-center rounded-full border border-line-strong bg-raised text-[11px] font-semibold"
        >
          {initials(person.name)}
        </span>
        {/* Live presence dot — top-right. */}
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-surface transition-colors duration-300 ease-mac",
            DOT[live]
          )}
        />
        {/* Status emoji badge — bottom-left, only when a status is set. */}
        {emoji && (
          <span className="absolute -bottom-1 -left-1 grid size-4 place-items-center rounded-full border border-line bg-surface text-[9px] leading-none">
            {emoji}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            style={{ color: person.color }}
            className="truncate text-[13px] font-medium"
          >
            {label ?? person.name}
          </span>
          {person.available_to_call && (
            <Phone
              className="size-3 shrink-0 text-primary-dim"
              aria-label="Available to call"
            />
          )}
        </span>
        <span className="block truncate text-xs text-faint" title={text ?? undefined}>
          {sub}
        </span>
      </span>

      {/* Meta column — always-on last-seen, plus a ticking "Xm left" when timed. */}
      <span className="flex shrink-0 flex-col items-end gap-0.5 self-center">
        {lastSeen && (
          <span className="whitespace-nowrap font-mono text-[10px] text-faint">
            {lastSeen}
          </span>
        )}
        {remaining && (
          <span className="whitespace-nowrap font-mono text-[10px] text-muted">
            {remaining}
          </span>
        )}
      </span>
    </Tag>
  );
}

/** The editor's working draft — composed locally, committed on Save. */
type Draft = {
  kind: StatusKind;
  emoji: string;
  note: string;
  call: boolean;
  durationMs: number;
};

type SetFields = {
  kind: StatusKind;
  emoji?: string | null;
  text?: string | null;
  call: boolean;
  durationMs: number;
};

type EditorProps = {
  me: PresencePerson;
  now: number;
  pending: boolean;
  onSet: (fields: SetFields) => void;
  onClose: () => void;
};

/** The saved status, read back into a Draft — the baseline we diff for dirty. */
function draftFromMe(me: PresencePerson, now: number): Draft {
  const expired = isExpired(me.status_until, now);
  const kind = expired ? "none" : me.status_kind;
  const remainingMs = me.status_until && !expired ? Date.parse(me.status_until) - now : 0;
  // Round the REMAINING time to whole minutes and keep it as-is. This used to
  // snap to the nearest preset chip, which a custom duration makes wrong: save
  // "3h 30m", reopen, and it would read back as "2h" — the editor would both
  // lie about your status and look un-dirty while holding a different value.
  const durationMs =
    remainingMs > 0 ? Math.round(remainingMs / MINUTE_MS) * MINUTE_MS : 0;
  return {
    kind,
    emoji: kind === "none" ? "" : (me.status_emoji ?? ""),
    note: kind === "none" ? "" : (me.status_text ?? ""),
    call: me.available_to_call,
    durationMs,
  };
}

/** A PresencePerson synthesized from a draft, so the preview row reflects edits live. */
function previewPerson(me: PresencePerson, draft: Draft, now: number): PresencePerson {
  const hasStatus = draft.kind !== "none";
  const emoji = hasStatus
    ? draft.emoji.trim() || STATUS_PRESETS[draft.kind].emoji || null
    : null;
  return {
    ...me,
    status_kind: draft.kind,
    status_emoji: emoji,
    status_text: hasStatus ? draft.note.trim() || null : null,
    available_to_call: draft.call,
    status_until: hasStatus && draft.durationMs > 0
      ? new Date(now + draft.durationMs).toISOString()
      : null,
  };
}

function draftsEqual(a: Draft, b: Draft): boolean {
  return (
    a.kind === b.kind &&
    a.emoji.trim() === b.emoji.trim() &&
    a.note.trim() === b.note.trim() &&
    a.call === b.call &&
    a.durationMs === b.durationMs
  );
}

/**
 * Centered modal editor. A DRAFT is composed locally — presets, emoji + note,
 * duration, and call toggle all mutate draft state, and the live preview row
 * reflects it instantly — then committed once with Save (not per-tap). Frosted,
 * macOS pop-in, portaled out of the sidebar's stacking context, Esc / backdrop
 * to dismiss. The body is intentionally shell-agnostic so an anchored-popover
 * variant could reuse it later.
 */
function StatusModal({ me, now, pending, onSet, onClose }: EditorProps) {
  const baseline = draftFromMe(me, now);
  const [draft, setDraft] = useState<Draft>(baseline);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const active = draft.kind !== "none";
  const dirty = !draftsEqual(draft, baseline);

  // A duration that isn't one of the shortcut chips is a custom one. The panel
  // starts open when the saved status already carries such a value, so
  // reopening the editor shows what's actually set rather than an empty row.
  const isCustomDuration =
    draft.durationMs > 0 && !DURATIONS.some((d) => d.ms === draft.durationMs);
  const [customOpen, setCustomOpen] = useState(isCustomDuration);
  const [customH, setCustomH] = useState(() =>
    isCustomDuration ? String(Math.floor(draft.durationMs / HOUR_MS)) : ""
  );
  const [customM, setCustomM] = useState(() =>
    isCustomDuration
      ? String(Math.round((draft.durationMs % HOUR_MS) / MINUTE_MS))
      : ""
  );
  const customMs = Math.min(
    (Number(customH) || 0) * HOUR_MS + (Number(customM) || 0) * MINUTE_MS,
    CUSTOM_MAX_MS
  );

  function pickPreset(kind: StatusKind) {
    // Adopt the preset's call default only when switching INTO a new preset.
    set({
      kind,
      emoji: "",
      note: draft.kind === kind ? draft.note : "",
      call: draft.kind === kind ? draft.call : STATUS_PRESETS[kind].callDefault,
    });
  }

  function save() {
    const e = draft.emoji.trim();
    const n = draft.note.trim();
    // A custom status (or any) with neither emoji nor note nor preset = clear.
    const kind = draft.kind;
    onSet({
      kind,
      emoji: kind === "none" ? null : e || null,
      text: kind === "none" ? null : n || null,
      call: draft.call,
      durationMs: kind === "none" ? 0 : draft.durationMs,
    });
    onClose();
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set your status"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-bg/70 backdrop-blur-sm motion-safe:animate-[overlay-in_150ms_var(--ease-mac)_both]"
      />

      {/* Card */}
      <div className="relative flex max-h-[90vh] w-full max-w-sm origin-center flex-col animate-pop-in rounded-xl border border-line-strong bg-raised/90 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Set your status
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-1">
          {/* Live preview — how your row will read to the team, updating as you edit. */}
          <div className="rounded-lg border border-line bg-surface/60 p-1">
            <PresenceRow person={previewPerson(me, draft, now)} live="online" now={now} label="You" />
          </div>

          {/* Presets. */}
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
              Status
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_CHIPS.map((kind) => {
                const selected = draft.kind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => pickPreset(kind)}
                    aria-pressed={selected}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center",
                      "transition-[background-color,border-color,transform] duration-150 ease-mac",
                      "active:scale-[0.97]",
                      selected
                        ? "border-primary/50 bg-primary/10 text-ink"
                        : "border-line text-muted hover:border-line-strong hover:bg-raised/50 hover:text-ink"
                    )}
                  >
                    <span className="text-xl leading-none" aria-hidden>
                      {STATUS_PRESETS[kind].emoji}
                    </span>
                    <span className="text-[12px] font-medium">
                      {STATUS_PRESETS[kind].label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom emoji + note — typing here promotes the draft to a custom status. */}
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
              Or write your own
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={draft.emoji}
                onChange={(e) =>
                  set({
                    emoji: e.target.value.slice(0, 4),
                    kind: draft.kind === "none" ? "custom" : draft.kind,
                  })
                }
                placeholder="🙂"
                aria-label="Status emoji"
                className="w-12 shrink-0 px-0 text-center text-base"
              />
              <Input
                value={draft.note}
                maxLength={80}
                placeholder="What's up?"
                aria-label="Custom status note"
                onChange={(e) =>
                  set({
                    note: e.target.value,
                    kind: draft.kind === "none" ? "custom" : draft.kind,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && dirty) {
                    e.preventDefault();
                    save();
                  }
                }}
              />
            </div>
          </div>

          {/* Refinements — only meaningful once a status is set. */}
          {active && (
            <div className="space-y-3 border-t border-line pt-4">
              <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[13px] text-muted">Clear in</span>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {DURATIONS.map((d) => {
                    const selected = d.ms === draft.durationMs;
                    return (
                      <button
                        key={d.ms}
                        type="button"
                        onClick={() => {
                          setCustomOpen(false);
                          set({ durationMs: d.ms });
                        }}
                        aria-pressed={selected}
                        className={cn(
                          "rounded-md border px-2.5 py-1 font-mono text-[12px]",
                          "transition-colors duration-150 ease-mac",
                          selected
                            ? "border-primary/50 bg-primary/10 text-ink"
                            : "border-line text-muted hover:border-line-strong hover:text-ink"
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                  {/* Custom duration. Shows the chosen value once set, so a
                      custom pick reads like the presets rather than hiding
                      behind a "+" that gives no clue what's selected. */}
                  <button
                    type="button"
                    onClick={() => setCustomOpen((v) => !v)}
                    aria-pressed={isCustomDuration}
                    aria-expanded={customOpen}
                    aria-label={
                      isCustomDuration
                        ? `Custom duration: ${formatDuration(draft.durationMs)}`
                        : "Set a custom duration"
                    }
                    className={cn(
                      "rounded-md border px-2.5 py-1 font-mono text-[12px]",
                      "transition-colors duration-150 ease-mac",
                      isCustomDuration || customOpen
                        ? "border-primary/50 bg-primary/10 text-ink"
                        : "border-line text-muted hover:border-line-strong hover:text-ink"
                    )}
                  >
                    {isCustomDuration ? formatDuration(draft.durationMs) : "Custom"}
                  </button>
                </div>
              </div>

              {customOpen && (
                <div
                  className="flex items-center gap-2 pl-19"
                  // Enter commits the duration, matching the note field. Without
                  // it the only way out of these inputs is a mouse.
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || !customMs) return;
                    e.preventDefault();
                    set({ durationMs: customMs });
                    setCustomOpen(false);
                  }}
                >
                  {/* Plain controlled Inputs, not NumberInput — that one is an
                      uncontrolled form field that normalizes to decimals on
                      blur ("3" → "3.00"), which is wrong for hours/minutes. */}
                  <Input
                    value={customH}
                    onChange={(e) => setCustomH(digits(e.target.value, 3))}
                    inputMode="numeric"
                    placeholder="0"
                    aria-label="Hours"
                    className="w-14 text-center font-mono"
                  />
                  <span className="text-[12px] text-faint">h</span>
                  <Input
                    value={customM}
                    onChange={(e) => setCustomM(digits(e.target.value, 2))}
                    inputMode="numeric"
                    placeholder="0"
                    aria-label="Minutes"
                    className="w-14 text-center font-mono"
                  />
                  <span className="text-[12px] text-faint">m</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!customMs}
                    onClick={() => {
                      if (!customMs) return;
                      set({ durationMs: customMs });
                      setCustomOpen(false);
                    }}
                  >
                    Set
                  </Button>
                </div>
              )}

              <button
                type="button"
                onClick={() => set({ call: !draft.call })}
                aria-pressed={draft.call}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px]",
                  "transition-colors duration-150 ease-mac",
                  draft.call
                    ? "border-primary/50 bg-primary/10 text-ink"
                    : "border-line text-muted hover:border-line-strong hover:text-ink"
                )}
              >
                <Phone className="size-4 shrink-0" aria-hidden />
                <span className="font-medium">Available to call</span>
                <span className="ml-auto text-[11px] text-faint">
                  {draft.call ? "On" : "Off"}
                </span>
                <span
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors duration-150 ease-mac",
                    draft.call ? "bg-primary" : "bg-line-strong"
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-4 rounded-full bg-surface transition-[left] duration-150 ease-mac",
                      draft.call ? "left-4.5" : "left-0.5"
                    )}
                  />
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer — Clear (when a status exists) · Cancel · Save. */}
        <div className="flex items-center gap-2 border-t border-line px-5 py-4">
          {active && (
            <button
              type="button"
              onClick={() => {
                setCustomOpen(false);
                setCustomH("");
                setCustomM("");
                set({ kind: "none", emoji: "", note: "", durationMs: 0 });
              }}
              className="text-[13px] text-faint transition-colors duration-150 hover:text-danger"
            >
              Clear
            </button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={pending || !dirty}
            onClick={save}
          >
            Save
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const LIVE_LABEL: Record<LiveState, string> = {
  online: "Online now",
  away: "Away",
  offline: "Offline",
};

/**
 * A teammate row that reveals a fuller detail card on hover/focus — so a long
 * custom status that truncates in the row is readable in full, alongside call
 * availability and last-seen. The card is portaled and fixed-positioned from the
 * row's rect, so the sidebar's overflow never clips it; it opens to the right
 * (the sidebar hugs the screen's left edge).
 */
function TeammateRow({
  person,
  live,
  now,
}: {
  person: PresencePerson;
  live: LiveState;
  now: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Resolved top, clamped to keep the whole card on-screen with a margin.
  // Null until measured, so the card doesn't flash at an unclamped position.
  const [top, setTop] = useState<number | null>(null);

  const fullText = statusText(person, now);
  const emoji = statusEmoji(person, now);
  const remaining = remainingLabel(person.status_until, now);
  const lastSeen =
    live === "online"
      ? "Active now"
      : person.last_seen_at
        ? `Last seen ${formatRelative(person.last_seen_at, new Date(now))}`
        : "Never signed in";

  const open = () => {
    if (ref.current) {
      setTop(ref.current.getBoundingClientRect().top); // seed near the row
      setRect(ref.current.getBoundingClientRect());
    }
  };
  const close = () => setRect(null);

  // Once the card has rendered we know its real height — clamp its top so it
  // never runs off the top or bottom edge, keeping an 8px margin either side.
  // Prefer aligning to the row; only shift up when the row sits too low.
  useLayoutEffect(() => {
    if (!rect || !cardRef.current) return;
    const MARGIN = 8;
    const h = cardRef.current.offsetHeight;
    const maxTop = window.innerHeight - h - MARGIN;
    setTop(Math.max(MARGIN, Math.min(rect.top, maxTop)));
  }, [rect]);

  return (
    <div
      ref={ref}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      tabIndex={0}
      className="rounded-md outline-none focus-visible:bg-raised"
    >
      <PresenceRow person={person} live={live} now={now} />

      {rect &&
        createPortal(
          <div
            ref={cardRef}
            role="tooltip"
            style={{
              position: "fixed",
              top: top ?? rect.top,
              left: rect.right + 8,
              zIndex: 60,
            }}
            className="w-60 animate-pop-in rounded-lg border border-line-strong bg-raised/95 p-3 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span
                style={{ color: person.color }}
                className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-xs font-semibold"
              >
                {initials(person.name)}
                <span
                  className={cn(
                    "absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-raised",
                    DOT[live]
                  )}
                />
              </span>
              <div className="min-w-0">
                <p
                  style={{ color: person.color }}
                  className="truncate text-[13px] font-semibold"
                >
                  {person.name}
                </p>
                <p className="text-[11px] text-faint">{LIVE_LABEL[live]}</p>
              </div>
            </div>

            {fullText && (
              <p className="mt-2.5 flex gap-1.5 text-[13px] leading-snug text-ink">
                {emoji && (
                  <span className="shrink-0" aria-hidden>
                    {emoji}
                  </span>
                )}
                {/* Full status — wraps, never truncated. */}
                <span className="min-w-0 wrap-break-word">{fullText}</span>
              </p>
            )}

            <div className="mt-2.5 space-y-1 border-t border-line pt-2 text-[11px] text-muted">
              {remaining && (
                <p className="flex items-center justify-between">
                  <span>Clears in</span>
                  <span className="font-mono text-faint">{remaining}</span>
                </p>
              )}
              <p className="flex items-center justify-between">
                <span>Call</span>
                <span
                  className={cn(
                    "flex items-center gap-1",
                    person.available_to_call ? "text-primary-dim" : "text-faint"
                  )}
                >
                  <Phone className="size-3" aria-hidden />
                  {person.available_to_call ? "Available" : "Not now"}
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span>Presence</span>
                <span className="text-faint">{lastSeen}</span>
              </p>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * Always-open team presence panel for the sidebar. Three honest signals per
 * person: a LIVE online/away dot (presence channels), a manual status (emoji +
 * label), and available-to-call. My status opens a modal editor; teammates are
 * read-only with a hover card for detail, sorted online-first then callable.
 */
export function SidebarPresence({
  people,
  meId,
}: {
  people: PresencePerson[];
  meId: string;
}) {
  const { pending, run } = useAction();
  const live = useLivePresence(meId);

  // A ticking "now" so countdowns update and expired statuses fall away on their
  // own, without waiting for an unrelated refresh. Coarse (30s) — presence timing
  // needn't be to-the-second, and it keeps re-renders cheap.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  const [editing, setEditing] = useState(false);

  const me = people.find((p) => p.id === meId);

  function stateOf(id: string): LiveState {
    return live[id] ?? "offline";
  }

  function setStatus(fields: {
    kind: StatusKind;
    emoji?: string | null;
    text?: string | null;
    call: boolean;
    durationMs: number;
  }) {
    run(() =>
      updateMyStatus({
        kind: fields.kind,
        emoji: fields.emoji,
        text: fields.text,
        availableToCall: fields.call,
        durationMs: fields.durationMs,
      })
    );
  }

  const onlineCount = people.filter((p) => stateOf(p.id) === "online").length;

  const others = [...people]
    .filter((p) => p.id !== meId)
    .sort(
      (a, b) =>
        Number(stateOf(b.id) === "online") - Number(stateOf(a.id) === "online") ||
        Number(b.available_to_call) - Number(a.available_to_call) ||
        a.name.localeCompare(b.name)
    );

  return (
    <div className="space-y-0.5 border-t border-line px-2 py-2">
      <p className="flex items-baseline justify-between px-2 pb-1 pt-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
          Team
        </span>
        <span className="font-mono text-[10px] text-faint">
          {onlineCount}/{people.length} online
        </span>
      </p>

      {me && (
        <>
          <PresenceRow
            person={me}
            live={stateOf(me.id)}
            now={now}
            label="You"
            active={editing}
            onClick={() => setEditing((v) => !v)}
          />
          {editing && (
            <StatusModal
              me={me}
              now={now}
              pending={pending}
              onSet={setStatus}
              onClose={() => setEditing(false)}
            />
          )}
        </>
      )}

      {others.map((p) => (
        <TeammateRow key={p.id} person={p} live={stateOf(p.id)} now={now} />
      ))}
    </div>
  );
}

/**
 * The whole team's status, as a sheet — for mobile.
 *
 * The desktop panel shows this inline with hover cards, which don't exist on
 * touch, so on a phone there was no way to see who's around or what anyone is
 * doing. Rows are expanded rather than hover-revealed: everything (status text,
 * remaining time, call availability, last seen) is on the row itself.
 */
export function TeamSheet({
  people,
  meId,
  onClose,
}: {
  people: PresencePerson[];
  meId: string;
  onClose: () => void;
}) {
  const live = useLivePresence(meId);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const stateOf = (id: string): LiveState => live[id] ?? "offline";
  const sorted = [...people].sort(
    (a, b) =>
      Number(stateOf(b.id) === "online") - Number(stateOf(a.id) === "online") ||
      Number(b.available_to_call) - Number(a.available_to_call) ||
      (a.id === meId ? -1 : b.id === meId ? 1 : a.name.localeCompare(b.name))
  );
  const onlineCount = people.filter((p) => stateOf(p.id) === "online").length;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Team status"
      className="fixed inset-0 z-60 flex items-end md:hidden"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-bg/70 backdrop-blur-sm motion-safe:animate-[overlay-in_150ms_var(--ease-mac)_both]"
      />
      <div className="relative flex max-h-[85vh] w-full flex-col rounded-t-2xl border-t border-line-strong bg-raised/95 backdrop-blur-md motion-safe:animate-[sheet-up_260ms_var(--ease-mac)_both]">
        {/* Grab handle — the affordance that says "this sheet is dismissible". */}
        <span
          className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong"
          aria-hidden
        />
        <div className="flex items-center justify-between px-5 pb-3 pt-3">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Team
          </h2>
          <span className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-faint">
              {onlineCount}/{people.length} online
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1.5 text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </span>
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {sorted.map((p) => {
            const state = stateOf(p.id);
            const text = statusText(p, now);
            const emoji = statusEmoji(p, now);
            const remaining = remainingLabel(p.status_until, now);
            return (
              <li key={p.id} className="flex items-start gap-3 px-5 py-3">
                <span className="relative shrink-0" aria-hidden>
                  <span
                    style={{ backgroundColor: p.color }}
                    className="grid size-9 place-items-center rounded-full text-[11px] font-semibold text-bg"
                  >
                    {initials(p.name)}
                  </span>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-raised",
                      state === "online"
                        ? "bg-primary"
                        : state === "away"
                          ? "bg-amber"
                          : "bg-line-strong"
                    )}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-medium text-ink">
                      {p.id === meId ? "You" : p.name}
                    </span>
                    {p.available_to_call && (
                      <Phone className="size-3 shrink-0 text-primary-dim" aria-hidden />
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted">
                    {emoji && <span className="mr-1">{emoji}</span>}
                    {text ?? (state === "online" ? "Online" : "No status")}
                    {remaining && <span className="text-faint"> · {remaining}</span>}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body
  );
}

/**
 * Set-your-status, for the mobile top bar.
 *
 * The whole presence panel lives inside the desktop `<aside>`, which is
 * `hidden md:flex` — so on a phone there was NO way to change your own status
 * at all (reported by Sait, 2026-07-19). Rather than duplicate the editor, this
 * is just a trigger that opens the same portaled `StatusModal`; teammates'
 * presence stays desktop-only, since that's a browsing affordance and this is
 * the one thing you cannot otherwise do.
 */
export function StatusButton({
  people,
  meId,
}: {
  people: PresencePerson[];
  meId: string;
}) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  const me = people.find((p) => p.id === meId);
  if (!me) return null;

  const emoji = statusEmoji(me, now);

  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Set your status"
        title="Set your status"
        className="flex size-8 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
      >
        {emoji ? (
          <span className="text-base leading-none" aria-hidden>
            {emoji}
          </span>
        ) : (
          <Smile className="size-4" aria-hidden />
        )}
      </button>
      {editing && (
        <StatusModal
          me={me}
          now={now}
          pending={pending}
          onSet={(fields) =>
            run(() =>
              updateMyStatus({
                kind: fields.kind,
                emoji: fields.emoji,
                text: fields.text,
                availableToCall: fields.call,
                durationMs: fields.durationMs,
              })
            )
          }
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
