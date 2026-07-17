"use client";

import { useState } from "react";
import { CornerDownRight, Lock, Trash2 } from "lucide-react";
import {
  askQuestion,
  deleteQuestion,
  deleteReply,
  replyToQuestion,
} from "@/lib/actions/learn";
import { useAction } from "@/lib/use-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { Badge } from "@/components/ui/badge";
import { cn, formatRelative } from "@/lib/utils";
import type {
  QuestionAudience,
  SprintQuestion,
  SprintQuestionReply,
} from "@/lib/types";

type Person = { id: string; name: string; color: string };

const AUDIENCES = [
  { value: "everyone", label: "Everyone", hint: "all learn members see it" },
  { value: "admins", label: "Admins only", hint: "just you and the admins" },
];

function Author({
  userId,
  people,
  meId,
}: {
  userId: string | null;
  people: Map<string, Person>;
  meId: string;
}) {
  const person = userId ? people.get(userId) : undefined;
  return (
    <span
      style={person ? { color: person.color } : undefined}
      className={cn("text-[13px] font-medium", !person && "text-muted")}
    >
      {userId === meId ? "You" : person ? person.name : "Former member"}
    </span>
  );
}

/**
 * Sprint Q&A. The asker chooses the audience: everyone in Learn, or admins
 * only (RLS keeps those between the asker and the admins — other members
 * never receive them). Replies inherit the question's visibility.
 */
export function SprintQuestions({
  sprintId,
  questions,
  replies,
  people,
  meId,
  isAdmin,
}: {
  sprintId: string;
  questions: SprintQuestion[];
  replies: SprintQuestionReply[];
  people: Person[];
  meId: string;
  isAdmin: boolean;
}) {
  const { pending, run } = useAction();
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<QuestionAudience>("everyone");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const repliesFor = new Map<string, SprintQuestionReply[]>();
  for (const reply of replies) {
    const list = repliesFor.get(reply.question_id) ?? [];
    list.push(reply);
    repliesFor.set(reply.question_id, list);
  }

  function ask() {
    if (!body.trim() || pending) return;
    run(() => askQuestion(sprintId, body, audience), {
      success:
        audience === "admins" ? "Sent to the admins." : "Question posted.",
      onSuccess: () => setBody(""),
    });
  }

  function sendReply(questionId: string) {
    if (!replyBody.trim() || pending) return;
    run(() => replyToQuestion(questionId, sprintId, replyBody), {
      success: "Reply posted.",
      onSuccess: () => {
        setReplyBody("");
        setReplyingTo(null);
      },
    });
  }

  return (
    <div className="p-4">
      <div className="space-y-2 rounded-md border border-line bg-surface p-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Ask the team something about this sprint…"
          aria-label="Your question"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              ask();
            }
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Dropdown
            options={AUDIENCES}
            value={audience}
            onChange={(v) => setAudience(v === "admins" ? "admins" : "everyone")}
            className="w-44"
          />
          <Button
            variant="primary"
            size="sm"
            disabled={pending || !body.trim()}
            onClick={ask}
          >
            Ask
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <p className="pt-4 text-[13px] text-faint">
          No questions yet — ask the first one.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {questions.map((question) => {
            const questionReplies = repliesFor.get(question.id) ?? [];
            const canDelete = question.created_by === meId || isAdmin;
            return (
              <li key={question.id} className="group/q py-4">
                <div className="flex items-baseline gap-2">
                  <Author
                    userId={question.created_by}
                    people={peopleMap}
                    meId={meId}
                  />
                  <span className="text-xs text-faint">
                    {formatRelative(question.created_at)}
                  </span>
                  {question.audience === "admins" && (
                    <Badge tone="faint">
                      <Lock className="size-3" aria-hidden />
                      admins only
                    </Badge>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() => deleteQuestion(question.id, sprintId), {
                          success: "Question removed.",
                        })
                      }
                      title="Delete question"
                      aria-label="Delete question"
                      className="ml-auto text-faint opacity-0 transition-opacity duration-150 hover:text-danger focus-visible:opacity-100 group-hover/q:opacity-100"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  )}
                </div>
                <p className="mt-1 max-w-[70ch] whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {question.body}
                </p>

                {(questionReplies.length > 0 || replyingTo === question.id) && (
                  <ul className="mt-3 space-y-3 border-l border-line pl-4">
                    {questionReplies.map((reply) => (
                      <li key={reply.id} className="group/r">
                        <div className="flex items-baseline gap-2">
                          <Author
                            userId={reply.created_by}
                            people={peopleMap}
                            meId={meId}
                          />
                          <span className="text-xs text-faint">
                            {formatRelative(reply.created_at)}
                          </span>
                          {(reply.created_by === meId || isAdmin) && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                run(() => deleteReply(reply.id, sprintId), {
                                  success: "Reply removed.",
                                })
                              }
                              title="Delete reply"
                              aria-label="Delete reply"
                              className="ml-auto text-faint opacity-0 transition-opacity duration-150 hover:text-danger focus-visible:opacity-100 group-hover/r:opacity-100"
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          )}
                        </div>
                        <p className="mt-0.5 max-w-[70ch] whitespace-pre-wrap text-sm leading-relaxed text-muted">
                          {reply.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {replyingTo === question.id ? (
                  <div className="mt-3 space-y-2 border-l border-line pl-4">
                    <Textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={2}
                      maxLength={2000}
                      autoFocus
                      placeholder="Your reply…"
                      aria-label="Your reply"
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault();
                          sendReply(question.id);
                        } else if (e.key === "Escape") {
                          setReplyingTo(null);
                          setReplyBody("");
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={pending || !replyBody.trim()}
                        onClick={() => sendReply(question.id)}
                      >
                        Reply
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyBody("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(question.id);
                      setReplyBody("");
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-faint transition-colors duration-150 hover:text-ink"
                  >
                    <CornerDownRight className="size-3" aria-hidden />
                    Reply
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
