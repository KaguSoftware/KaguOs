"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronsDownUp, ChevronsUpDown, FlaskConical, ListPlus, Search } from "lucide-react";
import {
  ENV_LABEL,
  ENVIRONMENTS,
  isStale,
  STALE_DAYS,
  STATUS_LABEL,
} from "@/lib/testing";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { CaseRow } from "@/components/testing/case-row";
import {
  buildGroupTree,
  CaseList,
  countGroups,
  GROUPS_DATALIST,
  GroupSection,
  StatusBar,
  type TreeProps,
} from "@/components/testing/group-tree";
import { QuickAdd } from "@/components/testing/quick-add";
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

const ENV_KEY = "kagu-testing-env";
/** Collapsed groups, as "<projectId>|<path>". Per person, like the env. */
const COLLAPSED_KEY = "kagu-testing-collapsed";

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
  // Where the add box is open: "" at the top, a group's path inside that
  // group, null closed.
  const [addAt, setAddAt] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

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
        const folded: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
        if (Array.isArray(folded)) {
          setCollapsed(new Set(folded.filter((k) => typeof k === "string")));
        }
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

  function saveCollapsed(next: Set<string>) {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }

  function pickProject(id: string) {
    setProjectId(id);
    setFilter("all");
    setAddAt(null);
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projectCases.filter((c) => {
      if (filter === "stale" ? !isStale(c, now) : filter !== "all" && c.status !== filter) {
        return false;
      }
      if (!q) return true;
      return [c.title, c.area, c.steps, c.expected].some((f) =>
        f?.toLowerCase().includes(q)
      );
    });
  }, [projectCases, filter, query, now]);

  const tree = useMemo(() => buildGroupTree(visible), [visible]);
  const groupCounts = useMemo(() => countGroups(projectCases), [projectCases]);
  // Every group in the project, for the "move to" suggestions and collapse-all.
  const groupPaths = useMemo(() => [...groupCounts.keys()], [groupCounts]);

  // A filter or search is looking for something; folded groups would hide it.
  const searching = filter !== "all" || query.trim() !== "";
  const anyCollapsed = groupPaths.some((p) => collapsed.has(`${projectId}|${p}`));

  function toggleAll() {
    const next = new Set(collapsed);
    for (const p of groupPaths) {
      if (anyCollapsed) next.delete(`${projectId}|${p}`);
      else next.add(`${projectId}|${p}`);
    }
    saveCollapsed(next);
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
  const projectName = tabs.find((t) => t.id === projectId)?.name ?? "project";

  const treeProps: TreeProps = {
    projectId,
    counts: groupCounts,
    isOpen: (path) => searching || !collapsed.has(`${projectId}|${path}`),
    onToggle: (path) => {
      if (searching) return;
      const key = `${projectId}|${path}`;
      const next = new Set(collapsed);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveCollapsed(next);
    },
    addingAt: addAt,
    onAddHere: (path) => {
      setAddAt((at) => (at === path ? null : path));
      const key = `${projectId}|${path}`;
      if (collapsed.has(key)) {
        const next = new Set(collapsed);
        next.delete(key);
        saveCollapsed(next);
      }
    },
    renderAdd: (path) => (
      <QuickAdd
        projectId={projectId}
        projectName={projectName}
        base={path}
        onClose={() => setAddAt(null)}
      />
    ),
    renderCase: (c) => (
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
    ),
    canEdit,
  };
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
        <StatusBar counts={counts} total={total} className="mt-2 h-1.5" />
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
        {groupPaths.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleAll}
            disabled={searching}
            title={
              searching
                ? "Groups stay open while filtering"
                : anyCollapsed
                  ? "Expand every group"
                  : "Collapse every group"
            }
          >
            {anyCollapsed ? (
              <ChevronsUpDown className="size-3.5" aria-hidden />
            ) : (
              <ChevronsDownUp className="size-3.5" aria-hidden />
            )}
            <span className="hidden sm:inline">{anyCollapsed ? "Expand" : "Collapse"}</span>
          </Button>
        )}
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
            <Button
              size="sm"
              variant="primary"
              onClick={() => setAddAt((at) => (at === "" ? null : ""))}
            >
              <ListPlus className="size-3.5" aria-hidden />
              Add checks
            </Button>
          </>
        )}
      </div>

      {addAt === "" && canEdit && (
        <QuickAdd
          projectId={projectId}
          projectName={projectName}
          base={null}
          onClose={() => setAddAt(null)}
        />
      )}

      <datalist id={GROUPS_DATALIST}>
        {groupPaths.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {total === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No checks on this project yet"
          hint="List what needs to work before it ships: logins, payments, the flows a client will try first."
          action={
            canEdit && addAt !== "" ? (
              <Button size="sm" onClick={() => setAddAt("")}>
                <ListPlus className="size-3.5" aria-hidden />
                Add checks
              </Button>
            ) : undefined
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState icon={Search} title="Nothing matches" hint="Try another filter or search." />
      ) : (
        <div className="space-y-4">
          {tree.children.map((node) => (
            <GroupSection key={node.path} node={node} tree={treeProps} />
          ))}
          {tree.cases.length > 0 && (
            <section>
              {tree.children.length > 0 && (
                <h3 className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-faint">
                  Other
                  <span className="ml-1.5 font-mono normal-case">
                    {tree.cases.filter((c) => c.status === "pass").length}/{tree.cases.length}
                  </span>
                </h3>
              )}
              <CaseList cases={tree.cases} render={treeProps.renderCase} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
