"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { blockIfShowcase, requireSection } from "@/lib/data/session";
import { todayInIstanbul } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/account";
import type {
  ContractStatus,
  Currency,
  RecurringCadence,
  TransactionType,
} from "@/lib/types";

const CURRENCIES: Currency[] = ["TRY", "USD", "EUR"];
const TYPES: TransactionType[] = ["income", "expense"];
const CADENCES: RecurringCadence[] = ["monthly", "yearly"];
const CONTRACT_STATUSES: ContractStatus[] = ["draft", "active", "expired", "terminated"];

function today() {
  return todayInIstanbul();
}

function parseAmount(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

// ---------- FX rates ----------

export async function setFxRate(
  currency: "USD" | "EUR",
  rate: number
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("management");
  if (!["USD", "EUR"].includes(currency)) return { ok: false, message: "Invalid currency." };
  if (!Number.isFinite(rate) || rate <= 0) {
    return { ok: false, message: "Rate must be a positive number." };
  }

  const { error } = await ctx.supabase.from("fx_rates").upsert({
    currency,
    rate_to_try: rate,
    updated_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/management/finance");
  return { ok: true, message: `1 ${currency} = ${rate} TL saved.` };
}

// ---------- Transactions ----------

export async function createTransaction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("management");

  const type = String(formData.get("type") ?? "expense") as TransactionType;
  const currency = String(formData.get("currency") ?? "TRY") as Currency;
  const amount = parseAmount(formData.get("amount"));
  if (amount === null) return { ok: false, message: "Amount must be a positive number." };

  const { error } = await ctx.supabase.from("transactions").insert({
    type: TYPES.includes(type) ? type : "expense",
    amount,
    currency: CURRENCIES.includes(currency) ? currency : "TRY",
    occurred_on: String(formData.get("occurred_on") ?? "") || today(),
    client: String(formData.get("client") ?? "").trim() || null,
    project_id: String(formData.get("project_id") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/management/finance");
  return { ok: true, message: "Transaction recorded." };
}

export async function updateTransaction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("management");
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing transaction id." };

  const type = String(formData.get("type") ?? "expense") as TransactionType;
  const currency = String(formData.get("currency") ?? "TRY") as Currency;
  const amount = parseAmount(formData.get("amount"));
  if (amount === null) return { ok: false, message: "Amount must be a positive number." };

  const { error } = await ctx.supabase
    .from("transactions")
    .update({
      type: TYPES.includes(type) ? type : "expense",
      amount,
      currency: CURRENCIES.includes(currency) ? currency : "TRY",
      occurred_on: String(formData.get("occurred_on") ?? "") || today(),
      client: String(formData.get("client") ?? "").trim() || null,
      project_id: String(formData.get("project_id") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/management/finance");
  return { ok: true, message: "Transaction saved." };
}

export async function updateRecurring(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("management");
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing item id." };

  const type = String(formData.get("type") ?? "expense") as TransactionType;
  const currency = String(formData.get("currency") ?? "TRY") as Currency;
  const cadence = String(formData.get("cadence") ?? "monthly") as RecurringCadence;
  const amount = parseAmount(formData.get("amount"));
  if (amount === null) return { ok: false, message: "Amount must be a positive number." };

  const { error } = await ctx.supabase
    .from("recurring_items")
    .update({
      type: TYPES.includes(type) ? type : "expense",
      name: String(formData.get("name") ?? "").trim().slice(0, 160) || "Untitled item",
      counterparty: String(formData.get("counterparty") ?? "").trim() || null,
      amount,
      currency: CURRENCIES.includes(currency) ? currency : "TRY",
      cadence: CADENCES.includes(cadence) ? cadence : "monthly",
      started_on: String(formData.get("started_on") ?? "") || today(),
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/management/finance");
  return { ok: true, message: "Recurring item saved." };
}

export async function deleteTransaction(transactionId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("management");

  const { error } = await ctx.supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/management/finance");
  return { ok: true, message: "Transaction deleted." };
}

// ---------- Recurring items ----------

export async function createRecurring(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("management");

  const type = String(formData.get("type") ?? "expense") as TransactionType;
  const currency = String(formData.get("currency") ?? "TRY") as Currency;
  const cadence = String(formData.get("cadence") ?? "monthly") as RecurringCadence;
  const amount = parseAmount(formData.get("amount"));
  if (amount === null) return { ok: false, message: "Amount must be a positive number." };

  const { error } = await ctx.supabase.from("recurring_items").insert({
    type: TYPES.includes(type) ? type : "expense",
    name: String(formData.get("name") ?? "").trim().slice(0, 160) || "Untitled item",
    counterparty: String(formData.get("counterparty") ?? "").trim() || null,
    amount,
    currency: CURRENCIES.includes(currency) ? currency : "TRY",
    cadence: CADENCES.includes(cadence) ? cadence : "monthly",
    started_on: String(formData.get("started_on") ?? "") || today(),
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/management/finance");
  return { ok: true, message: "Recurring item added." };
}

export async function setRecurringCanceled(
  itemId: string,
  canceled: boolean
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("management");

  const { error } = await ctx.supabase
    .from("recurring_items")
    .update({ canceled_on: canceled ? today() : null })
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/management/finance");
  return { ok: true, message: canceled ? "Marked canceled." : "Reactivated." };
}

export async function deleteRecurring(itemId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("management");

  const { error } = await ctx.supabase
    .from("recurring_items")
    .delete()
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/management/finance");
  return { ok: true, message: "Recurring item deleted." };
}

// ---------- Contracts ----------

function contractFields(formData: FormData) {
  const status = String(formData.get("status") ?? "draft") as ContractStatus;
  return {
    title: String(formData.get("title") ?? "").trim().slice(0, 200) || "Untitled contract",
    client: String(formData.get("client") ?? "").trim().slice(0, 160) || "Unknown client",
    starts_on: String(formData.get("starts_on") ?? "") || null,
    ends_on: String(formData.get("ends_on") ?? "") || null,
    status: CONTRACT_STATUSES.includes(status) ? status : "draft",
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createContract(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("management");

  const { data: contract, error } = await ctx.supabase
    .from("contracts")
    .insert({ ...contractFields(formData), created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !contract) return { ok: false, message: error?.message ?? "Failed." };

  revalidatePath("/management/finance");
  redirect(`/management/contracts/${contract.id}`);
}

export async function updateContract(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("management");
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing contract id." };

  const { error } = await ctx.supabase
    .from("contracts")
    .update(contractFields(formData))
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/management/finance");
  revalidatePath(`/management/contracts/${id}`);
  return { ok: true, message: "Contract saved." };
}

/** Called after the browser uploads straight to the private `contracts` bucket. */
export async function attachContractFile(
  contractId: string,
  filePath: string
): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("management");

  const { data: existing } = await ctx.supabase
    .from("contracts")
    .select("file_path")
    .eq("id", contractId)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("contracts")
    .update({ file_path: filePath })
    .eq("id", contractId);
  if (error) return { ok: false, message: error.message };

  if (existing?.file_path && existing.file_path !== filePath) {
    await ctx.supabase.storage.from("contracts").remove([existing.file_path]);
  }

  revalidatePath(`/management/contracts/${contractId}`);
  return { ok: true, message: "File attached." };
}

export async function removeContractFile(contractId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("management");

  const { data: contract } = await ctx.supabase
    .from("contracts")
    .select("file_path")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract?.file_path) return { ok: false, message: "No file attached." };

  const { error } = await ctx.supabase
    .from("contracts")
    .update({ file_path: null })
    .eq("id", contractId);
  if (error) return { ok: false, message: error.message };

  await ctx.supabase.storage.from("contracts").remove([contract.file_path]);

  revalidatePath(`/management/contracts/${contractId}`);
  return { ok: true, message: "File removed." };
}

export async function deleteContract(contractId: string): Promise<ActionResult> {
  const showcaseStop = await blockIfShowcase();
  if (showcaseStop) return showcaseStop;
  const ctx = await requireSection("management");

  const { data: contract } = await ctx.supabase
    .from("contracts")
    .select("file_path")
    .eq("id", contractId)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("contracts")
    .delete()
    .eq("id", contractId);
  if (error) return { ok: false, message: error.message };

  if (contract?.file_path) {
    await ctx.supabase.storage.from("contracts").remove([contract.file_path]);
  }

  revalidatePath("/management/finance");
  redirect("/management/finance?tab=contracts");
}
