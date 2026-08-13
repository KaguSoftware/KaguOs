/**
 * Seeds the two Kagu Learn programs (Level 1 Beginner, Level 2 Intermediate)
 * as real, joinable sprints — stages, goals, proofs, and the resources that
 * hang off each. The source is the two syllabus documents in `public/learn/`;
 * this script is what turns them from a page you read into a sprint you run.
 *
 * Idempotent: a program is matched by title, and so is every stage, goal and
 * resource inside it. Re-running edits rows in place rather than replacing
 * them, so the sprint keeps its participants and everyone keeps their ticks —
 * it's safe to re-run after editing the content below. Reword a goal and you
 * retire it: the old row (and the ticks on it) goes, because nobody has done
 * the new thing yet.
 *
 * Usage:  npx tsx scripts/seed-learn-levels.ts [--start YYYY-MM-DD]
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ResourceSeed = {
  title: string;
  url: string;
  /** Decides the row's mark: a play triangle or an open book. */
  kind?: "video" | "read" | "link";
  /** Who made it — shown small and right-aligned. */
  source?: string;
};

/**
 * A goal, and optionally the run of resources that teaches exactly it — the
 * prompting playbook lives here, one technique per row, one video each. They
 * seed with a `goal_id` (0060), which is what makes them render numbered under
 * their goal rather than in a reading list beside it.
 */
type GoalSeed = {
  title: string;
  /** Videos for this goal specifically. Default kind is 'video'. */
  teach?: ResourceSeed[];
};

/** Most goals are just a line of text; the terse form stays available. */
type GoalEntry = string | GoalSeed;

const asGoal = (entry: GoalEntry): GoalSeed =>
  typeof entry === "string" ? { title: entry } : entry;

type StageSeed = {
  title: string;
  summary?: string;
  proof?: string;
  kind?: "stage" | "capstone";
  day_from?: number;
  day_to?: number;
  hours_low?: number;
  hours_high?: number;
  goals: GoalEntry[];
  /** The goal that IS the proof. Appended after `goals`. */
  proofGoal?: string;
  /** Resources for the stage as a whole — its "where to learn it" list. */
  resources?: ResourceSeed[];
};

type ProgramSeed = {
  title: string;
  /** Sits under the title: "Using Claude — the beginner program". */
  tagline: string;
  description: string;
  /** The sign-off at the foot of the run. */
  outro: string;
  /** Length in days, inclusive of both ends. */
  days: number;
  syllabus?: { title: string; url: string };
  stages: StageSeed[];
  /** Study rules: label "70 / 30", title "Use it live", body why. */
  rules?: { label: string; title: string; body: string }[];
  /** One day, blocked out: label "Review", 15 minutes, body what you do. */
  session?: { label: string; minutes: number; body: string }[];
  /** The capstone's build timeline: label "D12", body what to do that day. */
  build?: { label: string; body: string }[];
};

/* ------------------------------------------------------------------ level 1 */

