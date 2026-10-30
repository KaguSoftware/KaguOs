"use client";

import { useState } from "react";
import { quickAddCases } from "@/lib/actions/testing";
import { formatGroup, groupSegments, MAX_CASES_PER_BATCH } from "@/lib/testing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

/**
 * Paste a list, get a checklist. Opened from the toolbar it adds to the
 * project; opened from a group's header (`base`) everything lands inside
 * that group, and a `Sub > Part:` prefix nests further below it.
 */
export function QuickAdd({
  projectId,
  projectName,
  base,
  onClose,
}: {
  projectId: string;
  projectName: string;
  base: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const res = await quickAddCases(projectId, draft, base);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    setDraft("");
    onClose();
  }

  const target = base ? groupSegments(base).at(-1) : projectName;

  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
      <Textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          if (e.key === "Escape") onClose();
        }}
        rows={5}
        placeholder={
          base
            ? `One check per line — they go in ${formatGroup(base)}.\nTap Book opens the booking sheet\nPrice tag: Shows the court's price for the slot`
            : "One check per line. Group with a colon, nest with >:\nMobile app > Home > Booking card: Tap Book opens the sheet\nMobile app > Login: Log in with Google\nAdmin: Export bookings as CSV"
        }
        aria-label={base ? `Checks to add to ${formatGroup(base)}` : "Checks to add"}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[calc(12px*var(--text-scale,1))] text-faint">
          Up to {MAX_CASES_PER_BATCH} at a time · a line like{" "}
          <span className="font-mono">Home &gt; Header:</span> heads the lines under it, up to a blank line ·
          Ctrl+Enter to add
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" disabled={busy || !draft.trim()} onClick={submit}>
            Add to {target}
          </Button>
        </div>
      </div>
    </div>
  );
}
