"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ExternalLink, FolderKanban, GitBranch, Lightbulb, MessageSquare, Plus } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PromoteProgress, VoteControl } from "@/components/work/idea-bits";
import { FilterBar, useWorkFilters } from "@/components/work/work-filters";
import { formatDate } from "@/lib/utils";
import { optionLabel, PROJECT_TYPE_OPTIONS, SECTOR_OPTIONS } from "@/lib/options";
import type { IdeaStatus, MembersMap, Project, ProjectStatus } from "@/lib/types";

const PROJECT_TONE: Record<ProjectStatus, BadgeTone> = {
  planning: "info",
  active: "green",
  paused: "amber",
  done: "faint",
};

const IDEA_TONE: Record<IdeaStatus, BadgeTone> = {
  open: "neutral",
  promoted: "green",
  archived: "faint",
  rejected: "danger",
};

const PROJECT_STATUSES: ProjectStatus[] = ["planning", "active", "paused", "done"];
const IDEA_STATUSES: IdeaStatus[] = ["open", "promoted", "archived", "rejected"];

export type IdeaRow = {
  id: string;
  title: string;
  status: IdeaStatus;
  sector: string | null;
  type: string | null;
  required_count: number | null;
  created_by: string | null;
  created_at: string;
  idea_votes: { user_id: string; value: number }[];
  idea_comments: { count: number }[];
};

/** Count how many rows carry each status, for the chip badges. */
function statusCounts<T extends { status: string }>(rows: T[]) {
  const map: Record<string, number> = {};
  for (const r of rows) map[r.status] = (map[r.status] ?? 0) + 1;
  return map;
}

// ========================================================================
// Projects
// ========================================================================