const LEVEL_1: ProgramSeed = {
  title: "Level 1 · Getting a Good Answer",
  tagline: "Using Claude — the beginner program",
  description:
    "A structured 2-week sprint to getting genuinely useful answers out of Claude: knowing what to reach for, prompting it properly, and trusting what comes back. Five stages, each unlocking the next, ending in one real task done start to finish.",
  outro:
    "By day 14 you'll reach for the right tool, prompt it like a spec, know when to start fresh, and know when to believe it — the difference between typing questions and getting real work done. Consistency beats intensity: twenty focused minutes a day beats a five-hour weekend once.",
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
          kind: "video",
          source: "YouTube",
        },
        {
          title: "Claude Models Explained: Opus vs Sonnet vs Haiku vs Fable",
          url: "https://www.usecarly.com/blog/claude-models-explained/",
          kind: "read",
          source: "usecarly",
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
          kind: "video",
          source: "AI Foundations",
        },
        {
          title: "Set Up Claude Cowork: Files, Instructions, Plugins & Connectors",
          url: "https://cohorte.co/ai-articles/how-to-set-up-claude-cowork-files-instructions-plugins-and-connectors-2026",
          kind: "read",
          source: "Cohorte",
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
      // The eighteen techniques hang off the four goals they teach: one
      // Framing on the page, not a goal called Framing and a playbook group
      // called Framing. Every link below was watched end-to-end and confirmed
      // to teach its exact technique. Where the syllabus deck pointed six of
      // these at timestamped sections of one long freeCodeCamp tutorial, each
      // has a dedicated video here instead — a section marker is not a link
      // you can hand someone.
      goals: [
        {
          title: "Framing — role, goal, audience, constraints",
          teach: [
            {
              title: "Role / persona assignment",
              url: "https://www.youtube.com/watch?v=XvCq4nPqE0Y",
              source: "All About AI",
            },
            {
              title: "Explicit goal & desired outcome",
              url: "https://www.youtube.com/watch?v=1fL_lwsdMd4",
              source: "Start Giving AI Goals",
            },
            {
              title: "Audience & context",
              url: "https://www.youtube.com/watch?v=ipIOC55AwyQ",
              source: "5 Context Levels",
            },
            {
              title: "Guardrails & constraints",
              url: "https://www.youtube.com/watch?v=9GHYUKYNbag",
              source: "Constraint-Based Prompts",
            },
          ],
        },
        {
          title: "Specification — examples, format, tone, grounding",
          teach: [
            {
              title: "Clear, direct, specific instructions",
              url: "https://www.youtube.com/watch?v=ISOKIHuK7f8",
              source: "Prompting Basics",
            },
            {
              title: "Few-shot examples",
              url: "https://www.youtube.com/watch?v=ojtbHUqw1LA",
              source: "Elvis Saravia",
            },
            {
              title: "Output format (lists / tables / JSON)",
              url: "https://www.youtube.com/watch?v=4_H78L9FYb8",
              source: "Output Formatting",
            },
            {
              title: "Tone & voice",
              url: "https://www.youtube.com/watch?v=aBNcbyakt1w",
              source: "Kingy AI",
            },
            {
              title: "Positive instruction (what to do)",
              url: "https://www.youtube.com/watch?v=aLcqH2lDlGs",
              source: "AI with Kyle",
            },
            {
              title: "Ground it in reference material",
              url: "https://www.youtube.com/watch?v=6dxkBftbukI",
              source: "Moveworks",
            },
          ],
        },
        {
          title: "Structure — delimiters, decomposition, chain-of-thought",
          teach: [
            {
              title: "Delimiters & sections",
              url: "https://www.youtube.com/watch?v=aNsATNgBWqA",
              source: "Automation Step by Step",
            },
            {
              title: "Task decomposition (break into steps)",
              url: "https://www.youtube.com/watch?v=1c9iyoVIwDs",
              source: "IBM Technology",
            },
            {
              title: 'Chain-of-thought ("think step by step")',
              url: "https://www.youtube.com/watch?v=2kvCNlpDFK0",
              source: "Google Cloud Tech",
            },
            {
              title: "Instruction placement & ordering",
              url: "https://www.youtube.com/watch?v=dOxUroR57xs",
              source: "Elvis Saravia",
            },
            {
              title: "Prefilling / leading the answer",
              url: "https://www.youtube.com/watch?v=Uz_DeqGhbjs",
              source: "Lawton Learns",
            },
          ],
        },
        {
          title: "The iteration loop — refine, self-critique, steer",
          teach: [
            {
              title: "Progressive refinement (broad → narrow)",
              url: "https://www.youtube.com/watch?v=FpdtS95T-Qg",
              source: "Iterative Prompting",
            },
            {
              title: "Self-critique & revise",
              url: "https://www.youtube.com/shorts/uPEx9BC-aog",
              source: "Nick Sadler",
            },
            {
              title: "Steering with feedback & clarifying questions",
              url: "https://www.youtube.com/watch?v=CyAUoZSC8bA",
              source: "SkillCurb",
            },
          ],
        },
      ],
      proofGoal: "Rebuild a vague prompt with 6+ techniques — before → after",
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
          kind: "read",
          source: "IBM Technology",
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
          kind: "video",
          source: "IBM Technology",
        },
        {
          title: "What Are AI Hallucinations?",
          url: "https://www.ibm.com/think/topics/ai-hallucinations",
          kind: "read",
          source: "IBM",
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
        "Prompt it with 6+ of the 18 techniques",
        "Manage context — start fresh if the thread bloats",
        "Verify the result before you rely on it",
      ],
      proofGoal: "Put the finished result to real use",
    },
  ],

  rules: [
    {
      label: "70 / 30",
      title: "Use it live",
      body: "Spend 70% of your time in an actual Claude window trying things, 30% watching or reading.",
    },
    {
      label: "1 at a time",
      title: "One technique a day",
      body: "Take a single technique, use it on a real task today, feel the difference, then add the next.",
    },
    {
      label: "Steal it",
      title: "Steal the prompt",
      body: "When a video shows a prompt, pause and run your own version immediately. Muscle memory beats notes.",
    },
    {
      label: "Verify",
      title: "Trust, then verify",
      body: 'Every important answer gets one check. Assume "confident" does not mean "correct" until you have looked.',
    },
    {
      label: "Journal",
      title: "Keep a prompt journal",
      body: "Save the prompts that worked. Your best asset is a personal library of what gets good answers.",
    },
    {
      label: "Ship it",
      title: "Ship the capstone",
      body: "Theory without a finished task is tutorial hell. Build the real thing by day 12.",
    },
  ],

  session: [
    { label: "Review", minutes: 15, body: "Yesterday's technique + a warm-up prompt" },
    { label: "Learn", minutes: 40, body: "The day's stage — one resource" },
    { label: "Break", minutes: 10, body: "Step away from the screen" },
    { label: "Practice", minutes: 40, body: "Use it on a real task of your own" },
    { label: "Reflect", minutes: 15, body: "What worked; one thing to reuse tomorrow" },
  ],

  build: [
    { label: "D12", body: "Pick the task, choose surface / model, connect your data" },
    { label: "D13", body: "Draft with strong prompts; iterate to a genuinely good answer" },
    { label: "D14", body: "Verify, polish, and put it to real use" },
  ],
};

