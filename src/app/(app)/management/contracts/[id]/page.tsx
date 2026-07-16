import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import {
  ContractFilePanel,
  DeleteContractButton,
  EditContractForm,
} from "@/components/management/contract-bits";
import type { Contract } from "@/lib/types";

export const metadata: Metadata = { title: "Contract" };

export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("management");

  const { data: contract } = await ctx.supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!contract) notFound();

  let signedUrl: string | null = null;
  if (contract.file_path) {
    const { data: signed } = await ctx.supabase.storage
      .from("contracts")
      .createSignedUrl(contract.file_path, 3600);
    signedUrl = signed?.signedUrl ?? null;
  }

  return (
    <>
      <Link
        href="/management/contracts"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All contracts
      </Link>
      <PageHeader title={contract.title} description={contract.client} />

      <div className="grid max-w-3xl gap-6">
        <Panel>
          <PanelHeader title="File" />
          <ContractFilePanel contract={contract as Contract} signedUrl={signedUrl} />
        </Panel>
        <Panel>
          <PanelHeader title="Details" />
          <EditContractForm contract={contract as Contract} />
        </Panel>
        <DeleteContractButton contractId={contract.id} />
      </div>
    </>
  );
}
