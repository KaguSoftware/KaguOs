"use server";

import { revalidatePath } from "next/cache";
import { blockIfReadOnly, requireSection } from "@/lib/data/session";
import { notifySection } from "@/lib/actions/notify";
import { MAX_CASES_PER_BATCH, parseQuickAdd } from "@/lib/testing";
import type { ActionResult } from "@/lib/actions/account";
import type {
  DebugPriority,
  TestCase,
  TestEnvironment,
  TestOutcome,
} from "@/lib/types";

const OUTCOMES: TestOutcome[] = ["pass", "fail", "blocked"];
const ENVS: TestEnvironment[] = ["prod", "staging", "local"];
const PRIORITIES: DebugPriority[] = ["low", "medium", "high", "urgent"];

/**
 * Paste a list, get a checklist. One line per case, `Area: title` to group.
 * Appended after the project's existing cases so a second paste doesn't
 * reshuffle the first.
 */
export async function quickAddCases(
  projectId: string,
  text: string
): Promise<{ ok: boolean; message: string; cases?: TestCase[] }> {
  const stop = await blockIfReadOnly("testing");
  if (stop) return stop;
  const ctx = await requireSection("testing");
  if (!projectId) return { ok: false, message: "Pick a project first." };

  const parsed = parseQuickAdd(text);
  const clean = parsed.slice(0, MAX_CASES_PER_BATCH);
  const dropped = parsed.length - clean.length;
  if (clean.length === 0) return { ok: false, message: "Nothing to add." };

  const { data: last } = await ctx.supabase
    .from("test_cases")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = (last?.position ?? -1) + 1;

  const { data, error } = await ctx.supabase
    .from("test_cases")
    .insert(
      clean.map((c, i) => ({
        project_id: projectId,
        area: c.area,
        title: c.title,
        position: start + i,
        created_by: ctx.userId,
      }))
    )
    .select("*");
  if (error) return { ok: false, message: error.message };

  revalidatePath("/testing");
  return {
    ok: true,
    message: dropped
      ? `Added ${clean.length} — ${dropped} didn't fit (${MAX_CASES_PER_BATCH} max per paste).`
      : `Added ${clean.length}.`,
    cases: (data ?? []) as TestCase[],
  };
}

/** Edit what a check IS. Its status only changes through recordResult. */
export async function updateCase(
  caseId: string,
  fields: { area: string; title: string; steps: string; expected: string }
): Promise<ActionResult> {
  const stop = await blockIfReadOnly("testing");
  if (stop) return stop;
  const ctx = await requireSection("testing");

  const title = fields.title.trim().slice(0, 200);
  if (!title) return { ok: false, message: "A check needs a title." };

  const { error } = await ctx.supabase
    .from("test_cases")
    .update({
      title,
      area: fields.area.trim().slice(0, 60) || null,
      steps: fields.steps.trim().slice(0, 4000) || null,
      expected: fields.expected.trim().slice(0, 2000) || null,
    })
    .eq("id", caseId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/testing");
  return { ok: true, message: "Saved." };
}

/**
 * Put a check back to untested — for when the feature was rebuilt and every
 * old result stopped meaning anything. History stays; only the status resets.
 */
export async function resetCase(caseId: string): Promise<ActionResult> {
  const stop = await blockIfReadOnly("testing");
  if (stop) return stop;
  const ctx = await requireSection("testing");

  const { error } = await ctx.supabase
    .from("test_cases")
    .update({ status: "untested" })
    .eq("id", caseId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/testing");
  return { ok: true, message: "Back to untested." };
}

/**
 * Delete a check and its history.
 *
 * The screenshots are deliberately LEFT in storage. Only a failure carries
 * them, and every failure indexes the same objects on its debug task — the
 * task owns their lifetime (purgeTaskImages removes them with it). Deleting
 * them here would blank the pictures on a task someone is still fixing.
 */
export async function deleteCase(caseId: string): Promise<ActionResult> {
  const stop = await blockIfReadOnly("testing");
  if (stop) return stop;
  const ctx = await requireSection("testing");

  const { data, error } = await ctx.supabase
    .from("test_cases")
    .delete()
    .eq("id", caseId)
    .select("id");
  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) {
    return { ok: false, message: "Only whoever added it (or an admin) can delete it." };
  }

  revalidatePath("/testing");
  return { ok: true, message: "Check deleted." };
}

export type RecordResultInput = {
  status: TestOutcome;
  environment: TestEnvironment;
  note?: string;
  /** Only used when a failure files a NEW debug task. */
  priority?: DebugPriority;
  /** Already uploaded to `debug/testing/<caseId>/…` by the browser. */
  images?: { path: string; width: number | null; height: number | null }[];
};

export type RecordResultOutcome = ActionResult & {
  taskId?: string | null;
  taskAction?: "created" | "reopened" | "noted" | null;
};

/**
 * Record one test of one check. Everything — the history row, the case's new
 * status, and on a failure the debug task — happens inside
 * record_test_result() in one transaction (see 0085 for why it has to be a
 * definer function: a tester needn't hold Debug).
 */
export async function recordResult(
  caseId: string,
  input: RecordResultInput
): Promise<RecordResultOutcome> {
  const stop = await blockIfReadOnly("testing");
  if (stop) return stop;
  const ctx = await requireSection("testing");

  if (!OUTCOMES.includes(input.status)) return { ok: false, message: "Invalid result." };
  if (!ENVS.includes(input.environment)) {
    return { ok: false, message: "Invalid environment." };
  }
  const priority =
    input.priority && PRIORITIES.includes(input.priority) ? input.priority : "medium";
  const images = (input.images ?? []).slice(0, 6);

  const { data, error } = await ctx.supabase.rpc("record_test_result", {
    p_case_id: caseId,
    p_status: input.status,
    p_environment: input.environment,
    p_note: input.note?.trim().slice(0, 2000) || null,
    p_priority: priority,
    p_image_paths: images.map((i) => i.path),
    p_image_sizes: images.map((i) => ({ width: i.width, height: i.height })),
  });
  if (error) {
    // The bytes are already in the bucket; with no row pointing at them
    // nothing would ever clean them up.
    if (images.length > 0) {
      await ctx.supabase.storage.from("debug").remove(images.map((i) => i.path));
    }
    return { ok: false, message: error.message };
  }

  const result = (data ?? {}) as {
    task_id: string | null;
    task_action: "created" | "reopened" | "noted" | null;
  };

  if (result.task_action === "created" || result.task_action === "reopened") {
    const { data: tc } = await ctx.supabase
      .from("test_cases")
      .select("title")
      .eq("id", caseId)
      .maybeSingle();
    notifySection(ctx, "debug", {
      kind: "debug_task_new",
      title:
        result.task_action === "created"
          ? `Test failed: ${tc?.title ?? "a check"}`
          : `Reopened — retest failed: ${tc?.title ?? "a check"}`,
      href: "/debug",
    });
  }

  revalidatePath("/testing");
  if (input.status === "fail") revalidatePath("/debug");

  const message =
    input.status === "pass"
      ? "Marked as working."
      : input.status === "blocked"
        ? "Marked as blocked."
        : result.task_action === "created"
          ? "Sent to Debug."
          : result.task_action === "reopened"
            ? "Debug task reopened."
            : "Added to the open Debug task.";

  return {
    ok: true,
    message,
    taskId: result.task_id,
    taskAction: result.task_action,
  };
}
