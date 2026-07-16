"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import {
  deleteUser,
  setUserPassword,
  updateAccess,
} from "@/lib/actions/admin";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SECTIONS, SECTION_LABELS, type Section } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  sections: Section[];
};

export function UserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  function apply(sections: Section[], isAdmin: boolean) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateAccess(user.id, sections, isAdmin);
      if (result && !result.ok) setMessage({ ok: false, text: result.message });
    });
  }

  function toggleSection(section: Section) {
    const has = user.sections.includes(section);
    let next = has
      ? user.sections.filter((s) => s !== section)
      : [...user.sections, section];
    if (section === "learn" && has && next.includes("work")) {
      setMessage({ ok: false, text: "Work members must stay in Learn — remove Work first." });
      return;
    }
    if (section === "work" && !has && !next.includes("learn")) next = [...next, "learn"];
    apply(next, user.is_admin);
  }

  return (
    <div className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-44 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {user.full_name || "—"}
            {isSelf && <span className="ml-1.5 text-xs text-faint">(you)</span>}
          </p>
          <p className="truncate text-[13px] text-faint">{user.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {SECTIONS.map((section) => (
            <label
              key={section}
              className="flex items-center gap-1.5 text-[13px] text-muted"
            >
              <input
                type="checkbox"
                checked={user.sections.includes(section)}
                onChange={() => toggleSection(section)}
                disabled={pending}
                className="size-3.5 accent-(--primary)"
              />
              {SECTION_LABELS[section].replace("Kagu ", "")}
            </label>
          ))}
          <label className="ml-1 flex items-center gap-1.5 text-[13px] text-muted">
            <input
              type="checkbox"
              checked={user.is_admin}
              onChange={() => apply(user.sections, !user.is_admin)}
              disabled={pending || isSelf}
              className="size-3.5 accent-(--primary)"
            />
            admin
          </label>
        </div>

        <div className="flex items-center gap-1.5">
          {pending && <Loader2 className="size-3.5 animate-spin text-faint" aria-hidden />}
          {user.is_admin && <Badge tone="green">admin</Badge>}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPassword((v) => !v)}
            title="Set a new password"
          >
            <KeyRound className="size-3.5" aria-hidden />
            Password
          </Button>
          {!isSelf && (
            <ConfirmButton
              size="sm"
              confirmLabel="Really delete?"
              onConfirm={() => {
                setMessage(null);
                startTransition(async () => {
                  const result = await deleteUser(user.id);
                  if (result && !result.ok)
                    setMessage({ ok: false, text: result.message });
                });
              }}
            >
              Delete
            </ConfirmButton>
          )}
        </div>
      </div>

      {showPassword && (
        <form
          className="mt-3 flex max-w-md items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage(null);
            startTransition(async () => {
              const result = await setUserPassword(user.id, newPassword);
              if (result) setMessage({ ok: result.ok, text: result.message });
              if (result?.ok) {
                setNewPassword("");
                setShowPassword(false);
              }
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
          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            Set
          </Button>
        </form>
      )}

      {message && (
        <p
          role="status"
          className={cn(
            "mt-2 text-[13px]",
            message.ok ? "text-primary-dim" : "text-danger"
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
