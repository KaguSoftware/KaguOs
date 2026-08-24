import "server-only";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import type { SessionContext } from "@/lib/data/session";
import {
  buildChecks,
  progressOf,
  type AnswerMap,
  type IntakeCheck,
  type IntakeProgress,
  type IntakeRow,
} from "@/lib/intake";
import type { ProjectIntake, ProjectIntakeRow } from "@/lib/types";

/**
 * Everything one project's input pack needs, in ONE wave.
 *
 * Both audiences read it through here — the client filling the pack in and the
 * team reading it back — because the completion arithmetic has to be identical
 * on the two screens or they will quietly disagree about whether the pack is
 * done. RLS (0072 §4) decides who gets rows; this function does not re-check
 * access and must not be called without a guard above it.
 */
export type IntakePack = {
  projectId: string;
  header: ProjectIntake | null;
  answers: AnswerMap;
  rows: IntakeRow[];
  checks: IntakeCheck[];
  progress: IntakeProgress;
};

export async function getIntakePack(
  ctx: SessionContext,
  projectId: string
): Promise<IntakePack> {
  const [{ data: header }, answerRows, rawRows] = await Promise.all([
    selectOrThrow(
      ctx.supabase
        .from("project_intake")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle(),
      "project_intake"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("project_intake_answers")
        .select("key, value")
        .eq("project_id", projectId),
      "project_intake_answers"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("project_intake_rows")
        .select("id, table_key, data, sort")
        .eq("project_id", projectId)
        .order("table_key")
        .order("sort")
        .order("created_at"),
      "project_intake_rows"
    ),
  ]);

  const answers: AnswerMap = {};
  for (const row of answerRows as { key: string; value: string }[]) {
    answers[row.key] = row.value;
  }

  const rows: IntakeRow[] = (rawRows as ProjectIntakeRow[]).map((row) => ({
    id: row.id,
    table_key: row.table_key,
    // Defended rather than trusted: `data` is jsonb, and a hand-edited row (or
    // a future column that stored a number) would otherwise put a non-string
    // into a value that every consumer calls .trim() on.
    data: Object.fromEntries(
      Object.entries(row.data ?? {}).map(([key, value]) => [key, String(value ?? "")])
    ),
    sort: row.sort,
  }));

  const checks = buildChecks(answers, rows);

  return {
    projectId,
    header: (header as ProjectIntake | null) ?? null,
    answers,
    rows,
    checks,
    progress: progressOf(checks),
  };
}

/**
 * The pack's headline numbers for a LIST of projects — the "62% · sent 3 days
 * ago" line on the Work project page and the portal index.
 *
 * One query for every project rather than one wave per project: the index
 * renders every assigned pack, and a round-trip each would make a client with
 * four projects pay four times over for a number in a progress bar.
 */
export type IntakeSummary = {
  projectId: string;
  progress: IntakeProgress;
  submittedAt: string | null;
};

export async function getIntakeSummaries(
  ctx: SessionContext,
  projectIds: string[]
): Promise<Map<string, IntakeSummary>> {
  const summaries = new Map<string, IntakeSummary>();
  if (projectIds.length === 0) return summaries;

  const [headers, answerRows, rawRows] = await Promise.all([
    rowsOrThrow(
      ctx.supabase
        .from("project_intake")
        .select("project_id, submitted_at")
        .in("project_id", projectIds),
      "project_intake summaries"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("project_intake_answers")
        .select("project_id, key, value")
        .in("project_id", projectIds),
      "project_intake_answers summaries"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("project_intake_rows")
        .select("id, project_id, table_key, data, sort")
        .in("project_id", projectIds),
      "project_intake_rows summaries"
    ),
  ]);

  const submittedAt = new Map<string, string | null>(
    (headers as { project_id: string; submitted_at: string | null }[]).map((h) => [
      h.project_id,
      h.submitted_at,
    ])
  );

  const answersByProject = new Map<string, AnswerMap>();
  for (const row of answerRows as { project_id: string; key: string; value: string }[]) {
    const map = answersByProject.get(row.project_id) ?? {};
    map[row.key] = row.value;
    answersByProject.set(row.project_id, map);
  }

  const rowsByProject = new Map<string, IntakeRow[]>();
  for (const row of rawRows as ProjectIntakeRow[]) {
    const list = rowsByProject.get(row.project_id) ?? [];
    list.push({
      id: row.id,
      table_key: row.table_key,
      data: Object.fromEntries(
        Object.entries(row.data ?? {}).map(([k, v]) => [k, String(v ?? "")])
      ),
      sort: row.sort,
    });
    rowsByProject.set(row.project_id, list);
  }

  for (const projectId of projectIds) {
    const checks = buildChecks(
      answersByProject.get(projectId) ?? {},
      rowsByProject.get(projectId) ?? []
    );
    summaries.set(projectId, {
      projectId,
      progress: progressOf(checks),
      submittedAt: submittedAt.get(projectId) ?? null,
    });
  }

  return summaries;
}

/**
 * The projects a client account may open, name included.
 *
 * Goes through the `my_client_projects()` RPC rather than reading `projects`,
 * and that is the whole point of the function existing: `projects` carries repo
 * urls and internal build notes, an RLS arm is an all-or-nothing grant on every
 * column, and a client needs exactly two of them (0072 §2).
 */
export async function getMyClientProjects(
  ctx: SessionContext
): Promise<{ id: string; name: string }[]> {
  const { data } = await selectOrThrow(
    ctx.supabase.rpc("my_client_projects"),
    "my_client_projects"
  );
  return (data ?? []) as { id: string; name: string }[];
}
