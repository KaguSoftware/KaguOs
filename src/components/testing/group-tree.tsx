"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Pencil, Plus, RotateCcw } from "lucide-react";
import { renameGroup, resetGroup } from "@/lib/actions/testing";
import { formatGroup, GROUP_SEP, groupSegments } from "@/lib/testing";
import { useConfirm } from "@/lib/use-confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { TestCase, TestStatus } from "@/lib/types";

/** The `<datalist>` id every group input suggests from. */
export const GROUPS_DATALIST = "testing-groups";

export type GroupNode = {
  /** Stored form, "Mobile app > Home". "" for the root. */
  path: string;
  name: string;
  /** 1 for a top-level group. */
  depth: number;
  /** Checks directly in this group, not its subgroups. */
  cases: TestCase[];
  children: GroupNode[];
};

export type GroupCounts = Record<TestStatus, number> & { total: number };

/** Groups in order of first appearance — the order checks were added in. */
export function buildGroupTree(cases: TestCase[]): GroupNode {
  const root: GroupNode = { path: "", name: "", depth: 0, cases: [], children: [] };
  const index = new Map<string, GroupNode>([["", root]]);
  for (const c of cases) {
    const parts = groupSegments(c.area);
    let node = root;
    parts.forEach((name, i) => {
      const path = parts.slice(0, i + 1).join(GROUP_SEP);
      let child = index.get(path);
      if (!child) {
        child = { path, name, depth: i + 1, cases: [], children: [] };
        node.children.push(child);
        index.set(path, child);
      }
      node = child;
    });
    node.cases.push(c);
  }
  return root;
}

/**
 * Counts per group, rolled up: a component's checks count toward its page and
 * its app too. Built from the project's whole list, not the filtered one, so a
 * header always tells the truth about its group.
 */
export function countGroups(cases: TestCase[]): Map<string, GroupCounts> {
  const out = new Map<string, GroupCounts>();
  for (const c of cases) {
    const parts = groupSegments(c.area);
    for (let i = 1; i <= parts.length; i++) {
      const path = parts.slice(0, i).join(GROUP_SEP);
      let n = out.get(path);
      if (!n) {
        n = { total: 0, untested: 0, pass: 0, fail: 0, blocked: 0, retest: 0 };
        out.set(path, n);
      }
      n.total += 1;
      n[c.status] += 1;
    }
  }
  return out;
}

/** Bar segments, in reading order: the good news first, the gaps last. */
const BAR: { key: TestStatus; className: string }[] = [
  { key: "pass", className: "bg-primary-dim" },
  { key: "retest", className: "bg-info" },
  { key: "blocked", className: "bg-amber" },
  { key: "fail", className: "bg-danger" },
  { key: "untested", className: "bg-line-strong" },
];

export function StatusBar({
  counts,
  total,
  className,
}: {
  counts: Record<TestStatus, number>;
  total: number;
  className?: string;
}) {
  return (
    <div
      className={cn("flex overflow-hidden rounded-full bg-raised", className)}
      role="img"
      aria-label={`${counts.pass} of ${total} checks working`}
    >
      {total > 0 &&
        BAR.map(({ key, className: segment }) =>
          counts[key] > 0 ? (
            <div
              key={key}
              className={segment}
              style={{ width: `${(counts[key] / total) * 100}%` }}
            />
          ) : null
        )}
    </div>
  );
}

/** Everything a group section needs from the board, passed down the tree. */
export type TreeProps = {
  projectId: string;
  counts: Map<string, GroupCounts>;
  isOpen: (path: string) => boolean;
  onToggle: (path: string) => void;
  /** The group whose inline add box is open, if any. */
  addingAt: string | null;
  onAddHere: (path: string) => void;
  renderAdd: (path: string) => ReactNode;
  renderCase: (c: TestCase) => ReactNode;
  canEdit: boolean;
};

export function CaseList({ cases, render }: { cases: TestCase[]; render: (c: TestCase) => ReactNode }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {cases.map(render)}
    </ul>
  );
}

