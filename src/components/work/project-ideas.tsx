"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Lightbulb, MessageSquare, Plus } from "lucide-react";
import { VoteControl } from "@/components/work/idea-bits";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import type { MembersMap, ProjectIdeaRow } from "@/lib/types";

const SORTS = [
  { value: "votes", label: "Top voted" },
  { value: "newest", label: "Newest" },
  { value: "discussed", label: "Most discussed" },
];

function netScore(idea: ProjectIdeaRow) {
  return idea.idea_votes.reduce((sum, v) => sum + v.value, 0);
}

/**
 * Suggestions filed against ONE project — features, names, changes.
 *
 * Deliberately leaner than the company `IdeasPanel`: no status chips, no
 * sector/type filters, no promote progress bar. Those all belong to the
 * pipeline question "should this become a project?", which a project-scoped
 * idea never asks. What's left is the part that matters here — what did people
 * suggest, and which suggestions does the team actually want.
 */
export function ProjectIdeas({
  projectId,
  ideas,
  members,
  currentUserId,
}: {
  projectId: string;
  ideas: ProjectIdeaRow[];
  members: MembersMap;
  currentUserId: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("votes");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = needle
      ? ideas.filter((i) => i.title.toLowerCase().includes(needle))
      : [...ideas];
    switch (sort) {
      case "newest":
        rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case "discussed":
        rows.sort(
          (a, b) =>
            (b.idea_comments[0]?.count ?? 0) - (a.idea_comments[0]?.count ?? 0)
        );
        break;
      default:
        rows.sort((a, b) => netScore(b) - netScore(a));
    }
    return rows;
  }, [ideas, q, sort]);

  const newHref = `/work/projects/${projectId}/ideas/new`;

  return (
    <div className="space-y-3">
      {/* The controls only earn their space once there's enough to sift. */}
      {ideas.length > 2 && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ideas…"
            aria-label="Search ideas"
            className="w-full flex-1 sm:w-auto"
          />
          <Dropdown
            id="project-idea-sort"
            className="w-full sm:w-44"
            value={sort}
            options={SORTS}
            onChange={setSort}
          />
        </div>
      )}

      <div className="rounded-lg border border-line bg-surface">
        {ideas.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No ideas for this project yet"
            hint="Features, names, anything worth changing — post it and the team votes."
            action={
              <LinkButton href={newHref}>
                <Plus className="size-3.5" aria-hidden />
                New idea
              </LinkButton>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No ideas match"
            hint="Try a different search term."
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
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-faint">
                    <MessageSquare className="size-3.5" aria-hidden />
                    {idea.idea_comments[0]?.count ?? 0}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
