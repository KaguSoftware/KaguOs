/**
 * Seeds the two Kagu Learn programs (Level 1 Beginner, Level 2 Intermediate)
 * as real, joinable sprints — stages, goals, proofs and stage-scoped resources
 * all included. The source is the two syllabus documents in `public/learn/`;
 * this script is what turns them from a page you read into a sprint you run.
 *
 * Idempotent: a program is matched by title. Re-running replaces that sprint's
 * stages, goals and resources but keeps the sprint row, its participants, and
 * everyone's ticks — so it's safe to re-run after editing the content below.
 *
 * Usage:  npx tsx scripts/seed-learn-levels.ts [--start YYYY-MM-DD]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type StageSeed = {
  title: string;
  summary?: string;
  proof?: string;
  kind?: "stage" | "capstone";
  day_from?: number;
  day_to?: number;
  hours_low?: number;
  hours_high?: number;
  goals: string[];
  /** The goal that IS the proof. Appended after `goals`. */
  proofGoal?: string;
  resources?: { title: string; url: string }[];
};

type ProgramSeed = {
  title: string;
  description: string;
  /** Length in days, inclusive of both ends. */
  days: number;
  syllabus?: { title: string; url: string };
  stages: StageSeed[];
};

/* ------------------------------------------------------------------ level 1 */

