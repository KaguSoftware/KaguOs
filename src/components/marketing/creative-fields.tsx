"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { advanceCreative, deleteCreative, updateCreative } from "@/lib/actions/marketing";
import { useAction } from "@/lib/use-action";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { UrlInput } from "@/components/ui/typed-inputs";
import { ADVANCE_LABEL, nextStatus } from "@/lib/creatives";
import { CHANNEL_OPTIONS } from "@/lib/options";
import type { Creative, MembersMap } from "@/lib/types";

/**
 * The editable body of a video: hook, script, who has it, the links, the dates.
 *
 * Everything here saves on commit rather than behind a form — this panel is
 * opened to change one thing (paste a cut link, hand it to an editor, set a
 * publish date), and a Save button at the bottom of nine fields makes each of
 * those a three-step job. Text areas commit on blur; pickers commit on change.
 */
export function CreativeFields({
  creative,
  members,
  canWrite,
}: {
  creative: Creative;
  members: MembersMap;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [hook, setHook] = useState(creative.hook ?? "");
  const [script, setScript] = useState(creative.script ?? "");

  const memberOptions = [
    { value: "", label: "Unassigned" },
    ...Object.entries(members).map(([id, m]) => ({ value: id, label: m.name })),
  ];

  const next = nextStatus(creative.status);

  function save(patch: Parameters<typeof updateCreative>[1], success?: string) {
    run(() => updateCreative(creative.id, patch), success ? { success } : {});
  }

  return (
    <div className="space-y-5">
      {canWrite && next && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              run(() => advanceCreative(creative.id, creative.status), {
                onSuccess: () => router.refresh(),
              })
            }
          >
            {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {ADVANCE_LABEL[creative.status]}
          </Button>
          {creative.status === "internal_review" && (
            <span className="text-xs text-faint">
              This puts it in front of the client.
            </span>
          )}
          {creative.status === "client_review" && (
            <span className="text-xs text-faint">
              Only if they said yes elsewhere — approving in their portal moves
              it by itself, and leaves a record.
            </span>
          )}
        </div>
      )}

      <Panel>
        <PanelHeader title="The video" />
        <div className="space-y-4 px-4 py-4">
          <Field
            label="Hook"
            htmlFor="creative-hook"
            hint="The first two seconds. What variants of this concept differ on."
          >
            <Textarea
              id="creative-hook"
              rows={2}
              value={hook}
              disabled={!canWrite}
              onChange={(e) => setHook(e.target.value)}
              onBlur={() => {
                if (hook !== (creative.hook ?? "")) save({ hook: hook || null });
              }}
            />
          </Field>

          <Field label="Script" htmlFor="creative-script">
            <Textarea
              id="creative-script"
              rows={10}
              value={script}
              disabled={!canWrite}
              onChange={(e) => setScript(e.target.value)}
              onBlur={() => {
                if (script !== (creative.script ?? "")) save({ script: script || null });
              }}
              className="leading-relaxed"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Producer" htmlFor="creative-owner">
              <Dropdown
                id="creative-owner"
                value={creative.owner_id ?? ""}
                options={memberOptions}
                disabled={!canWrite || pending}
                onChange={(value) => save({ owner_id: value || null })}
              />
            </Field>
            <Field label="Editor" htmlFor="creative-editor">
              <Dropdown
                id="creative-editor"
                value={creative.editor_id ?? ""}
                options={memberOptions}
                disabled={!canWrite || pending}
                onChange={(value) => save({ editor_id: value || null })}
              />
            </Field>
            <Field label="Channel" htmlFor="creative-channel">
              <Dropdown
                id="creative-channel"
                value={creative.channel}
                options={CHANNEL_OPTIONS}
                disabled={!canWrite || pending}
                onChange={(value) => save({ channel: value })}
              />
            </Field>
            <Field label="Kind" htmlFor="creative-kind">
              <Dropdown
                id="creative-kind"
                value={creative.kind}
                options={[
                  { value: "organic", label: "Organic", hint: "A normal post." },
                  { value: "ad", label: "Ad", hint: "Money runs behind it." },
                ]}
                disabled={!canWrite || pending}
                onChange={(value) =>
                  save({ kind: value === "ad" ? "ad" : "organic" })
                }
              />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Shoot, cut and publish" />
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <Field label="Shoot date" htmlFor="creative-shoot">
            <DatePicker
              id="creative-shoot"
              name="shoot_date"
              defaultValue={creative.shoot_date ?? ""}
              onChange={(iso) => canWrite && save({ shoot_date: iso || null })}
            />
          </Field>
          <Field label="Publish on" htmlFor="creative-publish">
            <DatePicker
              id="creative-publish"
              name="publish_on"
              defaultValue={creative.publish_on ?? ""}
              onChange={(iso) => canWrite && save({ publish_on: iso || null })}
            />
          </Field>

          <LinkField
            label="Raw footage"
            id="creative-footage"
            value={creative.footage_url}
            disabled={!canWrite}
            onSave={(url) => save({ footage_url: url })}
          />
          <LinkField
            label="The cut"
            id="creative-cut"
            value={creative.cut_url}
            disabled={!canWrite}
            onSave={(url) => save({ cut_url: url })}
          />
          <LinkField
            label="Published post"
            id="creative-published"
            value={creative.published_url}
            disabled={!canWrite}
            onSave={(url) => save({ published_url: url })}
          />
        </div>
      </Panel>

      {canWrite && (
        <ConfirmButton
          size="sm"
          disabled={pending}
          confirmLabel="Really delete this video?"
          onConfirm={() =>
            run(() => deleteCreative(creative.id), {
              success: "Video deleted.",
              onSuccess: () => router.push(`/marketing/clients/${creative.client_id}`),
            })
          }
        >
          <Trash2 className="size-3.5" aria-hidden />
          Delete video
        </ConfirmButton>
      )}
    </div>
  );
}

/**
 * A URL field that saves on blur and, once set, offers the link itself.
 *
 * ⚠️ These are plain external links (Drive, Frame.io, an Instagram post), NOT
 * signed storage URLs. If video files ever move into a private bucket, the link
 * must be signed at click and never baked into the server-rendered HTML — a
 * review page is the worst case for that, because a client leaves the tab open,
 * the token expires, and the player fails silently.
 */
function LinkField({
  label,
  id,
  value,
  disabled,
  onSave,
}: {
  label: string;
  id: string;
  value: string | null;
  disabled?: boolean;
  onSave: (url: string | null) => void;
}) {
  const [text, setText] = useState(value ?? "");

  return (
    <Field
      label={label}
      htmlFor={id}
      hint={
        value ? undefined : "Paste a link — Drive, Frame.io, wherever it lives."
      }
    >
      <div className="flex items-center gap-2">
        <UrlInput
          id={id}
          className="flex-1"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const cleaned = text.trim();
            if (cleaned === (value ?? "")) return;
            onSave(cleaned || null);
          }}
        />
        {value && (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-faint transition-colors duration-150 hover:text-ink"
          >
            <ExternalLink className="size-4" aria-hidden />
            <span className="sr-only">Open {label}</span>
          </a>
        )}
      </div>
    </Field>
  );
}