/* ------------------------------------------------------------------ level 2 */

const LEVEL_2: ProgramSeed = {
  title: "Level 2 · Build Something That Works Twice",
  tagline: "Using Claude — the intermediate program",
  description:
    "A structured 2-week sprint to building AI systems that work the same way twice: skills, agents, evals, and the context discipline behind reliable results. Ends in a small system you ship, with an eval that proves it works twice.",
  outro:
    "By day 14 you'll have shipped something repeatable — scoped, evaluated, verified, and versioned. The instincts that separate a lucky answer from a reliable system come from building one and proving it runs twice. If it only worked once, it didn't work.",
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
          kind: "video",
          source: "Simplilearn",
        },
        {
          title: "Claude Plugins Explained: Skills, Marketplaces & How to Install",
          url: "https://sitegpt.ai/claude-plugins",
          kind: "read",
          source: "SiteGPT",
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
          kind: "video",
          source: "YouTube",
        },
        {
          title: "Model Context Protocol, clearly explained (why it matters)",
          url: "https://www.youtube.com/watch?v=7j_NE6Pjv-E",
          kind: "video",
          source: "YouTube",
        },
        {
          title: "Prompt injection explained (video + slides + transcript)",
          url: "https://simonw.substack.com/p/prompt-injection-explained-with-video",
          kind: "read",
          source: "Simon Willison",
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
      // The thirteen techniques, filed under the goal each one serves. Level 1's
      // playbook grouped by A / B / C, which was a second taxonomy laid over the
      // goals; these are the goals themselves.
      goals: [
        {
          title: "Prompt as spec, not request · reusable templates",
          teach: [
            {
              title: "Prompt-as-spec (not a casual request)",
              url: "https://www.youtube.com/watch?v=8rABwKRsec4",
              source: "AI Engineer",
            },
            {
              title: "Reusable, parameterized templates",
              url: "https://www.youtube.com/watch?v=hVs8MVydN3A",
              source: "Leon van Zyl",
            },
            {
              title: "Prompt chaining & pipelines",
              url: "https://www.youtube.com/watch?v=5kWLBdzM114",
              source: "Sundeep S. Kanthety",
            },
            {
              title: "Meta-prompting (AI writes your prompts)",
              url: "https://www.youtube.com/watch?v=0JZisMktcbA",
              source: "Maven Analytics",
            },
          ],
        },
        {
          title: "Testing repeatably, not once · structured outputs",
          teach: [
            {
              title: "Structured outputs (JSON / schema)",
              url: "https://www.youtube.com/watch?v=CllLqPwCjD4",
              source: "Telusko",
            },
            {
              title: "Output validation & auto-retry",
              url: "https://www.youtube.com/watch?v=r3JdQxtxVuM",
              source: "Apply AI like a Pro",
            },
          ],
        },
        {
          title: "System vs turn prompt · tool-use prompting",
          teach: [
            {
              title: "System prompt vs turn prompt",
              url: "https://www.youtube.com/watch?v=sxPg_ZmbPlc",
              source: "Dan Cleary",
            },
            {
              title: "Tool-use / function-calling prompting",
              url: "https://www.youtube.com/watch?v=h8gMhXYAv1k",
              source: "IBM Technology",
            },
            {
              title: "Controlling reasoning depth",
              url: "https://www.youtube.com/watch?v=AFE6x81AP4k",
              source: "CodeEmporium",
            },
          ],
        },
        {
          title: "Evaluation, golden sets, LLM-as-judge, versioning",
          teach: [
            {
              title: "Prompt evaluation (across many inputs)",
              url: "https://www.youtube.com/watch?v=a3SMraZWNNs",
              source: "Dave Ebbelaar",
            },
            {
              title: "Golden sets & regression testing",
              url: "https://www.youtube.com/watch?v=7vqU_Yj5kUc",
              source: "Latitude",
            },
            {
              title: "LLM-as-judge & rubrics",
              url: "https://www.youtube.com/watch?v=zaNR3WaPTfo",
              source: "Microsoft Reactor",
            },
            {
              title: "Versioning & iteration discipline",
              url: "https://www.youtube.com/watch?v=R0l4xogVG4s",
              source: "LangChain",
            },
          ],
        },
      ],
      proofGoal: "A spec-prompt + 5-case eval that holds across 3 runs",
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
          kind: "read",
          source: "Sourcegraph",
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
          kind: "video",
          source: "IBM Technology",
        },
        {
          title: "LLM Hallucinations in 2026: Understand & Tackle Them",
          url: "https://www.lakera.ai/blog/guide-to-hallucinations-in-large-language-models",
          kind: "read",
          source: "Lakera",
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

  rules: [
    {
      label: "70 / 30",
      title: "Build it live",
      body: "70% of your time inside a real project wiring things up, 30% watching or reading.",
    },
    {
      label: "Run twice",
      title: "Twice or it doesn't count",
      body: "A result that worked once is a demo. Re-run it on new inputs before you believe it.",
    },
    {
      label: "Steal it",
      title: "Steal the prompt & eval",
      body: "When a video shows a prompt or an eval, rebuild your own version on your own data now.",
    },
    {
      label: "Gate it",
      title: "Cheap gates beat hope",
      body: "Add the smallest verification that would catch the failure you fear most.",
    },
    {
      label: "Version",
      title: "Treat prompts like code",
      body: "Version every working prompt so you can improve it without silently breaking it.",
    },
    {
      label: "Ship it",
      title: "Ship the system",
      body: "A reusable system shipped by day 13 beats a perfect one you never finish.",
    },
  ],

  session: [
    { label: "Review", minutes: 15, body: "Re-run yesterday's build; confirm it still holds" },
    { label: "Learn", minutes: 40, body: "The day's stage — one resource" },
    { label: "Break", minutes: 10, body: "Step away from the screen" },
    { label: "Build", minutes: 40, body: "Wire it into your own project" },
    { label: "Verify", minutes: 15, body: "Run it twice; note what to version" },
  ],

  build: [
    { label: "D13", body: "Build the system and its 5-case eval set" },
    { label: "D14", body: "Run it 3×, add the verification gate, version and ship" },
  ],
};