const LEVEL_1: ProgramSeed = {
  title: "Level 1 · Getting a Good Answer",
  description:
    "A structured 2-week sprint to getting genuinely useful answers out of Claude: knowing what to reach for, prompting it properly, and trusting what comes back. Five stages, each unlocking the next, ending in one real task done start to finish.",
  days: 14,
  syllabus: {
    title: "Level 1 syllabus (full document)",
    url: "/learn/kagu-learn-level-1-beginner.html",
  },
  stages: [
    {
      title: "Landscape",
      summary:
        "Chat vs Cowork vs Claude Code, the three model tiers, the effort dial, and skills — knowing what to reach for.",
      proof:
        "Route 3 real tasks to the right surface + model + effort, and justify each in one line.",
      day_from: 1,
      day_to: 2,
      hours_low: 4,
      hours_high: 5,
      goals: [
        "Chat vs Cowork vs Claude Code — at recognition level",
        "Three model tiers, and picking by task weight",
        "The effort dial — and why high is usually right",
        "Skills as reusable instructions",
      ],
      proofGoal: "Route 3 real tasks to the right surface, model and effort",
      resources: [
        {
          title: "Claude AI Full Tutorial: From Basics to Agentic AI (2026)",
          url: "https://www.youtube.com/watch?v=XTWb5oEfqdY",
        },
        {
          title: "Claude Models Explained (2026): Opus vs Sonnet vs Haiku vs Fable",
          url: "https://www.usecarly.com/blog/claude-models-explained/",
        },
      ],
    },
    {
      title: "Access",
      summary:
        "Connecting Claude to your files, mail, and tools; what it can and can't reach; why a connected Claude beats a described one.",
      proof: "Pull an answer from your own file that a pasted description couldn't give.",
      day_from: 3,
      day_to: 4,
      hours_low: 4,
      hours_high: 5,
      goals: [
        "Connect Claude to your files, mail, and tools",
        "What it can and can't reach",
        "Why a connected Claude beats a described one",
      ],
      proofGoal: "Pull an answer from your own file a description couldn't give",
      resources: [
        {
          title: "FULL Claude Cowork Tutorial for Beginners (2026)",
          url: "https://www.youtube.com/watch?v=JdQ_FHgP5ms",
        },
        {
          title: "Set Up Claude Cowork: Files, Instructions, Plugins & Connectors",
          url: "https://cohorte.co/ai-articles/how-to-set-up-claude-cowork-files-instructions-plugins-and-connectors-2026",
        },
      ],
    },
    {
      title: "Prompting",
      summary:
        "The full 18 techniques across framing, specification, structure, and the iteration loop.",
      proof:
        "Rebuild a vague prompt using 6+ of the 18 techniques — show the before → after.",
      day_from: 5,
      day_to: 7,
      hours_low: 6,
      hours_high: 7,
      goals: [
        "Framing — role, goal, audience, constraints",
        "Specification — examples, format, tone, grounding",
        "Structure — delimiters, decomposition, chain-of-thought",
        "The iteration loop — refine, self-critique, steer",
      ],
      proofGoal: "Rebuild a vague prompt with 6+ techniques — before → after",
      resources: [
        {
          title: "01 · Role / persona assignment — Personas and Roles",
          url: "https://www.youtube.com/watch?v=XvCq4nPqE0Y",
        },
        {
          title: "02 · Explicit goal & desired outcome — Start Giving AI Goals",
          url: "https://www.youtube.com/watch?v=1fL_lwsdMd4",
        },
        {
          title: "03 · Audience & context — 5 Context Levels",
          url: "https://www.youtube.com/watch?v=ipIOC55AwyQ",
        },
        {
          title: "04 · Guardrails & constraints — Constraint-Based Prompts",
          url: "https://www.youtube.com/watch?v=9GHYUKYNbag",
        },
        {
          title: "05 · Clear, direct, specific instructions",
          url: "https://www.youtube.com/watch?v=ISOKIHuK7f8",
        },
        {
          title: "06 · Few-shot examples",
          url: "https://www.youtube.com/watch?v=ojtbHUqw1LA",
        },
        {
          title: "07 · Output format (lists / tables / JSON)",
          url: "https://www.youtube.com/watch?v=4_H78L9FYb8",
        },
        {
          title: "08 · Tone & voice",
          url: "https://www.youtube.com/watch?v=aBNcbyakt1w",
        },
        {
          title: "09 · Positive instruction (what to do)",
          url: "https://www.youtube.com/watch?v=aLcqH2lDlGs",
        },
        {
          title: "10 · Ground it in reference material",
          url: "https://www.youtube.com/watch?v=6dxkBftbukI",
        },
        {
          title: "11 · Delimiters & sections",
          url: "https://www.youtube.com/watch?v=aNsATNgBWqA",
        },
        {
          title: "12 · Task decomposition (break into steps)",
          url: "https://www.youtube.com/watch?v=1c9iyoVIwDs",
        },
        {
          title: "13 · Chain-of-thought (\"think step by step\")",
          url: "https://www.youtube.com/watch?v=2kvCNlpDFK0",
        },
        {
          title: "14 · Instruction placement & ordering",
          url: "https://www.youtube.com/watch?v=dOxUroR57xs",
        },
        {
          title: "15 · Prefilling / leading the answer",
          url: "https://www.youtube.com/watch?v=Uz_DeqGhbjs",
        },
        {
          title: "16 · Progressive refinement (broad → narrow)",
          url: "https://www.youtube.com/watch?v=FpdtS95T-Qg",
        },
        {
          title: "17 · Self-critique & revise",
          url: "https://www.youtube.com/shorts/uPEx9BC-aog",
        },
        {
          title: "18 · Steering with feedback & clarifying questions",
          url: "https://www.youtube.com/watch?v=CyAUoZSC8bA",
        },
      ],
    },
    {
      title: "Context",
      summary:
        "The thread has a memory limit — what to put in, what to leave out, and when to start fresh.",
      proof:
        "Run a thread to its limit, then restart clean with a summary hand-off that loses nothing.",
      day_from: 8,
      day_to: 9,
      hours_low: 4,
      hours_high: 5,
      goals: [
        "A thread has a memory limit",
        "Don't dump everything in",
        "When to start fresh",
      ],
      proofGoal: "A clean restart with a summary hand-off that loses nothing",
      resources: [
        {
          title: "What is a Context Window?",
          url: "https://www.ibm.com/think/topics/context-window",
        },
      ],
    },
    {
      title: "Trust",
      summary:
        "It can be confidently wrong; leading questions get leading answers; checking what actually matters.",
      proof:
        "Catch one confidently-wrong answer, verify it, and correct it with a non-leading follow-up.",
      day_from: 10,
      day_to: 11,
      hours_low: 4,
      hours_high: 5,
      goals: [
        "It can be confidently wrong",
        "Leading questions get leading answers",
        "Check what actually matters",
      ],
      proofGoal: "One confidently-wrong answer caught, verified, corrected",
      resources: [
        {
          title: "Why Large Language Models Hallucinate",
          url: "https://www.youtube.com/watch?v=cfqtFvWOfg0",
        },
        {
          title: "What Are AI Hallucinations?",
          url: "https://www.ibm.com/think/topics/ai-hallucinations",
        },
      ],
    },
    {
      title: "Capstone · A real task, start to finish",
      kind: "capstone",
      summary:
        "Right surface and model, connected to your data, well-prompted, and verified — a result you'd actually rely on.",
      proof: "A real task completed end-to-end, and trusted.",
      day_from: 12,
      day_to: 14,
      hours_low: 5,
      hours_high: 6,
      goals: [
        "Pick a real task that actually matters to you",
        "Choose the right surface + model + effort (and say why)",
        "Connect Claude to the actual data — not pasted descriptions",
        "Prompt it with 6+ techniques from the playbook",
        "Manage context — start fresh if the thread bloats",
        "Verify the result before you rely on it",
      ],
      proofGoal: "Put the finished result to real use",
    },
  ],
};

