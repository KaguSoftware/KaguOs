import type { Metadata } from "next";
import { Suspense } from "react";
import { canAccess, canWrite, requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow } from "@/lib/data/query";
import { PageHeader } from "@/components/shell/page-header";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { TestingBoard } from "@/components/testing/board";
import type { TestCase, TestResult, TestResultImage } from "@/lib/types";

export const metadata: Metadata = { title: "Testing" };

export default async function TestingPage() {
  const ctx = await requireSection("testing");

  // Everything in one wave, grouped per case in the client — same one-trip
  // rule the Debug board follows for its images and notes.
  const [projects, cases, results, images, members] = await Promise.all([
    rowsOrThrow(
      ctx.supabase
        .from("projects")
        .select("id, name, status")
        .eq("is_demo", ctx.showcase)
        .order("name"),
      "projects"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("test_cases")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
      "test_cases"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("test_results")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("created_at", { ascending: false }),
      "test_results"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("test_result_images")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("created_at", { ascending: true }),
      "test_result_images"
    ),
    getMembersMap(ctx.supabase),
  ]);

  return (
    <>
      <LiveRefresh tables={["test_cases", "test_results"]} />
      <PageHeader
        title="Kagu Testing"
        description="What's been checked, what works, what doesn't."
      />
      {/* The board reads ?project= to open on a tab (the retest bell links
          there), so it needs a Suspense boundary for useSearchParams. */}
      <Suspense>
        <TestingBoard
          projects={projects}
          cases={cases as TestCase[]}
          results={results as TestResult[]}
          images={images as TestResultImage[]}
          members={members}
          canEdit={canWrite(ctx, "testing")}
          canSeeDebug={canAccess(ctx, "debug")}
          meId={ctx.userId}
          isAdmin={ctx.isAdmin}
        />
      </Suspense>
    </>
  );
}
