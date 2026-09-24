"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Ban,
  Bug,
  Check,
  ChevronDown,
  ImageIcon,
  RotateCcw,
  X,
} from "lucide-react";
import {
  deleteCase,
  recordResult,
  resetCase,
  updateCase,
} from "@/lib/actions/testing";
import { ENV_LABEL, STALE_DAYS, STATUS_LABEL } from "@/lib/testing";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { FailSheet } from "@/components/testing/fail-sheet";
import { ResultImages } from "@/components/testing/result-images";
import { cn, formatRelative } from "@/lib/utils";
import type {
  MembersMap,
  TestCase,
  TestEnvironment,
  TestOutcome,
  TestResult,
  TestResultImage,
  TestStatus,
} from "@/lib/types";

const TONE: Record<TestStatus, BadgeTone> = {
  untested: "faint",
  pass: "green",
  fail: "danger",
  blocked: "amber",
  retest: "info",
};

export function CaseRow({
  testCase: c,
  stale,
  results,
  imagesByResult,
  members,
  env,
  canEdit,
  canDelete,
  canSeeDebug,
}: {
  testCase: TestCase;
  stale: boolean;
  results: TestResult[];
  imagesByResult: Map<string, TestResultImage[]>;
  members: MembersMap;
  env: TestEnvironment;
  canEdit: boolean;
  canDelete: boolean;
  canSeeDebug: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [failing, setFailing] = useState(false);
  const [pending, setPending] = useState<TestOutcome | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    area: c.area ?? "",
    title: c.title,
    steps: c.steps ?? "",
    expected: c.expected ?? "",
  });

  const tester = c.last_tested_by ? members[c.last_tested_by]?.name : null;

  async function quick(status: Exclude<TestOutcome, "fail">) {
    setPending(status);
    const res = await recordResult(c.id, { status, environment: env });
    setPending(null);
    if (res && !res.ok) toast.error(res.message);
    else if (res) toast.success(res.message);
  }

  async function save() {
    const res = await updateCase(c.id, form);
    if (res && !res.ok) {
      toast.error(res.message);
      return;
    }
    setEditing(false);
  }

  async function reset() {
    const res = await resetCase(c.id);
    if (res && !res.ok) toast.error(res.message);
  }

  async function remove() {
    const res = await deleteCase(c.id);
    if (res && !res.ok) toast.error(res.message);
    else if (res) toast.success(res.message);
  }

  return (
    <li className={cn(c.status === "fail" && "bg-danger/[0.03]")}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-faint transition-transform duration-150",
              !open && "-rotate-90"
            )}
            aria-hidden
          />
          <Badge tone={TONE[c.status]} className="w-[4.75rem] justify-center">
            {STATUS_LABEL[c.status]}
          </Badge>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-ink">{c.title}</span>
            <span className="block truncate text-[calc(12px*var(--text-scale,1))] text-faint">
              {c.last_tested_at ? (
                <>
                  {tester ?? "Someone"} · {formatRelative(c.last_tested_at)}
                  {c.last_environment && ` · ${ENV_LABEL[c.last_environment]}`}
                </>
              ) : (
                "Never tested"
              )}
              {stale && (
                <span className="text-amber" title={`Not checked in ${STALE_DAYS}+ days`}>
                  {" "}· stale
                </span>
              )}
            </span>
          </span>
        </button>

        {c.debug_task_id && canSeeDebug && (
          <Link
            href="/debug"
            title="Open the Debug board"
            className="hidden shrink-0 items-center gap-1 text-[calc(12px*var(--text-scale,1))] text-faint transition-colors duration-150 hover:text-ink sm:inline-flex"
          >
            <Bug className="size-3.5" aria-hidden />
            Debug
          </Link>
        )}

        {canEdit && (
          <div className="flex shrink-0 gap-1">
            <ResultButton
              label="Works"
              icon={Check}
              tone="pass"
              busy={pending === "pass"}
              onClick={() => quick("pass")}
            />
            <ResultButton
              label="Broken"
              icon={X}
              tone="fail"
              onClick={() => setFailing(true)}
            />
            <ResultButton
              label="Blocked"
              icon={Ban}
              tone="blocked"
              busy={pending === "blocked"}
              onClick={() => quick("blocked")}
            />
          </div>
        )}
      </div>

      {open && (
        <div className="space-y-4 border-t border-line bg-raised/40 px-4 py-3 pl-10">
          {editing ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </Field>
              <Field label="Area">
                <Input
                  value={form.area}
                  placeholder="e.g. Auth"
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                />
              </Field>
              <div className="hidden sm:block" />
              <Field label="How to test">
                <Textarea
                  value={form.steps}
                  placeholder={"1. Open the app logged out\n2. Tap Continue with Google"}
                  onChange={(e) => setForm({ ...form, steps: e.target.value })}
                />
              </Field>
              <Field label="Should happen">
                <Textarea
                  value={form.expected}
                  placeholder="Lands on the dashboard, name shown top right"
                  onChange={(e) => setForm({ ...form, expected: e.target.value })}
                />
              </Field>
              <div className="flex gap-2 sm:col-span-2">
                <Button size="sm" variant="primary" onClick={save}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="How to test" value={c.steps} />
              <Detail label="Should happen" value={c.expected} />
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-faint">History</p>
            {results.length === 0 ? (
              <p className="text-[calc(13px*var(--text-scale,1))] text-faint">
                No results yet.
              </p>
            ) : (
              <ol className="space-y-2">
                {results.slice(0, 10).map((r) => (
                  <li key={r.id} className="text-[calc(13px*var(--text-scale,1))]">
                    <div className="flex flex-wrap items-center gap-x-2 text-muted">
                      <Badge tone={TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      <span>
                        {(r.tester_id && members[r.tester_id]?.name) || "Someone"}
                      </span>
                      <span className="text-faint">
                        {formatRelative(r.created_at)} · {ENV_LABEL[r.environment]}
                      </span>
                      {(imagesByResult.get(r.id)?.length ?? 0) > 0 && (
                        <ImageIcon className="size-3 text-faint" aria-label="Has screenshots" />
                      )}
                    </div>
                    {r.note && (
                      <p className="mt-1 whitespace-pre-wrap text-ink">{r.note}</p>
                    )}
                    <ResultImages images={imagesByResult.get(r.id) ?? []} />
                  </li>
                ))}
                {results.length > 10 && (
                  <li className="text-[calc(12px*var(--text-scale,1))] text-faint">
                    + {results.length - 10} older
                  </li>
                )}
              </ol>
            )}
          </div>

          {canEdit && !editing && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  // Start from the row as it is NOW — realtime may have
                  // changed it since this component first mounted.
                  setForm({
                    area: c.area ?? "",
                    title: c.title,
                    steps: c.steps ?? "",
                    expected: c.expected ?? "",
                  });
                  setEditing(true);
                }}
              >
                Edit
              </Button>
              {c.status !== "untested" && (
                <Button size="sm" variant="ghost" onClick={reset} title="Features changed — test from scratch">
                  <RotateCcw className="size-3.5" aria-hidden />
                  Reset to untested
                </Button>
              )}
              {canDelete && (
                <ConfirmButton size="sm" onConfirm={remove}>
                  Delete
                </ConfirmButton>
              )}
            </div>
          )}
        </div>
      )}

      {failing && (
        <FailSheet
          testCase={c}
          defaultEnv={env}
          onClose={() => setFailing(false)}
        />
      )}
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-faint">{label}</p>
      <p className="whitespace-pre-wrap text-[calc(13px*var(--text-scale,1))] text-ink">
        {value || <span className="text-faint">—</span>}
      </p>
    </div>
  );
}

const BUTTON_TONE: Record<"pass" | "fail" | "blocked", string> = {
  pass: "hover:border-primary/40 hover:bg-primary/10 hover:text-primary-dim",
  fail: "hover:border-danger/40 hover:bg-danger/10 hover:text-danger",
  blocked: "hover:border-amber/40 hover:bg-amber/10 hover:text-amber",
};

function ResultButton({
  label,
  icon: Icon,
  tone,
  busy,
  onClick,
}: {
  label: string;
  icon: typeof Check;
  tone: "pass" | "fail" | "blocked";
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2 text-[calc(13px*var(--text-scale,1))] text-muted transition-colors duration-150 disabled:opacity-50",
        BUTTON_TONE[tone]
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
