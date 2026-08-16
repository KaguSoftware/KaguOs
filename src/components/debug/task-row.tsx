"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	ChevronDown,
	Copy,
	Hand,
	ListPlus,
	Loader2,
	MessagesSquare,
	Pencil,
	SearchCheck,
	Sparkles,
	Trash2,
	Undo2,
	Wrench,
} from "lucide-react";
import {
	claimTask,
	deleteTask,
	logAuditFindings,
	setTaskState,
	unclaimTask,
	updateTask,
} from "@/lib/actions/debug";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { downloadTaskImages, taskToText } from "@/lib/debug-export";
import { createClient } from "@/lib/supabase/client";
import { TaskImages } from "@/components/debug/task-images";
import { TaskNotes } from "@/components/debug/task-notes";
import { addDays, cn, formatDate, todayInIstanbul } from "@/lib/utils";
import type {
	DebugKind,
	DebugPriority,
	DebugState,
	DebugTask,
	DebugTaskImage,
	DebugTaskNote,
	MembersMap,
} from "@/lib/types";

const PRIORITY_OPTIONS = [
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
	{ value: "urgent", label: "Urgent" },
];

const KIND_OPTIONS = [
	{ value: "fix", label: "Fix", hint: "Something's broken" },
	{ value: "feature", label: "Feature", hint: "Something new to build" },
	{ value: "audit", label: "Audit", hint: "Go find what needs fixing" },
];

const KIND_LABEL: Record<DebugKind, string> = {
	fix: "fix",
	feature: "feature",
	audit: "audit",
};

const KIND_ICON: Record<DebugKind, typeof Wrench> = {
	fix: Wrench,
	feature: Sparkles,
	audit: SearchCheck,
};

/**
 * The kind marker: a tinted icon at the head of the row, where the eye starts.
 *
 * Kind and priority swapped places (2026-07-19, Parsa). Priority is a SCALE —
 * low→urgent — and scales read as words; a colour dot makes you remember what
 * four hues mean in order, which nobody does. Kind is a CATEGORY of three, it
 * never changes, and it already has three distinct icons, so it survives being
 * compressed to a mark in a way priority doesn't.
 *
 * The tints deliberately avoid green/amber/red: those three ARE the state
 * vocabulary on this board (done / in progress / urgent), and a "feature" chip
 * in state-green sitting inches from the green Done button would mean something
 * unrelated in the same colour. Slate, blue and violet are outside that
 * vocabulary, so they read as "a different axis" rather than as state.
 */
const KIND_STYLE: Record<DebugKind, string> = {
	fix: "bg-line-strong/40 text-muted",
	feature: "bg-info/10 text-info",
	audit: "bg-[oklch(0.72_0.10_300)]/10 text-[oklch(0.72_0.10_300)]",
};

function KindMark({ kind }: { kind: DebugKind }) {
	const Icon = KIND_ICON[kind];
	return (
		<span
			className={cn(
				"grid size-5 shrink-0 place-items-center rounded-md",
				KIND_STYLE[kind],
			)}
			title={KIND_LABEL[kind]}
		>
			<Icon className="size-3" aria-hidden />
			<span className="sr-only">{KIND_LABEL[kind]}</span>
		</span>
	);
}

const PRIORITY_TONE: Record<DebugPriority, BadgeTone> = {
	low: "faint",
	medium: "neutral",
	high: "amber",
	urgent: "danger",
};

/** Deadlines only earn a chip when they're close enough to act on. */
const DUE_SOON_DAYS = 7;

/**
 * Height of every control in the detail drawer's action bar.
 *
 * `size="sm"` is 28px: right under a mouse, too small under a thumb — and this
 * row of buttons sits directly below the note composer, where a miss costs you
 * a deleted task. 36px on touch widths, back to the compact 28px from `md` up
 * where the pointer is precise and vertical space is the scarcer resource.
 */
const ACTION_HEIGHT = "h-9 md:h-7";

/**
 * One band of the detail drawer. Every section of an opened task gets the same
 * padding and the same 1px rule above it, which is the whole reason the drawer
 * reads as one surface instead of a pile of blocks.
 */
const BAND = "border-t border-line px-4 py-3 sm:py-3.5";

const STATE_LABEL: Record<DebugState, string> = {
	open: "Open",
	in_progress: "In progress",
	done: "Done",
};

