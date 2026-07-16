import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus, ScrollText } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { SectionTabs } from "@/components/shell/section-tabs";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { MANAGEMENT_TABS } from "@/components/management/tabs";
import { formatDate } from "@/lib/utils";
import type { Contract, ContractStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Contracts" };

const STATUS_TONE: Record<ContractStatus, BadgeTone> = {
  draft: "faint",
  active: "green",
  expired: "amber",
  terminated: "danger",
};

export default async function ContractsPage() {
  const ctx = await requireSection("management");

  const { data: contracts } = await ctx.supabase
    .from("contracts")
    .select("*")
    .order("updated_at", { ascending: false });

  const rows = (contracts ?? []) as Contract[];

  return (
    <>
      <PageHeader
        title="Kagu Management"
        description="The company ledger — everything in TL."
        action={
          <LinkButton href="/management/contracts/new">
            <Plus className="size-3.5" aria-hidden />
            New contract
          </LinkButton>
        }
      />
      <SectionTabs active="contracts" tabs={MANAGEMENT_TABS} />

      <div className="rounded-lg border border-line bg-surface">
        {rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No contracts yet"
            hint="Track every agreement with its dates, status, and the signed PDF."
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((contract) => (
              <li key={contract.id}>
                <Link
                  href={`/management/contracts/${contract.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-150 hover:bg-raised/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      {contract.title}
                      {contract.file_path && (
                        <FileText className="size-3.5 text-faint" aria-hidden />
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-faint">
                      {contract.client}
                      {contract.starts_on &&
                        ` · ${formatDate(contract.starts_on)}${contract.ends_on ? ` → ${formatDate(contract.ends_on)}` : ""}`}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[contract.status]}>{contract.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
