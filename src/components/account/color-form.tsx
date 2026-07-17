"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateMyColor } from "@/lib/actions/account";
import { setUserColor } from "@/lib/actions/admin";
import { ColorPicker } from "@/components/ui/color-picker";
import { cn } from "@/lib/utils";

export function MyColorForm({
  current,
  teamColors = [],
}: {
  current: string | null;
  teamColors?: { id: string; name: string; css: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3 p-4">
      <ColorPicker
        value={current}
        disabled={pending}
        onChange={(key) => {
          setError(null);
          startTransition(async () => {
            const result = await updateMyColor(key);
            if (result && !result.ok) setError(result.message);
          });
        }}
      />
      <div className="flex items-center gap-2">
        {pending && <Loader2 className="size-3.5 animate-spin text-faint" aria-hidden />}
        <p className={cn("text-[13px]", error ? "text-danger" : "text-faint")}>
          {error ?? "Your name shows in this color everywhere — tasks you claim, comments, progress."}
        </p>
      </div>

      {teamColors.length > 0 && (
        <div className="border-t border-line pt-3">
          <p className="mb-2 text-xs text-faint">
            Taken by the team — pick something that stands apart:
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {teamColors.map((m) => (
              <li key={m.id} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: m.css }}
                  aria-hidden
                />
                <span className="text-[13px]" style={{ color: m.css }}>
                  {m.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Admin override variant — same picker, targets any user. */
export function AdminColorPicker({
  userId,
  current,
}: {
  userId: string;
  current: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      <ColorPicker
        value={current}
        disabled={pending}
        onChange={(key) => {
          setError(null);
          startTransition(async () => {
            const result = await setUserColor(userId, key);
            if (result && !result.ok) setError(result.message);
          });
        }}
      />
      {error && (
        <p role="status" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
