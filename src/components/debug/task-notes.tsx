"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { addTaskNote, deleteTaskNote, editTaskNote } from "@/lib/actions/debug";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useAction } from "@/lib/use-action";
import { cn, formatRelative } from "@/lib/utils";
import type { DebugTaskNote, MembersMap } from "@/lib/types";

const MAX_NOTE_LEN = 2000;

/**
 * The notes thread on a task — who said what, and when.
 *
 * A task's `description` is one field the whole team shares: whoever edits last
 * wins, and nothing on the row says who wrote any of it. People worked around
 * that by typing their own name into the textarea. Notes make that structural:
 * appended, never overwritten, each one carrying its author and time.
 *
 * Rows stream in over the board's existing realtime channel, so the parent owns
 * the list and this component only composes — there's no local copy to fall out
 * of step with a teammate's note landing mid-edit.
 */
export function TaskNotes({
	taskId,
	notes,
	members,
	meId,
	isAdmin,
	canEdit,
	className,
}: {
	taskId: string;
	notes: DebugTaskNote[];
	members: MembersMap;
	meId: string;
	isAdmin: boolean;
	/** False on archived tasks and for view-only members — read the thread, don't add to it. */
	canEdit: boolean;
	/**
	 * Outer spacing, so the caller can own it. Defaults to the `mt-3` this always
	 * had, for callers that stack the thread directly under other content. The
	 * detail panel gives the thread its own padded band and passes `mt-0`.
	 */
	className?: string;
}) {
	const { pending, run } = useAction();
	const [draft, setDraft] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editDraft, setEditDraft] = useState("");

	function submit() {
		const body = draft.trim();
		if (!body) return;
		run(() => addTaskNote(taskId, body), {
			success: "Note added.",
			// Cleared optimistically: the note arrives over the realtime channel, and
			// leaving the text sitting in the box reads as "that didn't send".
			onSuccess: () => setDraft(""),
		});
	}

	function saveEdit(noteId: string) {
		const body = editDraft.trim();
		if (!body) return;
		run(() => editTaskNote(noteId, body), {
			success: "Note updated.",
			onSuccess: () => setEditingId(null),
		});
	}

	if (notes.length === 0 && !canEdit) return null;

	return (
		<div className={cn("mt-3 max-w-[70ch]", className)}>
			{notes.length > 0 && (
				<ul className="space-y-2.5 border-l border-line pl-3">
					{notes.map((note) => {
						const author = note.created_by
							? members[note.created_by]
							: null;
						const isMine = note.created_by === meId;
						const edited =
							Date.parse(note.updated_at) -
								Date.parse(note.created_at) >
							1000;
						return (
							<li key={note.id} className="group">
								<p className="flex flex-wrap items-baseline gap-x-2">
									<span
										className="text-[calc(13px*var(--text-scale,1))] font-medium"
										style={{ color: author?.color }}
									>
										{isMine
											? "You"
											: (author?.name ?? "Someone")}
									</span>
									<span className="text-[calc(11px*var(--text-scale,1))] text-faint">
										{formatRelative(note.created_at)}
										{edited && " · edited"}
									</span>
									{/* Controls stay hidden until the row is hovered or focused —
                      a thread of five notes shouldn't be a thread of ten
                      buttons. Focus-within keeps them reachable by keyboard. */}
									{canEdit &&
										(isMine || isAdmin) &&
										editingId !== note.id && (
											<span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
												{isMine && (
													<button
														type="button"
														title="Edit note"
														aria-label="Edit note"
														onClick={() => {
															setEditingId(
																note.id,
															);
															setEditDraft(
																note.body,
															);
														}}
														className="rounded p-1 text-faint transition-colors duration-150 hover:bg-raised hover:text-ink"
													>
														<Pencil
															className="size-3"
															aria-hidden
														/>
													</button>
												)}
												<button
													type="button"
													title="Delete note"
													aria-label="Delete note"
													onClick={() =>
														run(
															() =>
																deleteTaskNote(
																	note.id,
																),
															{
																success:
																	"Note deleted.",
															},
														)
													}
													className="rounded p-1 text-faint transition-colors duration-150 hover:bg-raised hover:text-danger"
												>
													<Trash2
														className="size-3"
														aria-hidden
													/>
												</button>
											</span>
										)}
								</p>
								{editingId === note.id ? (
									<div className="mt-1 space-y-1.5">
										<Textarea
											value={editDraft}
											onChange={(e) =>
												setEditDraft(e.target.value)
											}
											rows={2}
											maxLength={MAX_NOTE_LEN}
											aria-label="Edit note"
											autoFocus
										/>
										<div className="flex items-center gap-1.5">
											<Button
												size="sm"
												onClick={() =>
													saveEdit(note.id)
												}
												disabled={
													pending || !editDraft.trim()
												}
											>
												<Check
													className="size-3.5"
													aria-hidden
												/>
												Save
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													setEditingId(null)
												}
											>
												<X
													className="size-3.5"
													aria-hidden
												/>
												Cancel
											</Button>
										</div>
									</div>
								) : (
									<p className="whitespace-pre-wrap text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
										{note.body}
									</p>
								)}
							</li>
						);
					})}
				</ul>
			)}

			{canEdit && (
				<div
					className={cn("space-y-1.5", notes.length > 0 && "mt-2.5")}
				>
					<Textarea
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						// Enter sends, Shift+Enter breaks the line — the same contract as
						// the chat composer, so the muscle memory carries across.
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								submit();
							}
						}}
						rows={2}
						maxLength={MAX_NOTE_LEN}
						placeholder="Add a note…"
						aria-label="Add a note to this task"
					/>
					{draft.trim() && (
						<div className="flex items-center gap-2">
							<Button
								size="sm"
								onClick={submit}
								disabled={pending}
							>
								{pending && (
									<Loader2
										className="size-3.5 animate-spin"
										aria-hidden
									/>
								)}
								Add note
							</Button>
							<span className="text-[calc(11px*var(--text-scale,1))] text-faint">
								Enter to send · Shift+Enter for a new line
							</span>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
