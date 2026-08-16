import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { canWrite, requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { ReviewThread } from "@/components/marketing/review-thread";
import { CreativeFields } from "@/components/marketing/creative-fields";
import {
  CREATIVE_STATUS_HINTS,
  CREATIVE_STATUS_LABELS,
  CREATIVE_STATUS_TONE,
} from "@/lib/creatives";
import { formatDate } from "@/lib/utils";
import type { Client, Creative, CreativeReview } from "@/lib/types";

export const metadata: Metadata = { title: "Video" };

/**
 * ONE VIDEO, everything about it: the script, where the footage and the cut
 * live, the timecoded review thread, and its sibling variants.
 *
 * The layout puts the review thread beside the script rather than under it. A
 * producer reading "the hook at 0:14 is weak" needs the hook in the same
 * viewport; making them scroll between the note and the thing the note is about
 * is how feedback gets misread.
 */
export default async function CreativePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("marketing");
  const writable = canWrite(ctx, "marketing");

  const [{ data: creative }, reviews, members] = await Promise.all([
    selectOrThrow(
      ctx.supabase.from("creatives").select("*").eq("id", id).maybeSingle(),
      "creative"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("creative_reviews")
        .select("*")
        .eq("creative_id", id)
        .order("created_at", { ascending: true }),
      "creative: reviews"
    ),
    getMembersMap(ctx.supabase),
  ]);

  if (!creative) notFound();
  const row = creative as Creative;

  // Second wave, and it has to be: both queries below are keyed on values that
  // only exist once the creative has come back. Two small by-id reads.
  const [{ data: client }, siblings] = await Promise.all([
    selectOrThrow(
      ctx.supabase.from("clients").select("id, name").eq("id", row.client_id).maybeSingle(),
      "creative: client"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("creatives")
        .select("id, title, status, hook")
        // The variant family: everything sharing this row's parent, or — when
        // this row IS the concept — everything pointing at it.
        .eq("parent_creative_id", row.parent_creative_id ?? row.id)
        .order("created_at", { ascending: true }),
      "creative: variants"
    ),
  ]);

  const family = (siblings as Pick<Creative, "id" | "title" | "status" | "hook">[])
    .filter((s) => s.id !== row.id);

  return (
    <>
      <LiveRefresh tables={["creatives", "creative_reviews"]} />

      <div className="mb-5">
        <Link
          href={`/marketing/clients/${row.client_id}`}
          className="inline-flex items-center gap-1.5 text-[calc(13px*var(--text-scale,1))] text-muted transition-colors duration-150 hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {(client as Pick<Client, "name">)?.name ?? "Client"}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[calc(22px*var(--text-scale,1))] font-semibold tracking-tight">{row.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {CREATIVE_STATUS_HINTS[row.status]}
            </p>
          </div>
          <Badge tone={CREATIVE_STATUS_TONE[row.status]}>
            {CREATIVE_STATUS_LABELS[row.status]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5">
          <CreativeFields creative={row} members={members} canWrite={writable} />

          {family.length > 0 && (
            <Panel>
              <PanelHeader
                title="Variants of this concept"
                action={
                  <span className="text-xs text-faint">
                    Same idea, different hook
                  </span>
                }
              />
              <ul className="divide-y divide-line">
                {family.map((sibling) => (
                  <li key={sibling.id} className="px-4 py-2.5">
                    <Link
                      href={`/marketing/creatives/${sibling.id}`}
                      className="flex items-center gap-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[calc(13px*var(--text-scale,1))] text-ink">
                          {sibling.title}
                        </span>
                        {sibling.hook && (
                          <span className="block truncate text-xs text-faint">
                            {sibling.hook}
                          </span>
                        )}
                      </span>
                      <Badge tone={CREATIVE_STATUS_TONE[sibling.status]}>
                        {CREATIVE_STATUS_LABELS[sibling.status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <Panel>
          <PanelHeader
            title="Review"
            action={
              row.cut_url && (
                <a
                  href={row.cut_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                >
                  Watch the cut
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              )
            }
          />
          <div className="px-4 py-4">
            <ReviewThread
              creativeId={row.id}
              reviews={reviews as CreativeReview[]}
              members={members}
              canReview={writable}
            />
            {row.status === "client_review" && (
              <p className="mt-3 text-xs text-faint">
                Sent to the client
                {row.updated_at && ` ${formatDate(row.updated_at)}`}. Their decision
                lands here and moves the video by itself.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