/* ------------------------------------------------------------------ level 2 */

const LEVEL_2: ProgramSeed = {
  title: "Level 2 · Build Something That Works Twice",
  description:
    "A structured 2-week sprint to building AI systems that work the same way twice: skills, agents, evals, and the context discipline behind reliable results. Ends in a small system you ship, with an eval that proves it works twice.",
  days: 14,
  syllabus: {
    title: "Level 2 syllabus (full document)",
    url: "/learn/kagu-learn-level-2-intermediate.html",
  },
  stages: [
    {
      title: "Landscape",
      summary:
        "Surface by task shape, model × effort as a cost/intelligence matrix, token metering, authoring your own skills, and plugins.",
      proof:
        "Author one working Skill and a model × effort routing rule you'll actually reuse.",
      day_from: 1,
      day_to: 2,
      hours_low: 4,
      hours_high: 5,
      goals: [
        "Choosing surface by task shape",
        "Model × effort as a cost/intelligence matrix",
        "Token metering — what actually drains a plan",
        "Authoring your own skills · plugins",
      ],
      proofGoal: "One working Skill + a model × effort routing rule",
      resources: [
        {
          title: "Claude Agent Skills Explained in 20 Minutes",
          url: "https://www.youtube.com/watch?v=3FuwsUvasVM",
        },
        {
          title: "Claude Plugins Explained: Skills, Marketplaces & How to Install",
          url: "https://sitegpt.ai/claude-plugins",
        },
      ],
    },
    {
      title: "Tools, MCP & agents",
      summary:
        "Protocol vs connector, skills vs MCP vs plugins, the agent loop, agent engineering, and prompt injection.",
      proof:
        "Stand up one connector/agent with a permission gate, and name its prompt-injection risk.",
      day_from: 3,
      day_to: 5,
      hours_low: 6,
      hours_high: 7,
      goals: [
        "Protocol vs connector packaging · skills vs MCP vs plugins",
        "Anatomy of an agent loop",
        "Agent engineering — scoping, permissions, verification gates, blast radius",
        "Prompt injection",
      ],
      proofGoal: "A connector/agent with a permission gate; injection risk named",
      resources: [
        {
          title: "AI Agents Explained — How They Actually Work",
          url: "https://www.youtube.com/watch?v=g24tJk8Flsk",
        },
        {
          title: "Model Context Protocol, clearly explained (why it matters)",
          url: "https://www.youtube.com/watch?v=7j_NE6Pjv-E",
        },
        {
          title: "Prompt injection explained (video + slides + transcript)",
          url: "https://simonw.substack.com/p/prompt-injection-explained-with-video",
        },
      ],
    },
    {
      title: "Prompting",
      summary:
        "Prompt as spec, testing repeatably, structured outputs, system vs turn prompt, reusable templates — 13 techniques.",
      proof: "Write a prompt-as-spec + a 5-case eval; run it 3× and show the output holds.",
      day_from: 6,
      day_to: 8,
      hours_low: 6,
      hours_high: 7,
      goals: [
        "Prompt as spec, not request · reusable templates",
        "Testing repeatably, not once · structured outputs",
        "System vs turn prompt · tool-use prompting",
        "Evaluation, golden sets, LLM-as-judge, versioning",
      ],
      proofGoal: "A spec-prompt + 5-case eval that holds across 3 runs",
      resources: [
        {
          title: "01 · Prompt-as-spec (not a casual request) — The New Code",
          url: "https://www.youtube.com/watch?v=8rABwKRsec4",
        },
        {
          title: "02 · System prompt vs turn prompt",
          url: "https://www.youtube.com/watch?v=sxPg_ZmbPlc",
        },
        {
          title: "03 · Reusable, parameterized templates",
          url: "https://www.youtube.com/watch?v=hVs8MVydN3A",
        },
        {
          title: "04 · Prompt chaining & pipelines",
          url: "https://www.youtube.com/watch?v=5kWLBdzM114",
        },
        {
          title: "05 · Meta-prompting (AI writes your prompts)",
          url: "https://www.youtube.com/watch?v=0JZisMktcbA",
        },
        {
          title: "06 · Structured outputs (JSON / schema)",
          url: "https://www.youtube.com/watch?v=CllLqPwCjD4",
        },
        {
          title: "07 · Tool-use / function-calling prompting",
          url: "https://www.youtube.com/watch?v=h8gMhXYAv1k",
        },
        {
          title: "08 · Controlling reasoning depth",
          url: "https://www.youtube.com/watch?v=AFE6x81AP4k",
        },
        {
          title: "09 · Output validation & auto-retry",
          url: "https://www.youtube.com/watch?v=r3JdQxtxVuM",
        },
        {
          title: "10 · Prompt evaluation (across many inputs)",
          url: "https://www.youtube.com/watch?v=a3SMraZWNNs",
        },
        {
          title: "11 · Golden sets & regression testing",
          url: "https://www.youtube.com/watch?v=7vqU_Yj5kUc",
        },
        {
          title: "12 · LLM-as-judge & rubrics",
          url: "https://www.youtube.com/watch?v=zaNR3WaPTfo",
        },
        {
          title: "13 · Versioning & iteration discipline",
          url: "https://www.youtube.com/watch?v=R0l4xogVG4s",
        },
      ],
    },
    {
      title: "Context orchestration",
      summary:
        "Allocating the budget, retrieval over paste, caching, persistent context, subagents, and restart discipline.",
      proof: "Re-architect one bloated task with retrieval + caching + a subagent.",
      day_from: 9,
      day_to: 10,
      hours_low: 4,
      hours_high: 5,
      goals: [
        "Allocating the budget · retrieval over paste-everything",
        "Caching · persistent context (projects, memory, CLAUDE.md)",
        "Subagents & fresh context · restart discipline",
      ],
      proofGoal: "A bloated task re-architected: retrieval + caching + a subagent",
      resources: [
        {
          title: "Context Engineering: A Practical Guide for AI Agents (2026)",
          url: "https://sourcegraph.com/blog/context-engineering",
        },
      ],
    },
    {
      title: "Failure modes",
      summary:
        "Where hallucination clusters, calibration, anchoring, automation bias, and verification cheap enough to actually do.",
      proof: "Add a cheap verification gate to one workflow and show it catching a real error.",
      day_from: 11,
      day_to: 12,
      hours_low: 4,
      hours_high: 5,
      goals: [
        "Where hallucination clusters · calibration",
        "Anchoring on its own earlier output",
        "Automation bias in the human",
        "Designing verification cheap enough to actually do",
      ],
      proofGoal: "A cheap verification gate catching a real error",
      resources: [
        {
          title: "Why Large Language Models Hallucinate",
          url: "https://www.youtube.com/watch?v=cfqtFvWOfg0",
        },
        {
          title: "LLM Hallucinations in 2026: Understand & Tackle Them",
          url: "https://www.lakera.ai/blog/guide-to-hallucinations-in-large-language-models",
        },
      ],
    },
    {
      title: "Capstone · A reusable system that works twice",
      kind: "capstone",
      summary:
        "A skill, template, or agent with an eval that proves identical results across runs — not a one-off demo.",
      proof: "A reusable system shipped, with an eval proving it works twice.",
      day_from: 13,
      day_to: 14,
      hours_low: 5,
      hours_high: 6,
      goals: [
        "Pick a repeatable job you actually do",
        "Build it as a skill, template, or agent (parameterized)",
        "Write a 5-case eval set that defines \"correct\"",
        "Run it 3× — same inputs, same quality",
        "Add one cheap verification gate",
        "Version it so you can improve without breaking it",
      ],
      proofGoal: "Ship it, and prove the eval passes twice",
    },
  ],
};

