"use client";

import { useState } from "react";
import { ChevronDown, KeyRound, Loader2, Palette, Trash2 } from "lucide-react";
import {
  deleteUser,
  setUserPassword,
  updateAccess,
} from "@/lib/actions/admin";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminColorPicker } from "@/components/account/color-form";
import { useAction } from "@/lib/use-action";
import { memberColorCss } from "@/lib/colors";
import { SECTIONS, SECTION_LABELS, type Section } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  color: string | null;
  sections: Section[];
};

function shortLabel(section: Section) {
  return SECTION_LABELS[section].replace("Kagu ", "");
}

export function UserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const { pending: busy, run, toast } = useAction();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showColor, setShowColor] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  function apply(sections: Section[], isAdmin: boolean) {
    run(() => updateAccess(user.id, sections, isAdmin));
  }

  function toggleSection(section: Section) {
    const has = user.sections.includes(section);
    let next = has
      ? user.sections.filter((s) => s !== section)
      : [...user.sections, section];
    if (section === "learn" && has && next.includes("work")) {
      toast.error("Work members must stay in Learn — remove Work first.");
      return;
    }
    if (section === "work" && !has && !next.includes("learn")) next = [...next, "learn"];
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
        </div>

        {/* Access summary: which sections, compact */}
        <p className="hidden max-w-[45%] truncate text-[13px] text-muted sm:block">
          {user.sections.length > 0
            ? user.sections.map(shortLabel).join(" · ")
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {SECTIONS.map((section) => (
                <Checkbox
                  key={section}
                  size="sm"
                  className="text-[13px]"
                  label={shortLabel(section)}
                  checked={user.sections.includes(section)}
                  onChange={() => toggleSection(section)}
                  disabled={busy}
                />
              ))}
              <Checkbox
                size="sm"
                className="ml-2 text-[13px]"
                label="Admin"
                checked={user.is_admin}
                onChange={() => apply(user.sections, !user.is_admin)}
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
