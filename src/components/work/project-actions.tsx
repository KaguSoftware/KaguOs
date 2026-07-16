"use client";

import { deleteProject } from "@/lib/actions/work";
import { ConfirmButton } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";

export function ProjectActions({ projectId }: { projectId: string }) {
  const { pending, run } = useAction();

  return (
    <div className="flex items-center gap-3">
      <ConfirmButton
        size="sm"
        disabled={pending}
        confirmLabel="Really delete?"
        onConfirm={() =>
          run(() => deleteProject(projectId), { success: "Project deleted." })
        }
      >
        Delete project
      </ConfirmButton>
    </div>
  );
}
