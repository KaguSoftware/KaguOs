"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { joinSprint, leaveSprint } from "@/lib/actions/learn";
import { useAction } from "@/lib/use-action";
import { Button } from "@/components/ui/button";

/**
 * Self-enrollment, one click. Joining is a plain primary action; leaving only
 * appears before the sprint starts, because once it's running your ticks are in
 * everyone else's standings and quietly vanishing from them isn't on offer.
 *
 * No optimistic flip here: joining changes which section of the catalogue this
 * sprint belongs to, so the server re-render is the honest source of truth and
 * a local guess would make the card jump twice.
 */
export function JoinSprintButton({
  sprintId,
  joined,
  canLeave,
}: {
  sprintId: string;
  joined: boolean;
  /** The sprint hasn't started yet. */
  canLeave: boolean;
}) {
  const { pending, run } = useAction();

  if (joined) {
    if (!canLeave) {
      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-primary-dim">
          <Check className="size-3.5" aria-hidden />
          Joined
        </span>
      );
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-busy={pending}
        onClick={() => run(() => leaveSprint(sprintId), { success: "You left the sprint." })}
      >
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        Leave
      </Button>
    );
  }

  return (
    <Button
      variant="primary"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      onClick={() => run(() => joinSprint(sprintId), { success: "You're in." })}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Plus className="size-3.5" aria-hidden />
      )}
      Join
    </Button>
  );
}