const PROGRAMS = [LEVEL_1, LEVEL_2];

/* ------------------------------------------------------------------- runner */

/**
 * Fill process.env from `.env.local` if it's there.
 *
 * Absent is not an error: a fresh clone, CI, or a shell that already exports
 * the two variables are all fine. The script used to crash here with a raw
 * ENOENT that named a file rather than the thing actually missing, which sent
 * you looking for the wrong problem. The real check is below, on the variables.
 */
function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
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

/**
 * Reconcile a list of seeded rows against what's already in the table, matched
 * by title.
 *
 * The obvious implementation — delete everything, insert everything — is what
 * this script used to do, and it was quietly destructive: `sprint_goal_progress`
 * cascades from `sprint_goals`, so every re-run wiped the ticks it claimed to
 * keep. Matching by title means a goal whose wording didn't change keeps its id,
 * and therefore keeps everyone's progress against it.
 *
 * Titles are the key because they're what a person recognises. Rewording a goal
 * IS retiring it and adding a new one, and losing the ticks on it is correct:
 * nobody has done the new thing yet.
 */
async function reconcile<T extends { title: string }>(
  supabase: SupabaseClient,
  table: "sprint_stages" | "sprint_goals" | "sprint_resources",
  sprintId: string,
  rows: T[]
): Promise<Map<string, string>> {
  // Title is the identity here, so two seeded rows sharing one would silently
  // collapse into a single row. Cheaper to refuse than to debug the missing
  // goal later.
  const titles = new Set<string>();
  for (const row of rows) {
    if (titles.has(row.title)) {
      throw new Error(`Duplicate ${table} title in the seed: "${row.title}"`);
    }
    titles.add(row.title);
  }

  const { data: existing, error: readError } = await supabase
    .from(table)
    .select("id, title")
    .eq("sprint_id", sprintId);
  if (readError) throw new Error(`Reading ${table}: ${readError.message}`);

  const idByTitle = new Map<string, string>();
  for (const row of existing ?? []) {
    // A duplicate title in the table can only be matched once; the extra copy
    // falls through to the sweep below and is removed.
    if (!idByTitle.has(row.title)) idByTitle.set(row.title, row.id);
  }

  const kept = new Map<string, string>();
  const inserts: T[] = [];
  for (const row of rows) {
    const id = idByTitle.get(row.title);
    if (id) {
      const { error } = await supabase.from(table).update(row).eq("id", id);
      if (error) throw new Error(`Updating ${table} "${row.title}": ${error.message}`);
      kept.set(row.title, id);
    } else {
      inserts.push(row);
    }
  }

  if (inserts.length > 0) {
    const { data, error } = await supabase.from(table).insert(inserts).select("id, title");
    if (error) throw new Error(`Inserting ${table}: ${error.message}`);
    for (const row of data ?? []) kept.set(row.title, row.id);
  }

  // Anything in the table that the seed no longer lists is gone from the
  // program, so its rows (and any progress hanging off them) go with it.
  const staleIds = (existing ?? [])
    .filter((row) => kept.get(row.title) !== row.id)
    .map((row) => row.id);
  if (staleIds.length > 0) {
    const { error } = await supabase.from(table).delete().in("id", staleIds);
    if (error) throw new Error(`Pruning ${table}: ${error.message}`);
  }

  return kept;
}

