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
  /** The sentence under the title: what the line actually means. */
  detail?: string;
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
  /** The paragraphs behind the summary. Blank line = new paragraph. */
  detail?: string;
  proof?: string;
  /** The proof at length: what to actually do, before you do it. */
  proofBrief?: string;
  /** What to hand in, in the imperative. */
  proofSubmit?: string;
  /** The conditions the hand-in is read against — one per row (0061). */
  criteria?: string[];
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
      detail:
        "Three surfaces, three model tiers, one effort dial. Chat is a conversation you drive turn by turn. Cowork is Claude working across your files and connected tools while you watch. Claude Code lives in a terminal inside a project and edits it. Reaching for the wrong one is the most common reason a perfectly good prompt gives a useless answer — you asked a conversation to do a filing job.\n\n" +
        "The model tier is a weight class, not a quality ranking: Haiku for volume and speed, Sonnet for everyday work, Opus for the task you'd be annoyed to get wrong. The effort dial then buys thinking time on top of whichever you picked, which is why it matters more than the tier on anything with reasoning in it.\n\n" +
        "Skills sit above all of it: instructions you write once and reuse, so a routing decision you work out this week is still working for you next month instead of being retyped from memory.",
      proof:
        "Route 3 real tasks to the right surface + model + effort, and justify each in one line.",
      proofBrief:
        "Take three tasks off your own week — real ones you actually have to do, not examples. For each, decide the surface, the model tier and the effort level, and write the one line that justifies the choice.\n\n" +
        "At least one of the three should land somewhere you wouldn't have gone by default. If all three read \"Chat, Sonnet, high\", you've written down a habit rather than made a decision, and the stage hasn't happened yet.",
      proofSubmit:
        "Paste the three tasks with their routing and reasons. If you ran any of them, paste what came back too — a routing call is easier to judge next to its result.",
      criteria: [
        "Three tasks, all real ones from your own week",
        "Each names a surface, a model tier and an effort level",
        "Each carries a one-line reason tied to the task, not to the model",
        "At least one routes somewhere other than your usual default",
      ],
      day_from: 1,
      day_to: 2,
      hours_low: 4,
      hours_high: 5,
      goals: [
        {
          title: "Chat vs Cowork vs Claude Code — at recognition level",
          detail:
            "Given a task, you can say which of the three it belongs on in one sentence, without hedging.",
        },
        {
          title: "Three model tiers, and picking by task weight",
          detail:
            "Haiku, Sonnet, Opus. You can name the trade you're making when you pick one, in speed and in cost.",
        },
        {
          title: "The effort dial — and why high is usually right",
          detail:
            "Effort buys reasoning depth on any tier. You know what it costs you and the kind of task where it's wasted.",
        },
        {
          title: "Skills as reusable instructions",
          detail:
            "What a skill is, where it lives, and which instructions belong in one rather than being retyped into every prompt.",
        },
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
      detail:
        "A described file is a rumour. When you paste \"our pricing sheet has three tiers and some regional discounts\", you've already done the summarising, and every mistake in your summary is now in the answer. Connect the sheet instead and the reading is Claude's job, done against the real numbers.\n\n" +
        "This stage is mostly setup you do once: files, mail, and whichever connectors your work actually runs on. The part worth slowing down for is the boundary — what a connector can see, what it can change, and what it silently can't reach. Knowing the boundary is what stops you trusting an answer that was assembled out of half the evidence.",
      proof: "Pull an answer from your own file that a pasted description couldn't give.",
      proofBrief:
        "Connect one real source of yours — a spreadsheet, a folder, a mailbox — and ask it a question whose answer you can check. Then ask the same question again with the source disconnected and the file described in words instead.\n\n" +
        "The point is the gap between the two answers. A question that a description answers just as well isn't proof of anything; pick one that needs a number, a date, or an exact line from the file.",
      proofSubmit:
        "Paste both answers, the connected one and the described one, and one line on what the description got wrong or couldn't reach. Attach the file if it's not sensitive.",
      criteria: [
        "A real source of yours is connected, not a sample file",
        "The question needs something exact — a number, a date, a specific line",
        "Both answers are shown: connected, and from a description",
        "You say what the description missed, and how you verified the connected answer",
      ],
      day_from: 3,
      day_to: 4,
      hours_low: 4,
      hours_high: 5,
      goals: [
        {
          title: "Connect Claude to your files, mail, and tools",
          detail:
            "One source of each kind, connected and working — not read about, actually attached to your account.",
        },
        {
          title: "What it can and can't reach",
          detail:
            "The boundary of a connector: what it sees, what it may change, and what stays invisible to it.",
        },
        {
          title: "Why a connected Claude beats a described one",
          detail:
            "Describing a file makes you the summariser, and every mistake in your summary lands in the answer.",
        },
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
      detail:
        "Eighteen techniques, in four groups, and the groups are the order you apply them in. Framing sets the scene: who's answering, for whom, aiming at what, inside which limits. Specification pins the output down — examples, format, tone, and the material to ground it in. Structure organises the request itself: delimiters, decomposition, thinking out loud. The iteration loop is what you do to the answer you got.\n\n" +
        "This is the longest stage of the program and the one that pays for the rest. Take one technique at a time onto a real task, notice what changed, then add the next. Reading all eighteen in an evening teaches you the names and none of the instincts.",
      proof:
        "Rebuild a vague prompt using 6+ of the 18 techniques — show the before → after.",
      proofBrief:
        "Find a prompt of yours that gave a mediocre answer — a real one from your history, not one written to be bad. Rebuild it using at least six of the eighteen techniques, run both versions, and keep all four artefacts: the old prompt, its answer, the new prompt, its answer.\n\n" +
        "Name the techniques you used as you go. \"I added a role, two examples and an output format\" is the part that transfers to the next prompt; \"it got better\" isn't.",
      proofSubmit:
        "Paste the before prompt, the after prompt, and both answers. List the techniques you applied by name, and add one line on which of them made the biggest difference.",
      criteria: [
        "The starting prompt is a real one of yours that underperformed",
        "Six or more of the eighteen techniques are applied and named",
        "Both answers are shown, from the same model and effort level",
        "You say which technique moved the answer most, and why you think so",
      ],
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
          detail:
            "Who is answering, for whom, aiming at what, inside which limits. Four sentences of scene-setting that decide the shape of everything after them.",
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
          detail:
            "Pinning the output down. One example is worth a paragraph of description, and a named format is worth an argument about it afterwards.",
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
          detail:
            "Organising the request itself, so a long prompt reads as sections rather than one paragraph the model has to untangle before it can start.",
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
          detail:
            "What you do to the answer you got. Most good results are the third version, and steering beats rewriting the prompt from scratch.",
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
      detail:
        "A thread is a window, not a memory. Everything in it — your files, its answers, the three tangents you abandoned — competes for the same space, and once the window fills the earliest material stops carrying weight. This is why a long conversation slowly gets worse at the thing it was good at an hour ago.\n\n" +
        "The two habits that fix it are unglamorous: put in what the task needs and nothing else, and start fresh when the thread has drifted rather than nursing it along. A clean restart with a short hand-off costs two minutes and usually buys back the sharpness you'd been trying to prompt your way to.",
      proof:
        "Run a thread to its limit, then restart clean with a summary hand-off that loses nothing.",
      proofBrief:
        "Take a working thread far enough to feel it degrade — repetition, forgotten constraints, answers drifting off the thing you asked. Then write the hand-off: a short summary carrying the decisions, the constraints and the current state, and nothing else.\n\n" +
        "Open a fresh thread with that hand-off and continue. The test is that the new thread picks up without you re-explaining anything, and answers at least as well as the old one did at its best.",
      proofSubmit:
        "Paste your hand-off summary, plus one line on where the old thread started slipping and one on how the fresh one behaved.",
      criteria: [
        "You name the point where the long thread started degrading, and how you noticed",
        "The hand-off carries decisions, constraints and current state — not a transcript",
        "The fresh thread continues without re-explaining what was already settled",
        "You say what you deliberately left out of the hand-off",
      ],
      day_from: 8,
      day_to: 9,
      hours_low: 4,
      hours_high: 5,
      goals: [
        {
          title: "A thread has a memory limit",
          detail:
            "Everything in the conversation shares one window; when it fills, the earliest material stops pulling its weight.",
        },
        {
          title: "Don't dump everything in",
          detail:
            "Pasting the whole folder makes the important part harder to find, for it as much as for you.",
        },
        {
          title: "When to start fresh",
          detail:
            "The signs a thread is spent — repetition, forgotten constraints, drift — and the two-minute restart that fixes it.",
        },
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
      detail:
        "Confidence is a writing style, not evidence. The same fluent, well-organised paragraph comes back whether the underlying claim is solid or invented, which is exactly why a wrong answer slips past — nothing in its tone marks it.\n\n" +
        "Two habits carry this stage. Ask without loading the question: \"is this a good idea?\" invites agreement, \"what's wrong with this?\" invites work. And verify by consequence, not by paranoia — check the claims a wrong answer would actually cost you something for, and let the rest go. Verification that's too expensive doesn't get done, which is the same as not verifying at all.",
      proof:
        "Catch one confidently-wrong answer, verify it, and correct it with a non-leading follow-up.",
      proofBrief:
        "Go looking in territory where it's weakest — specific numbers, recent events, niche APIs, anything with an exact citation — until you get an answer that's confidently wrong. Verify it against a real source, then correct it with a follow-up that doesn't tell it the answer.\n\n" +
        "The follow-up is the part that matters. \"That's wrong, it's actually X\" teaches you nothing about catching the next one; \"what's your source for that figure?\" shows you how the mistake behaves under pressure.",
      proofSubmit:
        "Paste the wrong answer, the source you checked it against, your non-leading follow-up, and what it said next. Add one line on what tipped you off.",
      criteria: [
        "The wrong answer is quoted as it came, not paraphrased",
        "You checked it against a real source, and name that source",
        "The follow-up doesn't hand over the right answer",
        "You say what made you suspicious in the first place",
      ],
      day_from: 10,
      day_to: 11,
      hours_low: 4,
      hours_high: 5,
      goals: [
        {
          title: "It can be confidently wrong",
          detail:
            "Fluency and correctness are unrelated. The tone of an answer tells you nothing about whether it holds.",
        },
        {
          title: "Leading questions get leading answers",
          detail:
            "\"Is this a good idea?\" invites agreement. \"What's wrong with this?\" invites work.",
        },
        {
          title: "Check what actually matters",
          detail:
            "Verify by consequence: the claims that would cost you if they were wrong, not every sentence.",
        },
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
      detail:
        "Everything above, on one task, in order. Route it, connect it, prompt it properly, keep the thread clean, verify the result — then actually use the thing. The five stages were separated so they could be learned; this is what they look like when they run together.\n\n" +
        "Pick a task with a real consequence. Something you'd have had to do anyway this fortnight, where a bad result costs you an afternoon. A demo task rehearses the motions and teaches you nothing about whether you trust the output, and trust is the whole point of the program.",
      proof: "A real task completed end-to-end, and trusted.",
      proofBrief:
        "Run one real task from start to finish: the routing call and its reason, the data connected rather than described, a prompt built out of the techniques, context managed as you go, and a verification pass before you rely on it. Then put the result to use.\n\n" +
        "Write it up as a walkthrough, not a summary. Where it went wrong and what you did about it is the most useful part — nobody's first pass is clean, and a write-up with no correction in it usually means the task was too easy to prove anything.",
      proofSubmit:
        "Hand in the walkthrough: the task, the routing and why, what you connected, the final prompt, where you restarted or changed course, how you verified the result, and where the finished thing ended up. Attach the output if it's a file.",
      criteria: [
        "The task is real, with a consequence if the result is wrong",
        "Surface, model and effort are named, with the reason for each",
        "Claude worked against connected data, not a pasted description",
        "The final prompt is included and uses six or more techniques",
        "You show one verification you ran, and what it found",
        "The result was actually used — you say where it went",
      ],
      day_from: 12,
      day_to: 14,
      hours_low: 5,
      hours_high: 6,
      goals: [
        {
          title: "Pick a real task that actually matters to you",
          detail:
            "Something you'd have to do this fortnight anyway, where a bad result costs you an afternoon.",
        },
        {
          title: "Choose the right surface + model + effort (and say why)",
          detail: "The Landscape decision, made once and written down before you start.",
        },
        {
          title: "Connect Claude to the actual data — not pasted descriptions",
          detail:
            "Whatever the task reads from, it reads directly. No summarising on the way in.",
        },
        {
          title: "Prompt it with 6+ of the 18 techniques",
          detail:
            "Framing and specification at minimum; add structure if the task has parts.",
        },
        {
          title: "Manage context — start fresh if the thread bloats",
          detail:
            "Watch for the drift, and hand off to a clean thread rather than pushing through it.",
        },
        {
          title: "Verify the result before you rely on it",
          detail:
            "One check on the claim that would hurt most if it were wrong. Cheap enough that you actually run it.",
        },
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
      detail:
        "Level 1 picked a surface per task. This picks by task shape: conversational, file-shaped, or repo-shaped, which is a rule you can apply without thinking about it a second time. Model × effort becomes a matrix rather than a preference — cost on one axis, reasoning depth on the other, and most work sits in the cheap corner once you've noticed which corner it's in.\n\n" +
        "Token metering is the unglamorous half. Knowing what actually drains a plan — long threads, re-pasted files, high effort on trivia — is what lets you spend on the tasks that deserve it. Then you write it all down as a skill: your routing rule, encoded once, applied by default.",
      proof:
        "Author one working Skill and a model × effort routing rule you'll actually reuse.",
      proofBrief:
        "Write one skill that does a job you actually repeat, and one routing rule that decides model and effort by task shape. Both have to survive contact with real work, so use them on at least two different tasks before handing in.\n\n" +
        "A skill that only fires on the example you wrote it for is a prompt with extra steps. The parameterised part — the bit that changes between runs — is what makes it a skill.",
      proofSubmit:
        "Paste the skill (or attach the file) and the routing rule as you wrote it down, plus the two tasks you used them on and what came back.",
      criteria: [
        "The skill covers a job you genuinely repeat, not a demo",
        "It's parameterised — the varying part is an input, not hardcoded",
        "The routing rule decides model AND effort from task shape",
        "Both were used on two different real tasks, with results shown",
      ],
      day_from: 1,
      day_to: 2,
      hours_low: 4,
      hours_high: 5,
      goals: [
        {
          title: "Choosing surface by task shape",
          detail:
            "Conversational, file-shaped, repo-shaped — a rule you apply without re-deciding every time.",
        },
        {
          title: "Model × effort as a cost/intelligence matrix",
          detail:
            "Two axes, four corners. Most work sits in the cheap one once you can see which corner it's in.",
        },
        {
          title: "Token metering — what actually drains a plan",
          detail:
            "Long threads, re-pasted files, high effort on trivia. Knowing the drains is what funds the tasks worth spending on.",
        },
        {
          title: "Authoring your own skills · plugins",
          detail:
            "Turning a working prompt into a reusable, parameterised instruction — and knowing when a plugin is the better home for it.",
        },
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
      detail:
        "An agent is a loop: read the state, pick a tool, run it, look at what came back, decide again. Everything that makes agents useful and everything that makes them dangerous is in that loop — it keeps going without you, and each turn can touch something real.\n\n" +
        "So the engineering is mostly about limits. What is this allowed to reach, what must it stop and ask about, and how much damage can one bad turn do before anyone notices. Blast radius is the question to ask first, not last.\n\n" +
        "Prompt injection is where those limits get tested by someone else's text. Anything your agent reads — a web page, an issue, an email — is untrusted input that may contain instructions, and an agent that can't tell content from commands will follow both.",
      proof:
        "Stand up one connector/agent with a permission gate, and name its prompt-injection risk.",
      proofBrief:
        "Stand up one agent or connector that does something real, with an explicit permission gate: one action it may not take without asking you. Then write its injection risk down — the specific untrusted text it reads, and what an attacker could get it to do through that text.\n\n" +
        "\"It might get prompt injected\" isn't an answer. Name the input, name the action, and say what your gate does about it.",
      proofSubmit:
        "Describe what you stood up and paste its configuration or key prompt. Then the gate: which action needs approval and how it's enforced. Then the injection path, in one paragraph: input → what an attacker writes → what it would try to make the agent do → what stops it.",
      criteria: [
        "The agent or connector runs and does something real",
        "One named action is gated on your approval, not on good intentions",
        "The injection path is specific: a named input and a named action",
        "You state the blast radius — the worst one bad turn could do",
      ],
      day_from: 3,
      day_to: 5,
      hours_low: 6,
      hours_high: 7,
      goals: [
        {
          title: "Protocol vs connector packaging · skills vs MCP vs plugins",
          detail:
            "Which of these is a protocol, which is packaging, and which one you reach for when you want a tool available everywhere.",
        },
        {
          title: "Anatomy of an agent loop",
          detail:
            "Read state, pick a tool, run it, read the result, decide again. Everything useful and everything dangerous lives in that loop.",
        },
        {
          title:
            "Agent engineering — scoping, permissions, verification gates, blast radius",
          detail:
            "What it may reach, what it must ask about, and how much one bad turn can break before anyone notices.",
        },
        {
          title: "Prompt injection",
          detail:
            "Anything it reads is untrusted input that may contain instructions. An agent that can't tell content from commands follows both.",
        },
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
      detail:
        "Level 1's prompting made one answer better. This makes the next hundred answers the same. The shift is from request to spec: a prompt that states inputs, output shape and the conditions for correctness is something you can test, and a prompt you can test is something you can improve without guessing.\n\n" +
        "That's what the eval set is for. Five cases that define \"correct\" for your job — including the awkward ones — turn \"it seems better\" into a number that moves. Structured output makes the checking mechanical, and versioning means an improvement can't silently break the case you fixed last week.",
      proof: "Write a prompt-as-spec + a 5-case eval; run it 3× and show the output holds.",
      proofBrief:
        "Take a job you do repeatedly and write it as a spec: inputs named, output shape declared, correctness stated. Then build a five-case eval set — and make at least two of the cases awkward, because a set of easy cases only proves the prompt handles easy cases.\n\n" +
        "Run all five, three times over. Note what varied between runs. Something usually does; the interesting part of this stage is what you change in the spec to make it stop.",
      proofSubmit:
        "Paste the spec-prompt and the five cases with their expected output. Then the results table — 5 cases × 3 runs — and one line on anything that varied and what you changed about it.",
      criteria: [
        "The prompt reads as a spec: named inputs, declared output shape, stated correctness",
        "Five cases, at least two of them awkward or edge-shaped",
        "Every case ran three times, and the results are shown",
        "Variation between runs is either explained or fixed, and you say which",
      ],
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
          detail:
            "Inputs named, output shape declared, correctness stated — then parameterised, so the same spec runs on next week's inputs.",
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
          detail:
            "A schema turns checking into something a machine can do, which is the difference between testing every run and testing the first one.",
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
          detail:
            "What belongs in the standing instructions versus this one message — and how a tool description decides whether the tool gets used well.",
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
          detail:
            "Cases that define correct, kept as a set, run again after every change — so \"improved\" stops being an opinion.",
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
      detail:
        "Context is a budget you allocate, not a box you fill. Retrieval beats pasting everything because it puts the relevant part in front of the model instead of burying it in the irrelevant nine tenths. Caching pays for the parts that repeat. Persistent context — a project, a memory, a CLAUDE.md — holds the things that are true every time, so they stop costing a paragraph per conversation.\n\n" +
        "Subagents are the structural move: give the messy exploratory work its own fresh window and let it report back a conclusion, so your main thread stays clean. Restart discipline is the same instinct applied by hand.",
      proof: "Re-architect one bloated task with retrieval + caching + a subagent.",
      proofBrief:
        "Find a task of yours that's outgrown its thread — the one where you paste a wall of material every time, or where the conversation gets vague halfway through. Re-architect it with all three: retrieval instead of paste-everything, caching on whatever repeats, and a subagent for the part that makes the mess.\n\n" +
        "Measure something. Tokens, wall-clock time, number of turns to a good answer — any before-and-after number that isn't a feeling.",
      proofSubmit:
        "Describe the before and after architecture, and include the number you measured on both sides. Say which of the three changes did most of the work.",
      criteria: [
        "The starting task is a real one that was genuinely bloated",
        "All three appear: retrieval, caching, and a subagent with its own window",
        "A before/after number is given — tokens, turns, or time",
        "You say which change carried the improvement, and which barely mattered",
      ],
      day_from: 9,
      day_to: 10,
      hours_low: 4,
      hours_high: 5,
      goals: [
        {
          title: "Allocating the budget · retrieval over paste-everything",
          detail:
            "Put the relevant part in front of the model instead of burying it in the irrelevant nine tenths.",
        },
        {
          title: "Caching · persistent context (projects, memory, CLAUDE.md)",
          detail:
            "The things that are true every time belong somewhere durable, not re-explained per conversation.",
        },
        {
          title: "Subagents & fresh context · restart discipline",
          detail:
            "Hand the messy exploration its own window and take back the conclusion, so the main thread stays clean.",
        },
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
      detail:
        "Failures aren't evenly spread. They cluster: exact figures, recent events, obscure APIs, anything with a citation attached. Knowing the clusters tells you where to spend your checking, which is the only kind of verification that survives a busy week.\n\n" +
        "Two of the four failures here aren't the model's. Anchoring is it defending its own earlier answer instead of reconsidering; automation bias is you waving through a fluent paragraph because the last twenty were fine. The second one is the expensive failure, and the only fix is a gate that runs whether or not you're feeling careful.\n\n" +
        "Cheap is the operative word. A check that takes thirty seconds gets run every time; one that takes twenty minutes gets skipped exactly when you're busiest, which is when the mistakes happen.",
      proof: "Add a cheap verification gate to one workflow and show it catching a real error.",
      proofBrief:
        "Pick a workflow you already run and add one verification gate to it — cheap enough that you'd never skip it. A schema check, a second pass with a different framing, a lookup against the source of truth, a rule that refuses an answer missing its citation.\n\n" +
        "Then run it until it catches something real. A gate that has never fired is a gate you're hoping about; the hand-in is the catch, not the design.",
      proofSubmit:
        "Describe the workflow, the gate and what it costs to run. Then paste the real error it caught — the bad output, what the gate did, and what would have happened downstream if it hadn't.",
      criteria: [
        "The workflow is one you actually run, not a demonstration",
        "The gate's cost is stated, and it's small enough to run every time",
        "It caught a real error, quoted as it happened",
        "You say what the error would have cost if it had gone through",
      ],
      day_from: 11,
      day_to: 12,
      hours_low: 4,
      hours_high: 5,
      goals: [
        {
          title: "Where hallucination clusters · calibration",
          detail:
            "Exact figures, recent events, obscure APIs, anything with a citation. Spend your checking where the failures live.",
        },
        {
          title: "Anchoring on its own earlier output",
          detail:
            "Once it has committed to an answer it will defend it. A fresh window asks the question without the baggage.",
        },
        {
          title: "Automation bias in the human",
          detail:
            "Twenty good answers in a row is exactly what makes the twenty-first go through unread. This one is your failure, not its.",
        },
        {
          title: "Designing verification cheap enough to actually do",
          detail:
            "Thirty seconds gets run every time. Twenty minutes gets skipped in the week you most needed it.",
        },
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
      detail:
        "Everything above, assembled into one thing you'll keep using: a skill, a template or an agent, parameterised, evaluated, gated and versioned. The demo version of this is easy and worth nothing. The difference is the eval — five cases, run again after every change, passing on inputs the system hasn't seen.\n\n" +
        "Pick a job you genuinely repeat: the weekly report, the triage pass, the review checklist. If you can't name when you'll run it next, it isn't a system, it's an exercise — and it will rot before you find out whether it worked.",
      proof: "A reusable system shipped, with an eval proving it works twice.",
      proofBrief:
        "Ship one reusable system for a job you actually repeat. It has to be parameterised, carry a five-case eval that defines correct, pass that eval on two separate runs with different inputs, include one cheap verification gate, and be versioned so the next improvement can't silently break it.\n\n" +
        "\"Works twice\" is literal. One clean run is a demo; the second run, on inputs you didn't design it around, is the claim this whole level is about.",
      proofSubmit:
        "Attach or paste the system itself, the five eval cases, and the results of both runs side by side. Then: what the verification gate checks, and how you version it.",
      criteria: [
        "The job is one you repeat, and you can say when it runs next",
        "The system is parameterised — inputs vary, the system doesn't",
        "Five eval cases define correct, and they're written down",
        "Two runs on different inputs both pass, with results shown",
        "One cheap verification gate is in place, and you say what it checks",
        "Versioning is real: you can point at what would change and what wouldn't",
      ],
      day_from: 13,
      day_to: 14,
      hours_low: 5,
      hours_high: 6,
      goals: [
        {
          title: "Pick a repeatable job you actually do",
          detail:
            "The weekly report, the triage pass, the review checklist. If you can't say when it runs next, pick another.",
        },
        {
          title: "Build it as a skill, template, or agent (parameterized)",
          detail:
            "The varying part is an input. Anything hardcoded is a thing you'll be editing by hand forever.",
        },
        {
          title: 'Write a 5-case eval set that defines "correct"',
          detail:
            "Including the awkward cases. Five easy ones only prove it handles easy ones.",
        },
        {
          title: "Run it 3× — same inputs, same quality",
          detail:
            "Variation between identical runs is a spec problem. Find it now, not in the week you rely on it.",
        },
        {
          title: "Add one cheap verification gate",
          detail:
            "Small enough to run on every invocation, aimed at the failure you'd least like to ship.",
        },
        {
          title: "Version it so you can improve without breaking it",
          detail:
            "The eval is what makes versioning meaningful: change, re-run, see what moved.",
        },
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
      detail: stage.detail ?? null,
      proof: stage.proof ?? null,
      proof_brief: stage.proofBrief ?? null,
      proof_submit: stage.proofSubmit ?? null,
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
    detail: string | null;
    is_proof: boolean;
    sort_order: number;
  }[] = [];
  let order = 0;
  for (const stage of program.stages) {
    const stageId = stageIds.get(stage.title);
    if (!stageId) continue;
    for (const entry of stage.goals) {
      const goal = asGoal(entry);
      goalRows.push({
        sprint_id: sprintId,
        stage_id: stageId,
        title: goal.title,
        detail: goal.detail ?? null,
        is_proof: false,
        sort_order: order++,
      });
    }
    if (stage.proofGoal) {
      goalRows.push({
        sprint_id: sprintId,
        stage_id: stageId,
        title: stage.proofGoal,
        // The brief lives on the stage (proof_brief / criteria), so the proof
        // goal itself stays a bare line — two places for the same paragraph is
        // one place too many.
        detail: null,
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

  // Acceptance criteria: replaced wholesale per stage. Like practices, they
  // carry no per-person state — nobody ticks them — so there's nothing for
  // `reconcile` to protect, and matching them by title would break the moment
  // two stages phrased a condition the same way.
  const stageIdList = [...stageIds.values()];
  if (stageIdList.length > 0) {
    const { error: wipe } = await supabase
      .from("sprint_proof_criteria")
      .delete()
      .in("stage_id", stageIdList);
    if (wipe) throw new Error(`Clearing criteria for "${program.title}": ${wipe.message}`);
  }

  const criteriaRows = program.stages.flatMap((stage) => {
    const stageId = stageIds.get(stage.title);
    if (!stageId) return [];
    return (stage.criteria ?? []).map((body, index) => ({
      stage_id: stageId,
      body,
      sort_order: index,
    }));
  });
  if (criteriaRows.length > 0) {
    const { error } = await supabase.from("sprint_proof_criteria").insert(criteriaRows);
    if (error) throw new Error(`Criteria for "${program.title}": ${error.message}`);
  }

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
    criteria: criteriaRows.length,
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
        `${result.practices} practice blocks, ${result.criteria} proof conditions ` +
        `(${result.id})`
    );
  }
  console.log(`\nBoth programs start ${startsOn} and are open to join.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
