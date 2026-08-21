"use client";

import { PostCard } from "@/components/marketing/post-card";
import { POST_LADDER, POST_STATUS_HINTS, POST_STATUS_LABELS } from "@/lib/posts";
import type { MarketingPost, MembersMap, PostStatus } from "@/lib/types";

/**
 * A client's post board: four columns, one per ladder rung, one-click advance
 * on each card. Four states fit across a laptop, so unlike the old ten-column
 * pipeline this needs no horizontal scroll and no drag-and-drop debate — the
 * button on the card is the only move a post can make.
 */
export function PostBoard({
  posts,
  members,
  canWrite,
}: {
  posts: MarketingPost[];
  members: MembersMap;
  canWrite: boolean;
}) {
  const byStatus = new Map<PostStatus, MarketingPost[]>();
  for (const post of posts) {
    const list = byStatus.get(post.status) ?? [];
    list.push(post);
    byStatus.set(post.status, list);
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {POST_LADDER.map((status) => {
        const cards = byStatus.get(status) ?? [];
        return (
          <section
            key={status}
            aria-label={POST_STATUS_LABELS[status]}
            className="flex flex-col rounded-lg border border-line bg-surface"
          >
            <header className="border-b border-line px-3 py-2.5">
              <h3 className="flex items-baseline justify-between gap-2 text-[calc(13px*var(--text-scale,1))] font-semibold text-ink">
                {POST_STATUS_LABELS[status]}
                <span className="font-mono text-xs font-normal text-faint tabular-nums">
                  {cards.length}
                </span>
              </h3>
            </header>

            {cards.length === 0 ? (
              // The hint teaches the column instead of saying "empty".
              <p className="px-3 py-4 text-xs leading-relaxed text-faint">
                {POST_STATUS_HINTS[status]}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {cards.map((post) => (
                  <li key={post.id}>
                    <PostCard
                      post={post}
                      members={members}
                      canWrite={canWrite}
                      showStatus={false}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