async function seedProgram(
  supabase: SupabaseClient,
  program: ProgramSeed,
  startsOn: string
) {
  const endsOn = addDays(startsOn, program.days - 1);

  // Match on title so re-running edits the same sprint rather than piling up
  // copies. Participants and ticks survive — see `reconcile` above.
  const { data: existing, error: findError } = await supabase
    .from("sprints")
    .select("id")
    .eq("title", program.title)
    .eq("is_demo", false)
    .maybeSingle();
  if (findError) throw new Error(`Looking up "${program.title}": ${findError.message}`);

  const fields = {
    description: program.description,
    tagline: program.tagline,
    outro: program.outro,
    starts_on: startsOn,
    ends_on: endsOn,
    join_mode: "open",
  };

  let sprintId: string;
  if (existing) {
    sprintId = existing.id;
    const { error } = await supabase.from("sprints").update(fields).eq("id", sprintId);
    if (error) throw new Error(`Updating "${program.title}": ${error.message}`);
  } else {
    const { data, error } = await supabase
      .from("sprints")
      .insert({ title: program.title, ...fields })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`Creating "${program.title}": ${error?.message ?? "no row"}`);
    }
    sprintId = data.id;
  }

  // Stages first — goals and resources both reference them. Note the order:
  // goals and resources are repointed at the surviving stage ids BEFORE any
  // stage is pruned, so a stage that goes away never cascades a goal that
  // simply moved.
  const stageIds = await reconcile(
    supabase,
    "sprint_stages",
    sprintId,
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
  );

  // Goals: sort_order runs across the whole sprint so the standings race and
  // the "next · <goal>" line follow the stage order.
  const goalRows: {
    sprint_id: string;
    stage_id: string;
    title: string;
    is_proof: boolean;
    sort_order: number;
  }[] = [];
  let order = 0;
  for (const stage of program.stages) {
    const stageId = stageIds.get(stage.title);
    if (!stageId) continue;
    for (const entry of stage.goals) {
      goalRows.push({
        sprint_id: sprintId,
        stage_id: stageId,
        title: asGoal(entry).title,
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
  }
  // Goal ids are needed below: a technique points at the goal it teaches, and
  // goal titles are unique per sprint (reconcile refuses duplicates), so the
  // returned title → id map is the lookup.
  const goalIds = await reconcile(supabase, "sprint_goals", sprintId, goalRows);

  const resourceRows: {
    sprint_id: string;
    stage_id: string | null;
    goal_id: string | null;
    title: string;
    url: string;
    kind: string;
    source: string | null;
    sort_order: number;
  }[] = [];
  let resourceOrder = 0;

  if (program.syllabus) {
    // Sprint-wide: the document itself, on the shelf rather than in a stage.
    resourceRows.push({
      sprint_id: sprintId,
      stage_id: null,
      goal_id: null,
      title: program.syllabus.title,
      url: program.syllabus.url,
      kind: "read",
      source: "the original deck",
      sort_order: resourceOrder++,
    });
  }

  for (const stage of program.stages) {
    const stageId = stageIds.get(stage.title);
    if (!stageId) continue;

    // The stage's own reading list first, then each goal's run of techniques.
    // A technique keeps its stage_id as well as its goal_id, so retiring the
    // goal drops it back into the reading list rather than off the page.
    for (const resource of stage.resources ?? []) {
      resourceRows.push({
        sprint_id: sprintId,
        stage_id: stageId,
        goal_id: null,
        title: resource.title,
        url: resource.url,
        kind: resource.kind ?? "link",
        source: resource.source ?? null,
        sort_order: resourceOrder++,
      });
    }

    for (const entry of stage.goals) {
      const goal = asGoal(entry);
      if (!goal.teach) continue;
      const goalId = goalIds.get(goal.title);
      if (!goalId) continue;
      for (const item of goal.teach) {
        resourceRows.push({
          sprint_id: sprintId,
          stage_id: stageId,
          goal_id: goalId,
          title: item.title,
          url: item.url,
          kind: item.kind ?? "video",
          source: item.source ?? null,
          sort_order: resourceOrder++,
        });
      }
    }
  }

  await reconcile(supabase, "sprint_resources", sprintId, resourceRows);

  // Practices carry no per-person state, so replacing them wholesale costs
  // nothing and keeps the reconcile helper to the three tables that do.
  const { error: practiceWipe } = await supabase
    .from("sprint_practices")
    .delete()
    .eq("sprint_id", sprintId);
  if (practiceWipe) {
    throw new Error(`Clearing practices for "${program.title}": ${practiceWipe.message}`);
  }

  const practiceRows = [
    ...(program.rules ?? []).map((rule, index) => ({
      sprint_id: sprintId,
      kind: "rule",
      label: rule.label,
      title: rule.title,
      body: rule.body,
      minutes: null,
      sort_order: index,
    })),
    ...(program.session ?? []).map((block, index) => ({
      sprint_id: sprintId,
      kind: "session",
      label: block.label,
      title: null,
      body: block.body,
      minutes: block.minutes,
      sort_order: index,
    })),
    ...(program.build ?? []).map((step, index) => ({
      sprint_id: sprintId,
      kind: "build",
      label: step.label,
      title: null,
      body: step.body,
      minutes: null,
      sort_order: index,
    })),
  ];
  if (practiceRows.length > 0) {
    const { error } = await supabase.from("sprint_practices").insert(practiceRows);
    if (error) throw new Error(`Practices for "${program.title}": ${error.message}`);
  }

  return {
    id: sprintId,
    created: !existing,
    stages: program.stages.length,
    goals: goalRows.length,
    resources: resourceRows.length,
    practices: practiceRows.length,
  };
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    throw new Error(
      `Missing ${missing.join(" and ")}.\n` +
        "Put them in .env.local (vercel link && vercel env pull .env.local), " +
        "or export them for one run:\n" +
        "  SUPABASE_SERVICE_ROLE_KEY=… npm run seed:learn"
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
        `${result.stages} stages, ${result.goals} goals, ${result.resources} resources, ` +
        `${result.practices} practice blocks (${result.id})`
    );
  }
  console.log(`\nBoth programs start ${startsOn} and are open to join.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
