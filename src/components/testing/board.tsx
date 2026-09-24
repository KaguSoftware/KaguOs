"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FlaskConical, ListPlus, Search } from "lucide-react";
import { quickAddCases } from "@/lib/actions/testing";
import {
  ENV_LABEL,
  ENVIRONMENTS,
  isStale,
  MAX_CASES_PER_BATCH,
  STALE_DAYS,
  STATUS_LABEL,
} from "@/lib/testing";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { CaseRow } from "@/components/testing/case-row";
import { cn } from "@/lib/utils";
import type {
  MembersMap,
  TestCase,
  TestEnvironment,
  TestResult,
  TestResultImage,
  TestStatus,
} from "@/lib/types";

type Filter = "all" | TestStatus | "stale";

/** Bar segments, in reading order: the good news first, the gaps last. */
const BAR: { key: TestStatus; className: string }[] = [
  { key: "pass", className: "bg-primary-dim" },
  { key: "retest", className: "bg-info" },
  { key: "blocked", className: "bg-amber" },
  { key: "fail", className: "bg-danger" },
  { key: "untested", className: "bg-line-strong" },
];

const ENV_KEY = "kagu-testing-env";

export function TestingBoard({
  projects,
  cases,
  results,
  images,
  members,
  canEdit,
  canSeeDebug,
  meId,
  isAdmin,
}: {
  projects: { id: string; name: string; status: string }[];
  cases: TestCase[];
  results: TestResult[];
  images: TestResultImage[];
  members: MembersMap;
  canEdit: boolean;
  canSeeDebug: boolean;
  meId: string;
  isAdmin: boolean;
}) {
  const searchParams = useSearchParams();
  const toast = useToast();

  // Tabs: projects that already have checks first (most open work first),
  // then the rest alphabetically — an empty tab is where you start a list.
  const tabs = useMemo(() => {
    const open = new Map<string, number>();
    const total = new Map<string, number>();
    for (const c of cases) {
      total.set(c.project_id, (total.get(c.project_id) ?? 0) + 1);
      if (c.status === "fail" || c.status === "retest" || c.status === "untested") {
        open.set(c.project_id, (open.get(c.project_id) ?? 0) + 1);
      }
    }
    return projects
      .map((p) => ({ ...p, total: total.get(p.id) ?? 0, open: open.get(p.id) ?? 0 }))
      .sort(
        (a, b) =>
          Number(b.total > 0) - Number(a.total > 0) ||
          b.open - a.open ||
          a.name.localeCompare(b.name)
      );
  }, [projects, cases]);

  const [projectId, setProjectId] = useState<string>(() => {
    const wanted = searchParams.get("project");
    if (wanted && projects.some((p) => p.id === wanted)) return wanted;
    return tabs[0]?.id ?? "";
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  // Which environment one-click results are recorded against. Per person and
  // sticky, because whoever tests on staging tests on staging all afternoon.
  const [env, setEnv] = useState<TestEnvironment>("staging");
  // Restored after mount (the server has no storage to render from), in a
  // frame callback like work-filters' restore.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(ENV_KEY) as TestEnvironment | null;
        if (saved && ENVIRONMENTS.includes(saved)) setEnv(saved);
      } catch {
        /* storage blocked — the default is fine */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  // "Stale" is measured from page load; a board open across midnight doesn't
  // need to re-judge itself.
  const [now] = useState(() => Date.now());
  function pickEnv(next: TestEnvironment) {
    setEnv(next);
    try {
      localStorage.setItem(ENV_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function pickProject(id: string) {
    setProjectId(id);
    setFilter("all");
    // Shareable, and it's where the retest bell lands. replaceState, not a
    // router push: the board already holds every row.
    const url = new URL(window.location.href);
    url.searchParams.set("project", id);
    window.history.replaceState(null, "", url);
  }

  const projectCases = useMemo(
    () => cases.filter((c) => c.project_id === projectId),
    [cases, projectId]
  );

  const counts = useMemo(() => {
    const out: Record<TestStatus, number> & { stale: number } = {
      untested: 0,
      pass: 0,
      fail: 0,
      blocked: 0,
      retest: 0,
      stale: 0,
    };
    for (const c of projectCases) {
      out[c.status] += 1;
      if (isStale(c, now)) out.stale += 1;
    }
    return out;
  }, [projectCases, now]);

  const resultsByCase = useMemo(() => {
    const map = new Map<string, TestResult[]>();
    for (const r of results) {
      const list = map.get(r.case_id);
      if (list) list.push(r);
      else map.set(r.case_id, [r]);
    }
    return map;
  }, [results]);

  const imagesByResult = useMemo(() => {
    const map = new Map<string, TestResultImage[]>();
    for (const i of images) {
      const list = map.get(i.result_id);
      if (list) list.push(i);
      else map.set(i.result_id, [i]);
    }
    return map;
  }, [images]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = projectCases.filter((c) => {
      if (filter === "stale" ? !isStale(c, now) : filter !== "all" && c.status !== filter) {
        return false;
      }
      if (!q) return true;
      return [c.title, c.area, c.steps, c.expected].some((f) =>
        f?.toLowerCase().includes(q)
      );
    });
    // Group by area in order of first appearance; ungrouped last.
    const byArea = new Map<string, TestCase[]>();
    for (const c of visible) {
      const key = c.area ?? "";
      const list = byArea.get(key);
      if (list) list.push(c);
      else byArea.set(key, [c]);
    }
    return [...byArea.entries()].sort(([a], [b]) => Number(a === "") - Number(b === ""));
  }, [projectCases, filter, query, now]);

  async function submitQuickAdd() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const res = await quickAddCases(projectId, draft);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    setDraft("");
    setAdding(false);
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No projects yet"
        hint="A checklist belongs to a project. Once there's one in Work, its tab appears here."
      />
    );
  }

  const total = projectCases.length;
  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: total },
    { key: "untested", label: STATUS_LABEL.untested, count: counts.untested },
    { key: "fail", label: STATUS_LABEL.fail, count: counts.fail },
    { key: "retest", label: STATUS_LABEL.retest, count: counts.retest },
    { key: "blocked", label: STATUS_LABEL.blocked, count: counts.blocked },
    { key: "pass", label: STATUS_LABEL.pass, count: counts.pass },
    { key: "stale", label: "Stale", count: counts.stale },
  ];

  return (
    <div className="space-y-4">
      {/* Project tabs — same rail as the Debug board. */}
      <div className="flex items-center border-b border-line">
        <div
          className="scrollbar-none flex min-w-0 flex-1 gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [mask-image:linear-gradient(to_right,transparent,black_1.25rem,black_calc(100%-1.25rem),transparent)]"
          role="tablist"
          aria-label="Projects"
        >
          {tabs.map((tab) => {
            const active = tab.id === projectId;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => pickProject(tab.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors duration-150",
                  active
                    ? "border-primary-dim font-medium text-ink"
                    : "border-transparent text-muted hover:border-line-strong hover:text-ink"
                )}
              >
                {tab.name}
                {tab.open > 0 && (
                  <span className="rounded-full bg-raised px-1.5 font-mono text-[calc(11px*var(--text-scale,1))] text-muted">
                    {tab.open}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Where this project stands, at a glance. */}
      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-ink">
            <span className="font-mono font-semibold">{counts.pass}</span>
            <span className="text-muted"> / {total} working</span>
          </p>
          <p className="text-[calc(12px*var(--text-scale,1))] text-muted">
            {counts.fail > 0 && <span className="text-danger">{counts.fail} broken · </span>}
            {counts.retest > 0 && <span className="text-info">{counts.retest} to retest · </span>}
            {counts.blocked > 0 && <span className="text-amber">{counts.blocked} blocked · </span>}
            {counts.untested} untested
            {counts.stale > 0 && (
              <span title={`Passed, but not checked in ${STALE_DAYS}+ days`}>
                {" "}· {counts.stale} stale
              </span>
            )}
          </p>
        </div>
        <div
          className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-raised"
          role="img"
          aria-label={`${counts.pass} of ${total} checks working`}
        >
          {total > 0 &&
            BAR.map(({ key, className }) =>
              counts[key] > 0 ? (
                <div
                  key={key}
                  className={className}
                  style={{ width: `${(counts[key] / total) * 100}%` }}
                />
              ) : null
            )}
        </div>
      </div>

      {/* Toolbar: status filter · search · environment · add */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[calc(13px*var(--text-scale,1))] transition-colors duration-150",
                filter === f.key
                  ? "border-line-strong bg-raised text-ink"
                  : "border-transparent text-muted hover:text-ink"
              )}
            >
              {f.label}
              {f.key !== "all" && f.count > 0 && (
                <span className="font-mono text-[calc(11px*var(--text-scale,1))] text-faint">
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative min-w-36 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search checks…"
            aria-label="Search checks"
            className="pl-8"
          />
        </div>
        {canEdit && (
          <>
            <Segmented
              label="Testing on"
              size="sm"
              options={ENVIRONMENTS.map((e) => ({
                key: e,
                label: ENV_LABEL[e],
                title: `Record results as tested on ${ENV_LABEL[e].toLowerCase()}`,
              }))}
              value={env}
              onChange={pickEnv}
            />
            <Button size="sm" variant="primary" onClick={() => setAdding((v) => !v)}>
              <ListPlus className="size-3.5" aria-hidden />
              Add checks
            </Button>
          </>
        )}
      </div>

      {adding && canEdit && (
        <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitQuickAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            rows={5}
            placeholder={
              "One check per line. Prefix an area to group them:\nAuth: Sign up with email\nAuth: Log in with Google\nCheckout: Pay with a Turkish card"
            }
            aria-label="Checks to add"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[calc(12px*var(--text-scale,1))] text-faint">
              Up to {MAX_CASES_PER_BATCH} at a time · Ctrl+Enter to add
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={busy || !draft.trim()}
                onClick={submitQuickAdd}
              >
                Add to {tabs.find((t) => t.id === projectId)?.name ?? "project"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {total === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No checks on this project yet"
          hint="List what needs to work before it ships: logins, payments, the flows a client will try first."
          action={
            canEdit && !adding ? (
              <Button size="sm" onClick={() => setAdding(true)}>
                <ListPlus className="size-3.5" aria-hidden />
                Add checks
              </Button>
            ) : undefined
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState icon={Search} title="Nothing matches" hint="Try another filter or search." />
      ) : (
        <div className="space-y-4">
          {groups.map(([area, list]) => (
            <section key={area || "_none"}>
              {(groups.length > 1 || area) && (
                <h3 className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-faint">
                  {area || "Other"}
                  <span className="ml-1.5 font-mono normal-case">
                    {list.filter((c) => c.status === "pass").length}/{list.length}
                  </span>
                </h3>
              )}
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {list.map((c) => (
                  <CaseRow
                    key={c.id}
                    testCase={c}
                    stale={isStale(c, now)}
                    results={resultsByCase.get(c.id) ?? []}
                    imagesByResult={imagesByResult}
                    members={members}
                    env={env}
                    canEdit={canEdit}
                    canDelete={canEdit && (isAdmin || c.created_by === meId)}
                    canSeeDebug={canSeeDebug}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
