"use client";

import { useState, useTransition } from "react";
import { deleteProject } from "@/lib/actions/work";
import { ConfirmButton } from "@/components/ui/button";

export function ProjectActions({ projectId }: { projectId: string }) {
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
            const result = await deleteProject(projectId);
            if (result && !result.ok) setError(result.message);
          });
        }}
      >
        Delete project
      </ConfirmButton>
      {error && (
        <p role="status" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
