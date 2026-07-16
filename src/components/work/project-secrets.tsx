"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Trash2,
} from "lucide-react";
import { addSecret, deleteSecret } from "@/lib/actions/secrets";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import type { ProjectSecret } from "@/lib/types";

export function ProjectSecrets({
  projectId,
  secrets,
}: {
  projectId: string;
  secrets: ProjectSecret[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <Panel>
      <PanelHeader
        title="Credentials"
        action={
          !adding && (
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" aria-hidden />
              Add
            </Button>
          )
        }
      />

      <div className="p-4">
        <p className="mb-3 flex items-start gap-1.5 text-xs text-faint">
          <KeyRound className="mt-0.5 size-3 shrink-0" aria-hidden />
          Visible to Management only. Stored for the team&apos;s convenience — treat
          a shared login as shared.
        </p>

        {adding && (
          <AddSecretForm
            projectId={projectId}
            onDone={() => setAdding(false)}
          />
        )}

        {secrets.length === 0 && !adding ? (
          <p className="py-4 text-center text-[13px] text-faint">
            No credentials saved yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {secrets.map((s) => (
              <SecretRow key={s.id} secret={s} projectId={projectId} />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function AddSecretForm({
  projectId,
  onDone,
}: {
  projectId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const { pending, run } = useAction();

  return (
    <form
      className="mb-4 space-y-2 rounded-md border border-line bg-surface p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => addSecret(projectId, fd), {
          success: "Credential saved.",
          onSuccess: () => {
            onDone();
            router.refresh();
          },
        });
      }}
    >
      <Input name="label" placeholder="Label (e.g. Supabase, Vercel)" maxLength={120} autoFocus />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input name="username" placeholder="Email / username" />
        <Input name="secret" placeholder="Password / key" />
      </div>
      <Input name="url" placeholder="URL (optional)" />
      <Input name="note" placeholder="Note (optional)" />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}

function SecretRow({
  secret,
  projectId,
}: {
  secret: ProjectSecret;
  projectId: string;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const toast = useToast();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy(value: string) {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        toast.success("Copied.");
        setTimeout(() => setCopied(false), 1200);
      },
      () => toast.error("Couldn't copy.")
    );
  }

  return (
    <li className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{secret.label}</p>
        {secret.username && (
          <p className="mt-0.5 truncate text-[13px] text-muted">{secret.username}</p>
        )}
        {secret.secret && (
          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[13px] text-muted">
            <span className="truncate">
              {revealed ? secret.secret : "•".repeat(Math.min(12, secret.secret.length))}
            </span>
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="shrink-0 text-faint transition-colors hover:text-ink"
              aria-label={revealed ? "Hide" : "Reveal"}
            >
              {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => copy(secret.secret!)}
              className="shrink-0 text-faint transition-colors hover:text-ink"
              aria-label="Copy"
            >
              {copied ? <Check className="size-3.5 text-primary-dim" /> : <Copy className="size-3.5" />}
            </button>
          </p>
        )}
        {secret.url && (
          <a
            href={secret.url}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block truncate text-xs text-primary-dim underline-offset-2 hover:underline"
          >
            {secret.url}
          </a>
        )}
        {secret.note && <p className="mt-0.5 text-xs text-faint">{secret.note}</p>}
      </div>
      <ConfirmButton
        size="sm"
        confirmLabel="Delete?"
        disabled={pending}
        onConfirm={() =>
          run(() => deleteSecret(secret.id, projectId), {
            success: "Credential deleted.",
            onSuccess: () => router.refresh(),
          })
        }
      >
        <Trash2 className="size-3.5" aria-hidden />
      </ConfirmButton>
    </li>
  );
}