export function TaskRow({
	task,
	cursored,
	members,
	meId,
	isAdmin,
	canMessage,
	projects,
	suggestOptions,
	projectName,
	foundCount,
	foundByTitle,
	images,
	onImagesChange,
	notes,
	highlight,
	selectable,
	selected,
	onToggleSelect,
	onPatch,
	onRemove,
	onRestore,
}: {
	task: DebugTask;
	/** The keyboard cursor is on this row — mark it and scroll it into view. */
	cursored?: boolean;
	members: MembersMap;
	meId: string;
	isAdmin: boolean;
	/** The viewer can open /messages (work section, not showcase). */
	canMessage: boolean;
	projects: { id: string; name: string }[];
	/** Work members to "suggest for". Empty outside the work team. */
	suggestOptions: { value: string; label: string }[];
	projectName?: string | null;
	/** How many tasks this audit turned up. 0 for non-audits. */
	foundCount: number;
	/** Title of the audit that found this task, when it came from one. */
	foundByTitle?: string | null;
	/** Screenshots attached to this task. */
	images: DebugTaskImage[];
	onImagesChange: (next: DebugTaskImage[]) => void;
	/** The task's notes thread, oldest first. Streams from the board's channel. */
	notes: DebugTaskNote[];
	/** Part of the brainstorm session trail — tinted until the trail is cleared. */
	highlight?: boolean;
	/** In batch-select mode: show a leading checkbox. */
	selectable?: boolean;
	selected?: boolean;
	onToggleSelect?: (id: string) => void;
	onPatch: (id: string, patch: Partial<DebugTask>) => void;
	onRemove: (id: string) => void;
	onRestore: (task: DebugTask) => void;
}) {
	const { pending, run } = useAction();
	const { success: toastSuccess, error: toastError } = useToast();
	const router = useRouter();
	const rowRef = useRef<HTMLLIElement>(null);
	const [expanded, setExpanded] = useState(false);

	/**
	 * Opening a row near the bottom of the list used to leave its panel below the
	 * fold, so every control inside it cost a scroll (Parsa, 2026-07-19). Pull the
	 * row into view as it opens — after paint, so the panel has already been laid
	 * out and the browser scrolls to its real height.
	 */
	function toggleExpanded() {
		setExpanded((wasOpen) => {
			if (!wasOpen) {
				requestAnimationFrame(() => {
					const el = rowRef.current;
					if (!el) return;
					// Only scroll if the row now overflows the viewport — a row already
					// fully visible shouldn't jump under the user.
					const rect = el.getBoundingClientRect();
					if (rect.bottom > window.innerHeight) {
						el.scrollIntoView({ block: "end", behavior: "smooth" });
					}
				});
			}
			return !wasOpen;
		});
	}
	// Keep the keyboard cursor on screen as j/k walks past the fold. `nearest`
	// (not `center`) so a row already in view doesn't jump under the reader —
	// the same restraint the expand-scroll above shows.
	useEffect(() => {
		if (!cursored) return;
		rowRef.current?.scrollIntoView({ block: "nearest" });
	}, [cursored]);

	const [editing, setEditing] = useState(false);
	// Audit only: the "what I found" composer, one finding per line.
	const [filing, setFiling] = useState(false);
	const [findings, setFindings] = useState("");
	const [draft, setDraft] = useState({
		title: task.title,
		description: task.description ?? "",
		priority: task.priority as DebugPriority,
		kind: task.kind as DebugKind,
		due_on: task.due_on ?? "",
		project_id: task.project_id ?? "",
		suggested_for: task.suggested_for ?? "",
	});

	const mine = task.assignee_id === meId;
	const canDelete = isAdmin || task.created_by === meId;

	// The task's author, when a DM with them can actually happen: the viewer can
	// open Messages (canMessage), the author isn't the viewer (messaging
	// yourself is a 404 over there), and the author still holds work access —
	// a former member's thread is read-only, so the button would open a dead
	// end. suggestOptions doubles as the current work roster.
	const author =
		canMessage &&
		task.created_by &&
		task.created_by !== meId &&
		suggestOptions.some((o) => o.value === task.created_by)
			? (members[task.created_by] ?? null)
			: null;

	/**
	 * Jump to a DM with whoever filed this task, question already teed up: the
	 * task is pinned as a CARD on the composer (stored under the thread's
	 * `:task` draft key, which the composer seeds from on mount), so the sent
	 * message carries a live task preview — title, kind, priority, state,
	 * clickable back to the board — instead of the old pasted `> title — link`
	 * line. Any half-typed words in the text draft are untouched.
	 */
	function messageAuthor() {
		if (!task.created_by) return;
		try {
			window.localStorage.setItem(
				`kagu:draft:${task.created_by}:task`,
				JSON.stringify({
					id: task.id,
					title: task.title,
					state: task.state,
					priority: task.priority,
					kind: task.kind,
				}),
			);
		} catch {
			// Storage unavailable — the chat still opens, just without the card.
		}
		router.push(`/messages/${task.created_by}`);
	}

	// A deadline is "overdue" only while the task is still open. Compared as
	// plain YYYY-MM-DD strings, both sides date-only, so no time-of-day math.
	// Istanbul rather than the device: two people looking at the same board must
	// agree on whether a task is late.
	const today = todayInIstanbul();
	const overdue =
		task.due_on != null && task.state !== "done" && task.due_on < today;
	// A deadline three months out is data, not a signal — it belongs in the
	// expanded row, not as a chip competing with the ones that need attention.
	// Overdue always shows; everything else shows once it's within the window.
	const dueSoon =
		task.due_on != null &&
		task.state !== "done" &&
		task.due_on >= today &&
		task.due_on <= addDays(today, DUE_SOON_DAYS);
	const showDue = overdue || dueSoon;
	// Show the suggestion only while nobody has claimed it — once claimed, the
	// assignee is the truth and the nudge is noise.
	const suggested =
		task.suggested_for && !task.assignee_id
			? members[task.suggested_for]
			: null;

	const findingLines = findings
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);

	/**
	 * File the audit's findings as real tasks. Deliberately does NOT mark the
	 * audit done — finding things and deciding the sweep is over are two calls,
	 * and an audit often files a batch, keeps looking, files more.
	 */
	function fileFindings() {
		const lines = findingLines;
		if (lines.length === 0) return;
		// ⚠️ The toast repeats the SERVER's message rather than asserting
		// `lines.length` — the batch is capped, and a hardcoded count would claim
		// all 60 findings were filed when only 50 were. Report what happened.
		run(
			async () => {
				const res = await logAuditFindings(task.id, lines);
				if (!res.ok) return res;
				toastSuccess(res.message);
				return { ok: true, message: res.message };
			},
			{
				onSuccess: () => {
					setFindings("");
					setFiling(false);
				},
			},
		);
	}

	/**
	 * Plain-text snapshot for pasting into a chat, a commit message, or Claude
	 * Code. Any screenshots are downloaded alongside, and the text names the
	 * files — a terminal can't take a pasted image or fetch a private URL, so a
	 * local path is the only form it can act on.
	 */
	function copyTask() {
		const text = taskToText(task, { members, projects, images });
		// Clipboard FIRST, still inside the click's gesture window — awaiting the
		// image fetches before this would get the write rejected in Safari.
		navigator.clipboard.writeText(text).then(
			async () => {
				if (images.length === 0) {
					toastSuccess("Task copied.");
					return;
				}
				const supabase = createClient();
				const saved = await downloadTaskImages(
					[task],
					{ [task.id]: images },
					async (paths) => {
						// ⚠️ NO `transform` here, unlike the thumbnails in TaskImages.
						// These bytes land in someone's Downloads as the record of a bug —
						// handing them a downscaled copy loses the evidence they were
						// saving. Display can be cheap; an export cannot.
						const { data } = await supabase.storage
							.from("debug")
							.createSignedUrls(paths, 60 * 5);
						return (data ?? []).map((d) => d.signedUrl ?? null);
					},
				);
				toastSuccess(
					saved > 0
						? `Copied — ${saved} image${saved === 1 ? "" : "s"} saved to Downloads.`
						: "Task copied, but the images couldn't be downloaded.",
				);
			},
			() => toastError("Couldn't copy — clipboard blocked."),
		);
	}

	function saveEdit() {
		// ONE normalized object drives both the optimistic row and the server call.
		// Sending the raw draft while rendering a trimmed patch made the two
		// disagree: a whitespace-only title showed the old title optimistically and
		// was then rejected server-side ("A task needs a title").
		const fields = {
			title: draft.title.trim() || task.title,
			description: draft.description.trim(),
			priority: draft.priority,
			kind: draft.kind,
			due_on: draft.due_on || null,
			project_id: draft.project_id || null,
			suggested_for: draft.suggested_for || null,
		};
		const before = { ...task };
		run(() => updateTask(task.id, fields), {
			optimistic: () => {
				// The row mirrors what the server will actually store: an emptied
				// description becomes null there, so it must here too.
				onPatch(task.id, {
					...fields,
					description: fields.description || null,
				});
				setEditing(false);
			},
			rollback: () => onRestore(before),
			success: "Task updated.",
		});
	}

	/** Optimistic: apply the patch immediately, revert (and toast) if rejected. */
	function patchTask(
		fn: () => Promise<{ ok: boolean; message: string } | null>,
		patch?: Partial<DebugTask>,
	) {
		const before = { ...task };
		run(fn, {
			optimistic: patch ? () => onPatch(task.id, patch) : undefined,
			rollback: patch ? () => onRestore(before) : undefined,
		});
	}

	/**
	 * The look of one state segment, shared by the row control (desktop) and the
	 * drawer control (phone) so the two can never drift apart.
	 *
	 * Locked while nobody holds the task: state is "how far along is the person
	 * on it", and with no person there is nothing to report. The current state
	 * still shows its tint (it's a fact); the other two go dead until someone
	 * claims. Same rule as the keyboard 1/2/3, the bulk dropdown, and the server
	 * action.
	 */
	function stateSegmentClass(state: DebugState) {
		if (task.state === state) {
			return state === "done"
				? "bg-primary/15 text-primary-dim"
				: state === "in_progress"
					? "bg-amber/15 text-amber"
					: "bg-raised text-ink";
		}
		return task.assignee_id
			? "text-faint hover:bg-raised hover:text-muted"
			: "cursor-not-allowed text-faint opacity-40";
	}

	// Why, not just "no" — a dead control with no reason reads as broken.
	const stateLockReason = task.assignee_id
		? undefined
		: "Claim the task first — state tracks whoever holds it.";

	// TaskNotes renders nothing when there's no thread and no right to start one.
	// Ask the same question before framing a band around it, or an archived task
	// with no notes shows an empty bordered strip.
	const showNotes = notes.length > 0 || !task.archived_at;

	// Done rows recede via the title's own colour + strikethrough, NOT a blanket
	// opacity. `opacity-60` multiplied against text that is already `muted`/
	// `faint` pushed the meta line under 3:1 — the row read as disabled rather
	// than finished.
	return (
		<li
			ref={rowRef}
			// scroll-mb keeps a gap under the row when it scrolls itself into view,
			// so an opened panel never sits flush against the window edge.
			className={cn(
				"scroll-mb-6 px-4 py-3 transition-colors duration-150",
				// Nothing used to say a row could be opened. Under a pointer, the row
				// lighting up on approach IS that signal — cheaper than a permanent
				// chevron in a list this dense. Touch gets the chevron instead, below,
				// because there is no hover to hint with.
				"md:hover:bg-raised/40",
				highlight && "bg-primary/5",
				// The keyboard cursor. An inset ring rather than an outline so it can't
				// be clipped by the list's own overflow, and it reads as "this row is
				// focused" without competing with the state colours on the row itself.
				cursored &&
					"bg-raised/60 ring-1 ring-inset ring-primary-dim/60",
			)}
		>
			{/* A grid, not a flex-wrap. Four columns that always mean the same thing:
          title (elastic) · badges · state · assignee. The old single wrapping
          row reflowed unpredictably below ~1100px — the state control would drop
          under the title and the badges would orphan. Here the collapse is
          declared instead.

          ⚠️ ON A PHONE THIS IS ONE COLUMN, not two. It used to be
          `grid-cols-[minmax(0,1fr)_auto]`, which sounds harmless but isn't: the
          state switcher ("Open · In progress · Done") is intrinsically ~200px,
          so `auto` claimed half of a 390px screen and the title was squeezed
          into the rest — "remember the order of task that user selected" wrapped
          to FOUR lines beside a column of empty space. Single column below `md`
          means the title gets the whole width. */}
			<div
				className={cn(
					"grid items-center gap-x-3 gap-y-2",
					"grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]",
					selectable &&
						"grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]",
				)}
			>
				{selectable && (
					<Checkbox
						checked={selected ?? false}
						onChange={() => onToggleSelect?.(task.id)}
						aria-label={`Select ${task.title}`}
					/>
				)}
				<button
					type="button"
					onClick={toggleExpanded}
					className="flex w-full min-w-0 items-start gap-2 text-left"
					aria-expanded={expanded}
				>
					{/* Kind leads the row — see KindMark. */}
					<KindMark kind={task.kind} />
					<span className="min-w-0 flex-1">
						{/* A long title used to `truncate` to ONE line, and the elastic column
              is narrow (badges, state and assignee take the rest), so most of
              the title was simply unreadable with no way to recover it. Two
              lines when collapsed — enough for any real title — and the full
              thing once the row is expanded. `title` gives the hover tooltip. */}
						<span
							title={task.title}
							className={cn(
								"block text-sm font-medium",
								expanded ? "break-words" : "line-clamp-2",
								task.state === "done"
									? "text-muted line-through decoration-faint"
									: "text-ink",
							)}
						>
							{task.title}
						</span>
						{/* On a COLLAPSED phone row the state switcher and the claim button
              aren't on screen, so the two facts they carry — what state this is
              in and who holds it — are restated here as plain words. Once the
              row opens, the drawer's first band carries the real controls a few
              pixels below, so this line retires rather than saying the same
              thing twice. `md:hidden` because from `md` up the controls are on
              the row itself at every moment. */}
						<span
							className={cn(
								"mt-0.5 truncate text-xs text-faint md:hidden",
								expanded ? "hidden" : "block",
							)}
						>
							<span
								className={cn(
									"font-medium",
									task.state === "done"
										? "text-primary-dim"
										: task.state === "in_progress"
											? "text-amber"
											: "text-muted",
								)}
							>
								{STATE_LABEL[task.state]}
							</span>
							{task.assignee_id ? (
								<>
									{" · "}
									<span
										style={{
											color: members[task.assignee_id]
												?.color,
										}}
									>
										{mine
											? "You"
											: (members[task.assignee_id]
													?.name ?? "Someone")}
									</span>
								</>
							) : (
								" · Unclaimed"
							)}
						</span>
						<span className="mt-0.5 block truncate text-xs text-faint">
							{formatDate(task.created_at)}
							{task.created_by && members[task.created_by] && (
								<>
									{" · by "}
									<span
										style={{
											color: members[task.created_by]
												.color,
										}}
									>
										{members[task.created_by].name}
									</span>
								</>
							)}
							{suggested && (
								<>
									{" · suggested for "}
									<span style={{ color: suggested.color }}>
										{suggested.name}
									</span>
								</>
							)}
							{foundByTitle && (
								<>
									{" · found by "}
									<span className="text-muted">
										{foundByTitle}
									</span>
								</>
							)}
						</span>
					</span>
					{/* Touch's disclosure signal. A phone has no hover, so without this
              nothing distinguishes a row that opens from a row that doesn't.
              `md:hidden` — the pointer gets the row-hover fill instead, and a
              permanent chevron in a list this dense would be clutter. */}
					<ChevronDown
						className={cn(
							"mt-0.5 size-4 shrink-0 text-faint transition-transform duration-150 ease-mac md:hidden",
							expanded && "rotate-180",
						)}
						aria-hidden
					/>
				</button>

				{/* Badges. Below `md` they take their own grid line under the title,
            spanning the full width, so they never squeeze the state control. */}
				<div className="col-span-full order-last flex flex-wrap items-center gap-1.5 md:order-0 md:col-span-1">
					{projectName && <Badge tone="info">{projectName}</Badge>}
					{showDue && (
						<Badge tone={overdue ? "danger" : "faint"}>
							{overdue ? "Overdue " : "Due "}
							{formatDate(task.due_on)}
						</Badge>
					)}
					{/* Priority stays a WORD. It's a four-step scale, and a scale that
              you have to decode from a colour is a scale nobody reads. */}
					<Badge tone={PRIORITY_TONE[task.priority]}>
						{task.priority}
					</Badge>
				</div>

				{/* One-click state switch — DESKTOP ONLY, present at every moment so a
            state can be flipped without opening anything.

            On a phone these last two columns don't exist. The row is a single
            narrow column there, and injecting a ~200px segmented control plus a
            claim button into it on expand shoved the detail down and turned the
            open row into a stack of unrelated fragments. Both controls live in
            the drawer's first band instead, where they get the full width and
            real tap targets. Same controls, placed where each screen has room. */}
				<div
					className="hidden overflow-hidden rounded-md border border-line md:flex"
					role="group"
					aria-label="State"
					title={stateLockReason}
				>
					{(Object.keys(STATE_LABEL) as DebugState[]).map((state) => (
						<button
							key={state}
							type="button"
							disabled={task.state === state || !task.assignee_id}
							onClick={() =>
								patchTask(() => setTaskState(task.id, state), {
									state,
								})
							}
							className={cn(
								"px-2 py-1 text-xs transition-colors duration-150",
								stateSegmentClass(state),
							)}
						>
							{STATE_LABEL[state]}
						</button>
					))}
				</div>

				{/* Assignee / claim. Fixed 10rem so the column aligns down the list.
            Desktop only, for the same reason as the state switch above. */}
				<div className="hidden items-center gap-1.5 md:flex md:w-40 md:justify-end">
					{pending && (
						<Loader2
							className="size-3.5 animate-spin text-faint"
							aria-hidden
						/>
					)}
					{task.assignee_id ? (
						<>
							<span
								style={{
									color: members[task.assignee_id]?.color,
								}}
								className="truncate text-[13px] font-medium"
							>
								{mine
									? "You"
									: (members[task.assignee_id]?.name ??
										"Someone")}
							</span>
							{(mine || isAdmin) && (
								<Button
									variant="ghost"
									size="sm"
									title="Unclaim"
									onClick={() =>
										patchTask(() => unclaimTask(task.id), {
											assignee_id: null,
										})
									}
								>
									<Undo2 className="size-3.5" aria-hidden />
								</Button>
							)}
						</>
					) : (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								patchTask(() => claimTask(task.id), {
									assignee_id: meId,
								})
							}
						>
							<Hand className="size-3.5" aria-hidden />
							Claim
						</Button>
					)}
				</div>
			</div>

			{/* THE DETAIL DRAWER.
          One surface holding everything an opened task contains, at every width.

          Before this it was three sibling blocks appended under the row with a
          bare `mt-2` and no boundary. On desktop a `justify-between` flex put
          the action cluster top-right level with the FIRST LINE of the
          description, so "Delete" sat beside "No details." while the note
          composer — starved inside a shrink-wrapped `min-w-0` column with no
          `flex-1` — collapsed to a 240px stub. On a phone the same markup, plus
          the state and claim controls injected into the row's grid, produced a
          vertical soup of fragments with no grouping at all.

          Note what this is NOT: a bordered, rounded panel. The list is already
          a card (`rounded-lg border bg-surface` around the `<ul>` in board.tsx),
          so a framed box in here would be a card inside a card. Instead the
          drawer BREAKS OUT of the row's `px-4 py-3` with negative margins, so
          its hairlines run edge to edge of that card and its bottom meets the
          `divide-y` rule to the next row. It reads as a well cut into the list.

          `bg-bg/60` recedes (--bg 0.10 sits under the card's --surface 0.15) and
          is translucent on purpose: the row's own `cursored` ring and the
          brainstorm `highlight` tint must still read across the opened row. */}
			{expanded && (
				<div className="-mx-4 -mb-3 mt-3 animate-page-in border-t border-line bg-bg/60">
					{/* Band 1 — the two controls that live on the row from `md` up.
              PHONE ONLY, and full width because there IS width to spend once
              the row has opened: three equal 36px segments instead of the 22px
              pills the row used to squeeze in. */}
					<div className="space-y-2.5 px-4 py-3 md:hidden">
						<div
							className="grid grid-cols-3 overflow-hidden rounded-md border border-line"
							role="group"
							aria-label="State"
							title={stateLockReason}
						>
							{(Object.keys(STATE_LABEL) as DebugState[]).map(
								(state, i) => (
									<button
										key={state}
										type="button"
										disabled={
											task.state === state ||
											!task.assignee_id
										}
										onClick={() =>
											patchTask(
												() =>
													setTaskState(
														task.id,
														state,
													),
												{ state },
											)
										}
										className={cn(
											"h-9 text-[13px] transition-colors duration-150",
											// Dividers on the segments themselves, so the three cells
											// stay exactly equal — a gap-separated flex would not.
											i > 0 && "border-l border-line",
											stateSegmentClass(state),
										)}
									>
										{STATE_LABEL[state]}
									</button>
								),
							)}
						</div>
						<div className="flex min-h-9 items-center justify-between gap-3">
							<span className="min-w-0 truncate text-[13px]">
								{task.assignee_id ? (
									<>
										<span className="text-faint">
											Held by{" "}
										</span>
										<span
											className="font-medium"
											style={{
												color: members[task.assignee_id]
													?.color,
											}}
										>
											{mine
												? "you"
												: (members[task.assignee_id]
														?.name ?? "someone")}
										</span>
									</>
								) : (
									<span className="text-faint">
										Nobody has claimed this
									</span>
								)}
							</span>
							{pending && (
								<Loader2
									className="size-3.5 shrink-0 animate-spin text-faint"
									aria-hidden
								/>
							)}
							{task.assignee_id ? (
								(mine || isAdmin) && (
									<Button
										variant="outline"
										size="sm"
										className="h-9 shrink-0"
										onClick={() =>
											patchTask(
												() => unclaimTask(task.id),
												{ assignee_id: null },
											)
										}
									>
										<Undo2
											className="size-3.5"
											aria-hidden
										/>
										{/* Named, not a bare glyph. The row can afford an icon-only
                        unclaim because it has a tooltip and a mouse; a phone
                        has neither. */}
										Unclaim
									</Button>
								)
							) : (
								<Button
									variant="outline"
									size="sm"
									className="h-9 shrink-0"
									onClick={() =>
										patchTask(() => claimTask(task.id), {
											assignee_id: meId,
										})
									}
								>
									<Hand className="size-3.5" aria-hidden />
									Claim
								</Button>
							)}
						</div>
					</div>

					{/* Band 2 — what the task SAYS. From `lg` up this is where the
              desktop's spare width finally does work: the description holds its
              70ch reading measure on the left and the screenshots take a column
              beside it, instead of a 620px paragraph with 400px of dead space
              to its right and the thumbnails pushed below. Stacked under `lg`. */}
					{!editing && (
						<div
							className={cn(
								BAND,
								"lg:grid lg:grid-cols-[minmax(0,70ch)_minmax(0,18rem)] lg:items-start lg:gap-6",
							)}
						>
							<p className="max-w-[70ch] whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
								{task.description || "No details."}
							</p>
							{/* Screenshots are part of what the task SAYS, not something you
                  do to it — so they belong here, never in the button cluster.
                  `lg:mt-0` because side by side, a top margin would drop the
                  first thumbnail below the description's first line. */}
							<TaskImages
								taskId={task.id}
								images={images}
								canEdit={!task.archived_at}
								onChange={onImagesChange}
								className="lg:mt-0"
							/>
						</div>
					)}

					{/* Band 3 — the thread, which IS the rest of the details: everything
              learned after the task was filed, each line with the person who
              wrote it. Its own band, so the composer reads as "add to the
              thread" rather than a stray box under a paragraph. */}
					{!editing && showNotes && (
						<div className={BAND}>
							<TaskNotes
								taskId={task.id}
								notes={notes}
								members={members}
								meId={meId}
								isAdmin={isAdmin}
								canEdit={!task.archived_at}
								className="mt-0"
							/>
						</div>
					)}

					{/* Band 4 — what you can do TO the task, last and on its own footing.
              The rule above it is the point: these are commands, not content,
              and they used to share a line with the description. */}
					{!editing && (
						<div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-2.5">
							{/* An audit's output IS a list of tasks — filing them is the way
                  this kind of work gets finished. */}
							{task.kind === "audit" && (
								<>
									<Button
										variant="outline"
										size="sm"
										className={ACTION_HEIGHT}
										onClick={() => setFiling((v) => !v)}
									>
										<ListPlus
											className="size-3.5"
											aria-hidden
										/>
										Log findings
									</Button>
									{/* The count is its OWN link, not part of the button above.
                      The button opens the composer — overloading it would mean
                      one control doing two unrelated things. Before this, an
                      audit could say "Found 7" with no way to see which seven. */}
									{foundCount > 0 && (
										<Link
											href={`/debug?f=${task.id}`}
											title={`Show the ${foundCount} task${foundCount === 1 ? "" : "s"} this audit found`}
											className={cn(
												"inline-flex items-center gap-1 rounded-md border border-line px-2.5 text-[13px] text-muted",
												"transition-colors duration-150 hover:border-line-strong hover:bg-raised hover:text-ink",
												// Hand-rolled, so it needs the height the Buttons get
												// from ACTION_HEIGHT rather than a py- pair.
												ACTION_HEIGHT,
											)}
										>
											<span className="font-mono text-[11px] tabular-nums text-ink">
												{foundCount}
											</span>
											found
										</Link>
									)}
								</>
							)}
							{/* Ask the person who filed it, in Messages, with the task quoted
                  — the alternative was re-typing the title into a chat by hand
                  every time a task needed a clarifying question. */}
							{author && (
								<Button
									variant="ghost"
									size="sm"
									className={ACTION_HEIGHT}
									title={`Message ${author.name} about this task`}
									onClick={messageAuthor}
								>
									<MessagesSquare
										className="size-3.5"
										aria-hidden
									/>
									Message author
								</Button>
							)}
							<Button
								variant="ghost"
								size="sm"
								className={ACTION_HEIGHT}
								onClick={copyTask}
							>
								<Copy className="size-3.5" aria-hidden />
								Copy
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className={ACTION_HEIGHT}
								onClick={() => {
									setDraft({
										title: task.title,
										description: task.description ?? "",
										priority: task.priority,
										kind: task.kind,
										due_on: task.due_on ?? "",
										project_id: task.project_id ?? "",
										suggested_for: task.suggested_for ?? "",
									});
									setEditing(true);
								}}
							>
								<Pencil className="size-3.5" aria-hidden />
								Edit
							</Button>
							{/* Delete is pushed to the far end. On a phone the bar wraps and
                  it lands alone on the second line — exactly the separation a
                  destructive action should have from "Copy", which it used to
                  sit flush against. */}
							{canDelete && (
								<ConfirmButton
									size="sm"
									className={cn("ml-auto", ACTION_HEIGHT)}
									confirmLabel="Really delete?"
									disabled={pending}
									onConfirm={() => {
										const before = { ...task };
										run(() => deleteTask(task.id), {
											optimistic: () => onRemove(task.id),
											rollback: () => onRestore(before),
											success: "Task deleted.",
										});
									}}
								>
									<Trash2 className="size-3.5" aria-hidden />
									Delete
								</ConfirmButton>
							)}
						</div>
					)}

					{/* Band 5 — filing what an audit found: one line per finding, filed
              in one trip. Each becomes a normal task on this audit's board,
              linked back to it. It sits directly BELOW the action bar, i.e.
              under the "Log findings" button that opened it, on a lifted fill
              so it reads as a drawer off that control rather than a fifth peer
              section. */}
					{!editing && filing && (
						<div className={cn(BAND, "space-y-2 bg-raised/30")}>
							<Textarea
								autoFocus
								value={findings}
								onChange={(e) => setFindings(e.target.value)}
								rows={4}
								placeholder={
									"One finding per line…\nCheckout total wrong on discounts\nAvatar 404s on first load"
								}
								aria-label="What the audit found, one per line"
							/>
							<div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
								<p className="text-[11px] text-faint">
									{findingLines.length > 0
										? `${findingLines.length} task${findingLines.length === 1 ? "" : "s"} — they land on this board as fixes.`
										: "One per line."}
								</p>
								<div className="ml-auto flex gap-2">
									<Button
										variant="ghost"
										size="sm"
										className={ACTION_HEIGHT}
										onClick={() => {
											setFiling(false);
											setFindings("");
										}}
									>
										Cancel
									</Button>
									<Button
										variant="primary"
										size="sm"
										className={ACTION_HEIGHT}
										disabled={
											findingLines.length === 0 || pending
										}
										onClick={fileFindings}
									>
										File{" "}
										{findingLines.length > 0
											? findingLines.length
											: ""}
									</Button>
								</div>
							</div>
						</div>
					)}

					{/* Editing REPLACES bands 2-4 rather than appending to them — reading
              a task and editing it are two modes, not two things you do at
              once. Same drawer, same band padding, so the edges don't move
              under you when you switch. */}
					{editing && (
						<div className={cn(BAND, "space-y-2.5")}>
							<Input
								value={draft.title}
								onChange={(e) =>
									setDraft((d) => ({
										...d,
										title: e.target.value,
									}))
								}
								maxLength={200}
								aria-label="Task title"
							/>
							<Textarea
								value={draft.description}
								onChange={(e) =>
									setDraft((d) => ({
										...d,
										description: e.target.value,
									}))
								}
								rows={3}
								placeholder="Details…"
								aria-label="Task description"
							/>
							{/* Also in the editor, not just the read view: reaching for "add a
                  screenshot" while you're already editing the task is the obvious
                  move, and finding it only after cancelling out is a dead end
                  (Parsa, 2026-07-19). Uploads are immediate — they don't wait for
                  Save, because they're already stored against this task id. */}
							<TaskImages
								taskId={task.id}
								images={images}
								canEdit={!task.archived_at}
								onChange={onImagesChange}
							/>
							<div className="flex flex-wrap items-center gap-2">
								<Dropdown
									className="w-full sm:w-44"
									value={draft.project_id}
									options={[
										{ value: "", label: "General" },
										...projects.map((p) => ({
											value: p.id,
											label: p.name,
										})),
									]}
									onChange={(v) =>
										setDraft((d) => ({
											...d,
											project_id: v,
										}))
									}
								/>
								<Dropdown
									className="w-full sm:w-32"
									value={draft.kind}
									options={KIND_OPTIONS}
									onChange={(v) =>
										setDraft((d) => ({
											...d,
											kind: v as DebugKind,
										}))
									}
								/>
								<Dropdown
									className="w-full sm:w-32"
									value={draft.priority}
									options={PRIORITY_OPTIONS}
									onChange={(v) =>
										setDraft((d) => ({
											...d,
											priority: v as DebugPriority,
										}))
									}
								/>
								<DatePicker
									key={task.id}
									name="due_on"
									// Full width on a phone like every field beside it — a lone 160px
									// control in a stack of full-width ones reads as one that failed
									// to lay out.
									className="w-full sm:w-40"
									defaultValue={task.due_on ?? ""}
									placeholder="No deadline"
									onChange={(iso) =>
										setDraft((d) => ({ ...d, due_on: iso }))
									}
								/>
								{suggestOptions.length > 0 && (
									<Dropdown
										className="w-full sm:w-44"
										value={draft.suggested_for}
										placeholder="No suggestion"
										options={[
											{
												value: "",
												label: "No suggestion",
											},
											...suggestOptions,
										]}
										onChange={(v) =>
											setDraft((d) => ({
												...d,
												suggested_for: v,
											}))
										}
									/>
								)}
							</div>

							{/* Save and Cancel get their own line above a rule, never a slot in
                  the field row. `ml-auto` inside that wrapping row put them at
                  whatever position the last field happened to end at — on a phone,
                  where every field is full width, that was a line of their own only
                  by accident. Declared here instead. */}
							<div className="flex justify-end gap-2 border-t border-line pt-2.5">
								<Button
									variant="ghost"
									size="sm"
									className={ACTION_HEIGHT}
									onClick={() => setEditing(false)}
								>
									Cancel
								</Button>
								<Button
									variant="primary"
									size="sm"
									className={ACTION_HEIGHT}
									disabled={pending}
									onClick={saveEdit}
								>
									Save
								</Button>
							</div>
						</div>
					)}
				</div>
			)}
		</li>
	);
}