export function ProjectsPanel({
  projects,
  currentUserId,
}: {
  projects: Project[];
  currentUserId: string;
}) {
  const filters = useWorkFilters("p", "updated");
  const { state } = filters;
  const counts = useMemo(() => statusCounts(projects), [projects]);

  const filtered = useMemo(() => {
    const q = state.q.trim().toLowerCase();
    const rows = projects.filter((p) => {
      if (state.status && p.status !== state.status) return false;
      if (state.sector && p.sector !== state.sector) return false;
      if (state.type && p.type !== state.type) return false;
      if (state.owner === "me" && p.created_by !== currentUserId) return false;
      if (q) {
        const hay = `${p.name} ${p.client ?? ""} ${p.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...rows];
    switch (state.sort) {
      case "created":
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "status":
        sorted.sort(
          (a, b) =>
            PROJECT_STATUSES.indexOf(a.status) - PROJECT_STATUSES.indexOf(b.status)
        );
        break;
      default: // "updated"
        sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    return sorted;
  }, [projects, state, currentUserId]);

  return (
    <div className="space-y-1">
      {projects.length > 0 && (
        <FilterBar
          filters={filters}
          statusOptions={[
            { value: "", label: "All", count: projects.length },
            ...PROJECT_STATUSES.map((s) => ({
              value: s,
              label: s,
              count: counts[s] ?? 0,
            })),
          ]}
          sectorOptions={SECTOR_OPTIONS}
          typeOptions={PROJECT_TYPE_OPTIONS}
          sortOptions={[
            { value: "updated", label: "Recently updated" },
            { value: "created", label: "Newest" },
            { value: "name", label: "Name A–Z" },
            { value: "status", label: "Status" },
          ]}
          showOwner
          searchPlaceholder="Search projects…"
          resultCount={filtered.length}
          totalCount={projects.length}
        />
      )}

      <div className="rounded-lg border border-line bg-surface">
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            hint="Create the first one, or promote an idea from the Ideas tab."
            action={
              <LinkButton href="/work/projects/new">
                <Plus className="size-3.5" aria-hidden />
                New project
              </LinkButton>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects match"
            hint="Try a different status, sector, or search term."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-faint">Project</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-faint">Client</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-faint">Status</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-faint">Links</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-faint">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((project) => (
                  <tr
                    key={project.id}
                    className="transition-colors duration-150 hover:bg-raised/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/work/projects/${project.id}`}
                        className="font-medium text-ink hover:text-primary-dim"
                      >
                        {project.name}
                      </Link>
                      {(project.sector || project.type) && (
                        <p className="mt-0.5 text-xs text-faint">
                          {[
                            optionLabel(SECTOR_OPTIONS, project.sector),
                            optionLabel(PROJECT_TYPE_OPTIONS, project.type),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{project.client || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={PROJECT_TONE[project.status]}>{project.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex gap-2">
                        {project.repo_url && (
                          <a
                            href={project.repo_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Repository"
                            className="text-faint hover:text-ink"
                          >
                            <GitBranch className="size-4" aria-hidden />
                            <span className="sr-only">Repository</span>
                          </a>
                        )}
                        {project.prod_url && (
                          <a
                            href={project.prod_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Production"
                            className="text-faint hover:text-ink"
                          >
                            <ExternalLink className="size-4" aria-hidden />
                            <span className="sr-only">Production</span>
                          </a>
                        )}
                        {!project.repo_url && !project.prod_url && (
                          <span className="text-faint">—</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-faint">
                      {formatDate(project.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================================================================
// Ideas
// ========================================================================

/** Net upvotes − downvotes for an idea row. */
function netScore(idea: IdeaRow) {
  return idea.idea_votes.reduce((sum, v) => sum + v.value, 0);
}

export function IdeasPanel({
  ideas,
  members,
  currentUserId,
}: {
  ideas: IdeaRow[];
  members: MembersMap;
  currentUserId: string;
}) {
  const filters = useWorkFilters("i", "votes");
  const { state } = filters;
  const counts = useMemo(() => statusCounts(ideas), [ideas]);

  const filtered = useMemo(() => {
    const q = state.q.trim().toLowerCase();
    const rows = ideas.filter((i) => {
      if (state.status && i.status !== state.status) return false;
      if (state.sector && i.sector !== state.sector) return false;
      if (state.type && i.type !== state.type) return false;
      if (state.owner === "me" && i.created_by !== currentUserId) return false;
      if (q && !i.title.toLowerCase().includes(q)) return false;
      return true;
    });

    const sorted = [...rows];
    const openFirst = (a: IdeaRow, b: IdeaRow) =>
      Number(a.status !== "open") - Number(b.status !== "open");
    switch (state.sort) {
      case "newest":
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case "discussed":
        sorted.sort(
          (a, b) =>
            (b.idea_comments[0]?.count ?? 0) - (a.idea_comments[0]?.count ?? 0)
        );
        break;
      case "closest": {
        // Nearest to the unanimous bar first (open ideas only meaningfully rank).
        const gap = (i: IdeaRow) => {
          const up = i.idea_votes.filter((v) => v.value === 1).length;
          const req = i.required_count ?? Infinity;
          return req - up;
        };
        sorted.sort((a, b) => openFirst(a, b) || gap(a) - gap(b));
        break;
      }
      default: // "votes"
        sorted.sort((a, b) => openFirst(a, b) || netScore(b) - netScore(a));
    }
    return sorted;
  }, [ideas, state, currentUserId]);

  return (
    <div className="space-y-1">
      {ideas.length > 0 && (
        <FilterBar
          filters={filters}
          statusOptions={[
            { value: "", label: "All", count: ideas.length },
            ...IDEA_STATUSES.filter((s) => counts[s]).map((s) => ({
              value: s,
              label: s,
              count: counts[s] ?? 0,
            })),
          ]}
          sectorOptions={SECTOR_OPTIONS}
          typeOptions={PROJECT_TYPE_OPTIONS}
          sortOptions={[
            { value: "votes", label: "Top voted" },
            { value: "closest", label: "Closest to promote" },
            { value: "discussed", label: "Most discussed" },
            { value: "newest", label: "Newest" },
          ]}
          showOwner
          searchPlaceholder="Search ideas…"
          resultCount={filtered.length}
          totalCount={ideas.length}
        />
      )}

      <div className="rounded-lg border border-line bg-surface">
        {ideas.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No ideas yet"
            hint="Post the first one — teammates vote, discuss, and the good ones become projects."
            action={
              <LinkButton href="/work/ideas/new">
                <Plus className="size-3.5" aria-hidden />
                New idea
              </LinkButton>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No ideas match"
            hint="Try a different status, sector, or search term."
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((idea) => {
              const up = idea.idea_votes.filter((v) => v.value === 1).length;
              const down = idea.idea_votes.filter((v) => v.value === -1).length;
              const mine = (idea.idea_votes.find((v) => v.user_id === currentUserId)
                ?.value ?? 0) as -1 | 0 | 1;
              return (
                <li key={idea.id} className="flex items-center gap-4 px-4 py-3">
                  <VoteControl ideaId={idea.id} size="sm" state={{ mine, up, down }} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/work/ideas/${idea.id}`}
                      className="text-sm font-medium text-ink hover:text-primary-dim"
                    >
                      {idea.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-faint">
                      {formatDate(idea.created_at)}
                      {idea.created_by && members[idea.created_by] && (
                        <>
                          {" · by "}
                          <span style={{ color: members[idea.created_by].color }}>
                            {members[idea.created_by].name}
                          </span>
                        </>
                      )}
                    </p>
                    {idea.status === "open" && (
                      <div className="mt-2 max-w-56">
                        <PromoteProgress
                          up={up}
                          down={down}
                          required={idea.required_count}
                        />
                      </div>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-xs text-faint">
                    <MessageSquare className="size-3.5" aria-hidden />
                    {idea.idea_comments[0]?.count ?? 0}
                  </span>
                  <Badge tone={IDEA_TONE[idea.status]}>{idea.status}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
