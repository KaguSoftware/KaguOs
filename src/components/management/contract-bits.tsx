"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import {
  attachContractFile,
  createContract,
  deleteContract,
  removeContractFile,
  updateContract,
} from "@/lib/actions/management";
import type { ActionResult } from "@/lib/actions/account";
import { createClient } from "@/lib/supabase/client";
import { CreateForm } from "@/components/ui/create";
import { Button, ConfirmButton, SubmitButton } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { SignedFileLink } from "@/components/ui/signed-file-link";
import { DatePicker } from "@/components/ui/date-picker";
import { FileInput } from "@/components/ui/typed-inputs";
import { cn } from "@/lib/utils";
import type { Contract } from "@/lib/types";

export const CONTRACT_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "terminated", label: "Terminated" },
];

function ContractFields({ contract }: { contract?: Contract }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="contract-title">
          <Input
            id="contract-title"
            name="title"
            maxLength={200}
            defaultValue={contract?.title ?? ""}
            autoFocus={!contract}
          />
        </Field>
        <Field label="Client" htmlFor="contract-client">
          <Input
            id="contract-client"
            name="client"
            maxLength={160}
            defaultValue={contract?.client ?? ""}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Starts" htmlFor="contract-starts">
          <DatePicker
            id="contract-starts"
            name="starts_on"
            defaultValue={contract?.starts_on ?? ""}
          />
        </Field>
        <Field label="Ends" htmlFor="contract-ends">
          <DatePicker
            id="contract-ends"
            name="ends_on"
            defaultValue={contract?.ends_on ?? ""}
          />
        </Field>
        <Field label="Status" htmlFor="contract-status">
          <Dropdown
            id="contract-status"
            name="status"
            defaultValue={contract?.status ?? "draft"}
            options={CONTRACT_STATUS_OPTIONS}
          />
        </Field>
      </div>
      <Field label="Notes" htmlFor="contract-notes">
        <Textarea
          id="contract-notes"
          name="notes"
          rows={4}
          defaultValue={contract?.notes ?? ""}
        />
      </Field>
    </>
  );
}

export function NewContractForm() {
  const router = useRouter();
  return (
    <CreateForm
      action={createContract}
      fieldLabels={{
        title: "Title",
        client: "Client",
        starts_on: "Start date",
        ends_on: "End date",
        notes: "Notes",
      }}
      submitLabel="Create contract"
      onCancel={() => router.back()}
    >
      <ContractFields />
    </CreateForm>
  );
}

export function EditContractForm({ contract }: { contract: Contract }) {
  const [result, action] = useActionState(updateContract, null);

  return (
    <form action={action} className="space-y-4 p-4">
      <input type="hidden" name="id" value={contract.id} />
      <ContractFields contract={contract} />
      <div className="flex items-center gap-3">
        <SubmitButton size="sm">Save contract</SubmitButton>
        {result && (
          <p
            role="status"
            className={cn(
              "text-[13px]",
              result.ok ? "text-primary-dim" : "text-danger"
            )}
          >
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}

export function ContractFilePanel({ contract }: { contract: Contract }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileName = contract.file_path?.split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "");

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a file first.");
      return;
    }
    setError(null);
    const supabase = createClient();
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${contract.id}/${crypto.randomUUID()}-${safeName}`;
    startTransition(async () => {
      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(path, file);
      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        return;
      }
      const result = await attachContractFile(contract.id, path);
      if (result && !result.ok) setError(result.message);
    });
  }

  return (
    <div className="space-y-3 p-4">
      {contract.file_path ? (
        <div className="flex flex-wrap items-center gap-3">
          {/* Signed AT CLICK, never at render — see SignedFileLink for why a
              render-time signed URL is stale by construction. */}
          <SignedFileLink
            bucket="contracts"
            path={contract.file_path}
            className="inline-flex items-center gap-1.5 text-sm text-ink underline-offset-2 hover:text-primary-dim hover:underline"
          >
            <FileText className="size-4 text-faint" aria-hidden />
            {fileName || "contract file"}
          </SignedFileLink>
          <ConfirmButton
            size="sm"
            disabled={pending}
            confirmLabel="Remove file?"
            onConfirm={() => {
              setError(null);
              startTransition(async () => {
                const result = await removeContractFile(contract.id);
                if (result && !result.ok) setError(result.message);
              });
            }}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Remove
          </ConfirmButton>
        </div>
      ) : (
        <p className="text-[13px] text-faint">No file attached yet.</p>
      )}

      <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-2">
        <FileInput name="file" accept=".pdf,.doc,.docx,.png,.jpg" />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-3.5" aria-hidden />
          )}
          {contract.file_path ? "Replace file" : "Upload file"}
        </Button>
      </form>
      {error && (
        <p role="status" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function DeleteContractButton({ contractId }: { contractId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <ConfirmButton
        size="sm"
        disabled={pending}
        confirmLabel="Really delete?"
        onConfirm={() => {
          setError(null);
          startTransition(async () => {
            const result = await deleteContract(contractId);
            if (result && !result.ok) setError(result.message);
          });
        }}
      >
        Delete contract
      </ConfirmButton>
      {error && (
        <p role="status" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