export function GroupSection({ node, tree }: { node: GroupNode; tree: TreeProps }) {
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(node.path);
  const [busy, setBusy] = useState(false);
  const open = tree.isOpen(node.path);
  const n = tree.counts.get(node.path);
  const top = node.depth === 1;

  async function rename() {
    if (busy) return;
    setBusy(true);
    const res = await renameGroup(tree.projectId, node.path, name);
    setBusy(false);
    if (res && !res.ok) {
      toast.error(res.message);
      return;
    }
    if (res && res.message !== "Nothing changed.") toast.success(res.message);
    setRenaming(false);
  }

  async function reset() {
    const res = await resetGroup(tree.projectId, node.path);
    if (res && !res.ok) toast.error(res.message);
    else if (res) toast.success(res.message);
  }
  const confirmReset = useConfirm(reset);

  return (
    <section aria-label={formatGroup(node.path)}>
      <div className="group/header flex min-h-8 items-center gap-2 px-1">
        {renaming ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              rename();
            }}
          >
            <Input
              autoFocus
              value={name}
              list={GROUPS_DATALIST}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setRenaming(false);
              }}
              aria-label="Group path"
              title="A full path — change the part before > to move it"
              className="h-8 min-w-0 flex-1"
            />
            <Button size="sm" variant="primary" type="submit" disabled={busy}>
              Save
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => tree.onToggle(node.path)}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-faint transition-transform duration-150",
                !open && "-rotate-90"
              )}
              aria-hidden
            />
            <span
              className={cn(
                "truncate",
                top
                  ? "text-xs font-medium uppercase tracking-wide text-faint"
                  : "text-[calc(13px*var(--text-scale,1))] font-medium text-muted"
              )}
            >
              {node.name}
            </span>
            {n && (
              <>
                <span className="shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] text-faint">
                  {n.pass}/{n.total}
                </span>
                <StatusBar counts={n} total={n.total} className="h-1 w-10 shrink-0" />
                {n.fail > 0 && (
                  <span className="shrink-0 text-[calc(11px*var(--text-scale,1))] text-danger">
                    {n.fail} broken
                  </span>
                )}
                {n.fail === 0 && n.retest > 0 && (
                  <span className="shrink-0 text-[calc(11px*var(--text-scale,1))] text-info">
                    {n.retest} to retest
                  </span>
                )}
              </>
            )}
          </button>
        )}

        {tree.canEdit && !renaming && (
          // Always shown on touch screens (no hover), revealed on hover above sm.
          <div className="flex shrink-0 items-center gap-0.5 transition-opacity duration-150 sm:opacity-0 sm:group-hover/header:opacity-100 sm:group-focus-within/header:opacity-100">
            <HeaderAction
              label={`Add checks to ${node.name}`}
              onClick={() => tree.onAddHere(node.path)}
            >
              <Plus className="size-3.5" aria-hidden />
            </HeaderAction>
            <HeaderAction
              label="Rename or move"
              onClick={() => {
                setName(node.path);
                setRenaming(true);
              }}
            >
              <Pencil className="size-3.5" aria-hidden />
            </HeaderAction>
            <HeaderAction
              label={
                confirmReset.armed
                  ? "Click again to reset every check in this group"
                  : "Reset every check in this group to untested"
              }
              onClick={confirmReset.trigger}
              danger={confirmReset.armed}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {confirmReset.armed && (
                <span className="text-[calc(12px*var(--text-scale,1))]">Reset all?</span>
              )}
            </HeaderAction>
          </div>
        )}
      </div>

      {open && (
        <div
          // The guide line shows what sits inside what.
          className="ml-[0.6875rem] mt-1.5 space-y-3 border-l border-line pl-4 sm:pl-6"
        >
          {tree.addingAt === node.path && tree.renderAdd(node.path)}
          {node.cases.length > 0 && <CaseList cases={node.cases} render={tree.renderCase} />}
          {node.children.map((child) => (
            <GroupSection key={child.path} node={child} tree={tree} />
          ))}
        </div>
      )}
    </section>
  );
}

function HeaderAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md px-1.5 transition-colors duration-150",
        danger
          ? "bg-danger/10 text-danger"
          : "text-faint hover:bg-raised hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
