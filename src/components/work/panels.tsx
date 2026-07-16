import Link from "next/link";
import { ExternalLink, FolderKanban, GitBranch, Lightbulb, MessageSquare } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { VoteButton } from "@/components/work/idea-bits";
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
};

export type IdeaRow = {
  id: string;
  title: string;
  status: IdeaStatus;
  created_by: string | null;
  created_at: string;
  idea_votes: { user_id: string }[];
  idea_comments: { count: number }[];
};

export function ProjectsPanel({ projects }: { projects: Project[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface">
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          hint="Create the first one, or promote an idea from the Ideas tab."
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
              {projects.map((project) => (
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
  );
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
  return (
    <div className="rounded-lg border border-line bg-surface">
      {ideas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No ideas yet"
          hint="Post the first one — teammates vote, discuss, and the good ones become projects."
        />
      ) : (
        <ul className="divide-y divide-line">
          {ideas.map((idea) => (
            <li key={idea.id} className="flex items-center gap-4 px-4 py-3">
              <VoteButton
                ideaId={idea.id}
                votes={idea.idea_votes.length}
                voted={idea.idea_votes.some((v) => v.user_id === currentUserId)}
              />
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
              </div>
              <span className="flex items-center gap-1 text-xs text-faint">
                <MessageSquare className="size-3.5" aria-hidden />
                {idea.idea_comments[0]?.count ?? 0}
              </span>
              <Badge tone={IDEA_TONE[idea.status]}>{idea.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
