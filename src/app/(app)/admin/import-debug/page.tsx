import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { ImportDebug } from "@/components/admin/import-debug";

export const metadata: Metadata = { title: "Import debug sheet" };

export default async function ImportDebugPage() {
  await requireAdmin();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Import the old debug sheet"
        description="Export your Google Sheet as CSV (File → Download → CSV), then preview and import. Assignees match by exact name or email."
      />
      <ImportDebug />
    </div>
  );
}
