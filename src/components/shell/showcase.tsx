"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Lock, Sparkles } from "lucide-react";
import { enterShowcase, exitShowcase } from "@/lib/actions/showcase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/lib/use-action";

/** Dashboard button to enter showcase mode. */
export function ShowcaseToggle() {
  const router = useRouter();
  const { pending, run } = useAction();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        run(() => enterShowcase(), {
          success: "Showcase mode on — showing demo data.",
          onSuccess: () => router.refresh(),
        })
      }
      className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] text-muted transition-colors duration-150 hover:border-primary/40 hover:bg-raised hover:text-ink disabled:opacity-50"
    >
      <Sparkles className="size-3.5 text-faint" aria-hidden />
      Showcase mode
    </button>
  );
}

/**
 * The banner shown app-wide while in showcase mode. Exiting is gated by the
 * account password (verified server-side) so a client being shown the demo
 * can't flip back to real data.
 */
export function ShowcaseBanner() {
  const router = useRouter();
  const { pending, run } = useAction();
  const [prompting, setPrompting] = useState(false);
  const [password, setPassword] = useState("");

  function exit() {
    run(() => exitShowcase(password), {
      success: "Back to real data.",
      onSuccess: () => {
        setPassword("");
        setPrompting(false);
        router.refresh();
      },
    });
  }

  return (
    <div className="sticky top-0 z-20 border-b border-amber/30 bg-amber/10 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 md:px-8">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-amber">
          <Eye className="size-3.5" aria-hidden />
          Showcase mode — everything you see is demo data.
        </span>

        {prompting ? (
          <form
            className="ml-auto flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              exit();
            }}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoFocus
              className="h-7 w-40 text-[13px]"
            />
            <Button type="submit" variant="primary" size="sm" disabled={pending || !password}>
              Exit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPrompting(false);
                setPassword("");
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setPrompting(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-amber/40 px-2.5 py-1 text-xs font-medium text-amber transition-colors hover:bg-amber/15"
          >
            <Lock className="size-3" aria-hidden />
            Exit showcase
          </button>
        )}
      </div>
    </div>
  );
}
