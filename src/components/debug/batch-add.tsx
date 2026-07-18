"use client";

import { useState } from "react";
import { ListPlus, X } from "lucide-react";
import { quickAddTasks } from "@/lib/actions/debug";
import { Dropdown } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { DebugTask } from "@/lib/types";

/**
 * The brainstorm capture bar: one input, Enter posts + clears + keeps focus.
 * Paste a multi-line list and it offers to add the whole thing at once.
 * No fields beyond the target board — details are for triage, right after,
 * via the inline edit the rows already have.
 */
export function BatchAddBar({
  projects,
  initialProject,
  count,
  onAdded,
  onClose,
}: {
  projects: { id: string; name: string }[];
  /** Board tab the bar opened from ("" = General). */
  initialProject: string;
  /** Tasks added this session so far (shown live in the bar). */
  count: number;
  onAdded: (tasks: DebugTask[]) => void;
  onClose: () => void;
}) {
  const { error: toastError } = useToast();
  const [project, setProject] = useState(initialProject);
  const [text, setText] = useState("");
  const [pendingPaste, setPendingPaste] = useState<string[] | null>(null);

  function submit(titles: string[]) {
    const clean = titles.map((t) => t.trim()).filter(Boolean);
    if (clean.length === 0) return;
    // No pending-lock: the input stays live so the next line can be typed while
    // this one is in flight. Failures restore the text instead of losing it.
    quickAddTasks(clean, project || null)
      .then((res) => {
        if (res.ok && res.tasks) onAdded(res.tasks);
        else {
          toastError(res.message || "Couldn't add.");
          setText((cur) => cur || clean.join("; "));
        }
      })
      .catch(() => {
        toastError("Couldn't add — check the connection.");
        setText((cur) => cur || clean.join("; "));
      });
  }

  const projectOptions = [
    { value: "", label: "General" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="animate-pop-in rounded-lg border border-primary/25 bg-surface p-2">
      <div className="flex flex-wrap items-center gap-2">
        <ListPlus className="ml-1 size-4 shrink-0 text-primary-dim" aria-hidden />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit([text]);
              setText("");
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (pasted.includes("\n")) {
              e.preventDefault();
              const lines = pasted
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean);
              if (lines.length > 1) setPendingPaste(lines);
              else setText((cur) => cur + (lines[0] ?? ""));
            }
          }}
          autoFocus
          placeholder="Type a task, hit Enter, keep going… (Esc closes)"
          aria-label="New task title"
          data-no-ring
          className="h-9 min-w-40 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
        />
        <Dropdown
          className="w-40"
          value={project}
          options={projectOptions}
          onChange={setProject}
        />
        {count > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary-dim">
            {count} added
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close batch add"
          className="rounded-md p-1.5 text-faint transition-colors duration-150 hover:bg-raised hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {pendingPaste && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2 pl-1">
          <p className="text-[13px] text-muted">
            Pasted list — add{" "}
            <span className="font-medium text-ink">
              {pendingPaste.length} tasks
            </span>
            ?
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingPaste(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                submit(pendingPaste);
                setPendingPaste(null);
              }}
            >
              Add {pendingPaste.length}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
