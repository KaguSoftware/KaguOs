import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, FolderKanban, GitBranch } from "lucide-react";
import { Plus } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { SectionTabs } from "@/components/shell/section-tabs";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { formatDate } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Work" };

const STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
  planning: "info",
  active: "green",
  paused: "amber",
  done: "faint",
};

export default async function WorkPage() {
  const ctx = await requireSection("work");

  const { data: projects } = await ctx.supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  const list = (projects ?? []) as Project[];

  return (
    <>
      <PageHeader
        title="Kagu Work"
        description="Projects and new ideas."
        action={
          <LinkButton href="/work/projects/new">
            <Plus className="size-3.5" aria-hidden />
            New project
          </LinkButton>
        }
      />
      <SectionTabs
        active="projects"
        tabs={[
          { key: "projects", href: "/work", label: "Projects" },
          { key: "ideas", href: "/work/ideas", label: "Ideas" },
        ]}
      />

      <div className="rounded-lg border border-line bg-surface">
        {list.length === 0 ? (
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
                {list.map((project) => (
                  <tr key={project.id} className="transition-colors duration-150 hover:bg-raised/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/work/projects/${project.id}`}
                        className="font-medium text-ink hover:text-primary-dim"
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{project.client || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[project.status]}>{project.status}</Badge>
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
    </>
  );
}
