"use client";

import { useState } from "react";
import { ChevronDown, KeyRound, Loader2, Palette, Trash2 } from "lucide-react";
import {
  deleteUser,
  setUserPassword,
  updateAccess,
  type AccessMap,
} from "@/lib/actions/admin";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminColorPicker } from "@/components/account/color-form";
import { useAction } from "@/lib/use-action";
import { memberColorCss } from "@/lib/colors";
import { SECTIONS, SECTION_LABELS, type Section } from "@/lib/types";
import type { SectionAccess } from "@/lib/data/session";
import { cn, formatRelative } from "@/lib/utils";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  color: string | null;
  /** section -> tier. A missing key means no access to that section at all. */
  access: AccessMap;
  last_seen_at: string | null;
};

function shortLabel(section: Section) {
  return SECTION_LABELS[section].replace("Kagu ", "");
}

/** "Last seen" line. Within ~5 min counts as online (the bump throttle window). */
function LastSeen({ at }: { at: string | null }) {
  if (!at) return <p className="text-xs text-faint">Never signed in</p>;
  const online = new Date().getTime() - Date.parse(at) < 6 * 60 * 1000;
  return (
    <p className="flex items-center gap-1.5 text-xs text-faint">
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          online ? "bg-primary" : "bg-line-strong"
        )}
      />
      {online ? "Online now" : `Seen ${formatRelative(at)}`}
    </p>
  );
}

export function UserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const { pending: busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showColor, setShowColor] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const granted = SECTIONS.filter((s) => user.access[s]);

  function apply(access: AccessMap, isAdmin: boolean) {
    run(() => updateAccess(user.id, access, isAdmin));
  }

  /**
   * Set one section to a tier, or remove it entirely with null. Every section is
   * independent — no implied grants, nothing that refuses to come off. Work used
   * to force Learn and Debug on; 0051 removed that rule.
   */
  function setSection(section: Section, tier: SectionAccess | null) {
    const next: AccessMap = { ...user.access };
    if (tier === null) delete next[section];
    else next[section] = tier;
    apply(next, user.is_admin);
  }

  return (
    <div className="border-b border-line last:border-b-0">
      {/* Collapsed summary — identity, access at a glance, one way in */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: memberColorCss(user.id, user.color) }}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
            {user.full_name || user.email}
            {isSelf && <span className="text-xs font-normal text-faint">(you)</span>}
            {user.is_admin && <Badge tone="green">admin</Badge>}
          </p>
          <p className="truncate text-[13px] text-faint">{user.email}</p>
          <LastSeen at={user.last_seen_at} />
        </div>

        {/* Access summary: which sections, compact */}
        <p className="hidden max-w-[45%] truncate text-[13px] text-muted sm:block">
          {granted.length > 0
            ? granted
                .map((s) =>
                  user.access[s] === "read" ? `${shortLabel(s)} (view)` : shortLabel(s)
                )
                .join(" · ")
            : "No sections"}
        </p>

        {busy && <Loader2 className="size-3.5 shrink-0 animate-spin text-faint" aria-hidden />}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[13px] text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
        >
          Manage
          <ChevronDown
            className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      {/* Expanded: everything editable lives here, out of the default view */}
      {open && (
        <div className="space-y-4 border-t border-line bg-surface/60 px-4 py-3.5">
          <div>
            <p className="mb-2 text-xs font-medium text-faint">Access</p>
            {/* Two decisions per section, kept visually separate: the
                checkbox says WHETHER, the segmented control says HOW MUCH. A
                tri-state checkbox would collapse them into one control with a
                state nobody can name. View/Edit only appears once the section
                is on — there is no tier for access you don't have. */}
            <div className="grid gap-1.5 sm:grid-cols-2">
              {SECTIONS.map((section) => {
                const tier = user.access[section];
                return (
                  <div key={section} className="flex items-center gap-2">
                    <Checkbox
                      size="sm"
                      className="min-w-0 flex-1 text-[13px]"
                      label={shortLabel(section)}
                      checked={Boolean(tier)}
                      onChange={() => setSection(section, tier ? null : "write")}
                      disabled={busy}
                    />
                    {tier && (
                      <div
                        role="group"
                        aria-label={`${shortLabel(section)} access level`}
                        className="flex shrink-0 overflow-hidden rounded-md border border-line"
                      >
                        {(["read", "write"] as const).map((level) => (
                          <button
                            key={level}
                            type="button"
                            aria-pressed={tier === level}
                            disabled={busy}
                            onClick={() => setSection(section, level)}
                            className={cn(
                              "px-2 py-0.5 text-[11px] transition-colors duration-150 disabled:opacity-50",
                              tier === level
                                ? "bg-raised text-ink"
                                : "text-faint hover:text-muted"
                            )}
                          >
                            {level === "read" ? "View" : "Edit"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 border-t border-line pt-2.5">
              <Checkbox
                size="sm"
                className="text-[13px]"
                label="Admin — full write access everywhere, plus this page"
                checked={user.is_admin}
                onChange={() => apply(user.access, !user.is_admin)}
                disabled={busy || isSelf}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowColor((v) => !v);
                setShowPassword(false);
              }}
            >
              <Palette className="size-3.5" aria-hidden />
              Color
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowPassword((v) => !v);
                setShowColor(false);
              }}
            >
              <KeyRound className="size-3.5" aria-hidden />
              Password
            </Button>
            {!isSelf && (
              <ConfirmButton
                size="sm"
                confirmLabel="Really delete?"
                onConfirm={() =>
                  run(() => deleteUser(user.id), { success: "User deleted." })
                }
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete
              </ConfirmButton>
            )}
          </div>

          {showColor && <AdminColorPicker userId={user.id} current={user.color} />}

          {showPassword && (
            <form
              className="flex max-w-md items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                run(() => setUserPassword(user.id, newPassword), {
                  success: "Password set.",
                  onSuccess: () => {
                    setNewPassword("");
                    setShowPassword(false);
                  },
                });
              }}
            >
              <Input
                type="text"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                required
                placeholder="New temp password (min 8 chars)"
                className="h-8 text-[13px]"
              />
              <Button type="submit" variant="primary" size="sm" disabled={busy}>
                Set
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
