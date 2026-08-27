import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";
import { canWrite, requireSection } from "@/lib/data/session";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getIntakePack } from "@/lib/data/intake";
import { PageHeader } from "@/components/shell/page-header";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { Badge } from "@/components/ui/badge";
import { IntakeExport } from "@/components/work/intake-export";
import { IntakeReview } from "@/components/work/intake-review";
import { IntakeLangToggle } from "@/components/work/intake-lang-toggle";
import { SendClientEmail } from "@/components/work/send-client-email";
import { INTAKE_LANG_COOKIE, parseIntakeLang } from "@/lib/intake-lang";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Input pack" };

export default async function ProjectIntakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("work");
  const lang = parseIntakeLang((await cookies()).get(INTAKE_LANG_COOKIE)?.value);

  const [{ data: project }, holders] = await Promise.all([
    selectOrThrow(
      ctx.supabase
        .from("projects")
        .select("id, name, client, intake_pack")
        .eq("id", id)
        .eq("is_demo", ctx.showcase)
        .maybeSingle(),
      "project"
    ),
    // Who can see this pack. Reading `profiles` scoped to the ids on
    // `client_projects` — kind = 'client' by construction, since only a client
    // account can hold a row there (0072 §2), and the filter is stated anyway
    // so the query says what it means without the reader having to know that.
    //
    // ⚠️ The relationship is named, not inferred. `client_projects` has TWO
    // foreign keys into `profiles` — `user_id` (whose access this is) and
    // `created_by` (which admin granted it) — so a bare `profiles!inner(…)`
    // is ambiguous and PostgREST refuses the whole request with PGRST201.
    // That failed at RUNTIME only: it typechecks, it builds, and it renders
    // the section error boundary in production. Any future embed off this
    // table has to name its FK the same way.
    rowsOrThrow(
      ctx.supabase
        .from("client_projects")
        .select(
          "user_id, profiles!client_projects_user_id_fkey!inner(full_name, email, kind)"
        )
        .eq("project_id", id)
        .eq("profiles.kind", "client"),
      "client_projects"
    ),
  ]);
  if (!project) notFound();

  // Second wave, and unavoidable: which questions this project asks is a column
  // on the row above, and reading the answers without it would mean scoring
  // them against the wrong questionnaire.
  const pack = await getIntakePack(ctx, id, project.intake_pack);

  const people = holders.map((row) => {
    const profile = row.profiles as unknown as {
      full_name: string | null;
      email: string;
    };
    return profile.full_name || profile.email;
  });

  const sent = pack.header?.submitted_at ?? null;

  // The same pair of arms the send action checks server-side, and the same pair
  // the portal's RLS carries (0074 §3): mailing a customer is publishing to
  // them. A view-only member sees the pack and no send box, rather than a
  // button that refuses.
  const canSend = canWrite(ctx, "work") || canWrite(ctx, "management");

  return (
    <>
      {/* The client types into this page from the other side of the app. A
          producer reading it while they do should see the answers land. */}
      <LiveRefresh
        tables={["project_intake", "project_intake_answers", "project_intake_rows"]}
      />

      <Link
        href={`/work/projects/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[calc(13px*var(--text-scale,1))] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {project.name}
      </Link>

      <PageHeader
        title="Input pack"
        description="What the client has told us about their business, in their own words."
        action={
          <div className="flex items-center gap-3">
            {/* Content only — this never flips the app into RTL. See
                lib/intake-lang.ts for why it is not the client's locale cookie. */}
            <IntakeLangToggle current={lang} />
            {sent ? (
              <Badge tone="green">sent {formatRelative(sent)}</Badge>
            ) : (
              <Badge tone="faint">not sent yet</Badge>
            )}
          </div>
        }
      />

      <p className="mb-6 flex flex-wrap items-center gap-1.5 text-[calc(13px*var(--text-scale,1))] text-faint">
        <UserRound className="size-3.5" aria-hidden />
        {people.length === 0 ? (
          <>
            Nobody can fill this in yet — give someone a client account in{" "}
            <Link href="/admin" className="text-muted underline-offset-2 hover:text-ink hover:underline">
              Admin
            </Link>{" "}
            and share this project with them.
          </>
        ) : (
          <>Filled in by {people.join(", ")}</>
        )}
      </p>

      {/* Above the review for the same reason the export is: the two things a
          producer opens this page to DO are get the data out and chase what is
          missing, and both would otherwise sit behind a page of recipe tables.
          A pack that has already been sent needs no nudge. */}
      {canSend && !sent && (
        <div className="mb-8">
          <SendClientEmail projectId={id} variant="inputs" people={people} />
        </div>
      )}

      {/* Above the review, not below it: the reason a producer opens this
          page late in a build is to get the data OUT, and putting the export
          behind a page of recipe tables means scrolling past the thing you
          came to avoid retyping. */}
      <div className="mb-8">
        <IntakeExport pack={pack} projectId={id} projectName={project.name} />
      </div>

      <IntakeReview pack={pack} lang={lang} projectName={project.name} />
    </>
  );
}