const PROGRAMS = [LEVEL_1, LEVEL_2];

/* ------------------------------------------------------------------- runner */

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function istanbulToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seedProgram(
  supabase: SupabaseClient,
  program: ProgramSeed,
  startsOn: string
) {
  const endsOn = addDays(startsOn, program.days - 1);

  // Match on title so re-running edits the same sprint rather than piling up
  // copies. Participants and ticks are never touched.
  const { data: existing, error: findError } = await supabase
    .from("sprints")
    .select("id")
    .eq("title", program.title)
    .eq("is_demo", false)
    .maybeSingle();
  if (findError) throw new Error(`Looking up "${program.title}": ${findError.message}`);

  let sprintId: string;
  if (existing) {
    sprintId = existing.id;
    const { error } = await supabase
      .from("sprints")
      .update({
        description: program.description,
        starts_on: startsOn,
        ends_on: endsOn,
        join_mode: "open",
      })
      .eq("id", sprintId);
    if (error) throw new Error(`Updating "${program.title}": ${error.message}`);

    // Stages cascade to their goals and null out their resources, so clearing
    // stages first leaves only the unstaged leftovers to sweep.
    await supabase.from("sprint_stages").delete().eq("sprint_id", sprintId);
    await supabase.from("sprint_goals").delete().eq("sprint_id", sprintId);
    await supabase.from("sprint_resources").delete().eq("sprint_id", sprintId);
  } else {
    const { data, error } = await supabase
      .from("sprints")
      .insert({
        title: program.title,
        description: program.description,
        starts_on: startsOn,
        ends_on: endsOn,
        join_mode: "open",
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`Creating "${program.title}": ${error?.message ?? "no row"}`);
    }
    sprintId = data.id;
  }

  // Stages first — goals and resources both reference them.
  const { data: stageRows, error: stageError } = await supabase
    .from("sprint_stages")
    .insert(
      program.stages.map((stage, index) => ({
        sprint_id: sprintId,
        title: stage.title,
        summary: stage.summary ?? null,
        proof: stage.proof ?? null,
        kind: stage.kind ?? "stage",
        day_from: stage.day_from ?? null,
        day_to: stage.day_to ?? null,
        hours_low: stage.hours_low ?? null,
        hours_high: stage.hours_high ?? null,
        sort_order: index,
      }))
    )
    .select("id, sort_order");
  if (stageError) throw new Error(`Stages for "${program.title}": ${stageError.message}`);

  const stageIdByOrder = new Map<number, string>();
  for (const row of stageRows ?? []) stageIdByOrder.set(row.sort_order, row.id);

  // Goals: sort_order runs across the whole sprint so the standings race and
  // the "on · <goal>" line follow the stage order.
  const goalRows: {
    sprint_id: string;
    stage_id: string;
    title: string;
    is_proof: boolean;
    sort_order: number;
  }[] = [];
  let order = 0;
  program.stages.forEach((stage, index) => {
    const stageId = stageIdByOrder.get(index);
    if (!stageId) return;
    for (const title of stage.goals) {
      goalRows.push({
        sprint_id: sprintId,
        stage_id: stageId,
        title,
        is_proof: false,
        sort_order: order++,
      });
    }
    if (stage.proofGoal) {
      goalRows.push({
        sprint_id: sprintId,
        stage_id: stageId,
        title: stage.proofGoal,
        is_proof: true,
        sort_order: order++,
      });
    }
  });
  const { error: goalError } = await supabase.from("sprint_goals").insert(goalRows);
  if (goalError) throw new Error(`Goals for "${program.title}": ${goalError.message}`);

  const resourceRows: {
    sprint_id: string;
    stage_id: string | null;
    title: string;
    url: string;
  }[] = [];
  if (program.syllabus) {
    // Sprint-wide: the document itself, on the shelf rather than in a stage.
    resourceRows.push({
      sprint_id: sprintId,
      stage_id: null,
      title: program.syllabus.title,
      url: program.syllabus.url,
    });
  }
  program.stages.forEach((stage, index) => {
    const stageId = stageIdByOrder.get(index);
    if (!stageId) return;
    for (const resource of stage.resources ?? []) {
      resourceRows.push({
        sprint_id: sprintId,
        stage_id: stageId,
        title: resource.title,
        url: resource.url,
      });
    }
  });
  if (resourceRows.length > 0) {
    const { error } = await supabase.from("sprint_resources").insert(resourceRows);
    if (error) throw new Error(`Resources for "${program.title}": ${error.message}`);
  }

  return {
    id: sprintId,
    created: !existing,
    stages: program.stages.length,
    goals: goalRows.length,
    resources: resourceRows.length,
  };
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  const startFlag = process.argv.indexOf("--start");
  const startsOn =
    startFlag !== -1 && process.argv[startFlag + 1]
      ? process.argv[startFlag + 1]
      : istanbulToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) {
    throw new Error(`--start must be YYYY-MM-DD, got "${startsOn}"`);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const program of PROGRAMS) {
    const result = await seedProgram(supabase, program, startsOn);
    console.log(
      `${result.created ? "Created" : "Refreshed"} "${program.title}" — ` +
        `${result.stages} stages, ${result.goals} goals, ${result.resources} resources ` +
        `(${result.id})`
    );
  }
  console.log(`\nBoth programs start ${startsOn} and are open to join.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
