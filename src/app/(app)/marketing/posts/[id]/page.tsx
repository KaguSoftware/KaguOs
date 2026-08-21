import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { canWrite, requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { Badge } from "@/components/ui/badge";
import { PostFields } from "@/components/marketing/post-fields";
import { POST_STATUS_HINTS, POST_STATUS_LABELS, POST_STATUS_TONE } from "@/lib/posts";
import type { Client, MarketingPost } from "@/lib/types";

export const metadata: Metadata = { title: "Post" };

/** One post: its fields, its advance button, the way back to its client. */
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("marketing");
  const writable = canWrite(ctx, "marketing");

  const [{ data: post }, members] = await Promise.all([
    selectOrThrow(
      ctx.supabase.from("marketing_posts").select("*").eq("id", id).maybeSingle(),
      "post"
    ),
    getMembersMap(ctx.supabase),
  ]);

  if (!post) notFound();
  const row = post as MarketingPost;

  // Second wave, keyed on values that only exist once the post came back.
  const [{ data: client }, campaigns] = await Promise.all([
    selectOrThrow(
      ctx.supabase.from("clients").select("id, name").eq("id", row.client_id).maybeSingle(),
      "post: client"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("marketing_campaigns")
        .select("id, name")
        .eq("client_id", row.client_id)
        .neq("status", "done")
        .order("name"),
      "post: campaigns"
    ),
  ]);

  return (
    <>
      <LiveRefresh tables={["marketing_posts"]} />

      <div className="mb-5">
        <Link
          href={`/marketing/clients/${row.client_id}`}
          className="inline-flex items-center gap-1.5 text-[calc(13px*var(--text-scale,1))] text-muted transition-colors duration-150 hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {(client as Pick<Client, "name"> | null)?.name ?? "Client"}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[calc(22px*var(--text-scale,1))] font-semibold tracking-tight">{row.title}</h1>
            <p className="mt-1 text-sm text-muted">{POST_STATUS_HINTS[row.status]}</p>
          </div>
          <Badge tone={POST_STATUS_TONE[row.status]}>
            {POST_STATUS_LABELS[row.status]}
          </Badge>
        </div>
      </div>

      <div className="mx-auto max-w-2xl lg:mx-0">
        <PostFields
          post={row}
          campaigns={campaigns as { id: string; name: string }[]}
          members={members}
          canWrite={writable}
        />
      </div>
    </>
  );
}
