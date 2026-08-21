"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateForm } from "@/components/ui/create";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { NumberInput } from "@/components/ui/number-input";
import { UrlInput } from "@/components/ui/typed-inputs";
import {
  createCampaign,
  createClient,
  createPost,
  logMarketingExpense,
} from "@/lib/actions/marketing";
import { CAMPAIGN_STATUS_OPTIONS, CHANNEL_OPTIONS } from "@/lib/options";
import { POST_STATUS_LABELS } from "@/lib/posts";

const CURRENCY_OPTIONS = [
  { value: "TRY", label: "TRY — Turkish lira" },
  { value: "USD", label: "USD — US dollar" },
  { value: "EUR", label: "EUR — Euro" },
];

const ENGAGEMENT_OPTIONS = [
  { value: "retainer", label: "Retainer", hint: "A fixed fee for a set amount of work." },
  { value: "project", label: "Project", hint: "One-off, priced as a job." },
  { value: "ad_fee", label: "% of ad spend", hint: "A cut of what runs through their ads." },
];

export function NewClientForm() {
  const router = useRouter();
  // The deliverables field only means something on a retainer, so it appears
  // when it does. Showing it greyed out for a project would be a question with
  // no right answer.
  const [engagement, setEngagement] = useState("retainer");

  return (
    <CreateForm
      action={createClient}
      fieldLabels={{ name: "Name", brand_notes: "Brand notes" }}
      submitLabel="Create client"
      onCancel={() => router.back()}
      onDone={() => router.push("/marketing")}
    >
      <Field label="Name" htmlFor="client-name">
        <Input id="client-name" name="name" maxLength={120} autoFocus />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Engagement" htmlFor="client-engagement">
          <Dropdown
            id="client-engagement"
            name="engagement_kind"
            value={engagement}
            onChange={setEngagement}
            options={ENGAGEMENT_OPTIONS}
          />
        </Field>
        {engagement === "retainer" ? (
          <Field label="Posts a month" htmlFor="client-deliverables">
            <NumberInput
              id="client-deliverables"
              name="monthly_deliverables"
              decimals={0}
            />
          </Field>
        ) : (
          <Field label="Billing currency" htmlFor="client-currency">
            <Dropdown
              id="client-currency"
              name="currency"
              defaultValue="TRY"
              options={CURRENCY_OPTIONS}
            />
          </Field>
        )}
      </div>

      {engagement === "retainer" && (
        <Field label="Billing currency" htmlFor="client-currency-retainer">
          <Dropdown
            id="client-currency-retainer"
            name="currency"
            defaultValue="TRY"
            options={CURRENCY_OPTIONS}
          />
        </Field>
      )}

      <Field
        label="Ad account"
        htmlFor="client-ad-account"
        hint="Whose card gets charged for their ads. Their own, normally — we just manage it."
      >
        <Dropdown
          id="client-ad-account"
          name="ad_account_owner"
          defaultValue="client"
          options={[
            { value: "client", label: "The client's" },
            { value: "kagu", label: "Kagu's" },
          ]}
        />
      </Field>

      <Field
        label="Brand notes"
        htmlFor="client-notes"
        hint="Voice, what they'll never approve, best posting times, who signs off."
      >
        <Textarea id="client-notes" name="brand_notes" rows={5} />
      </Field>
    </CreateForm>
  );
}

export function NewPostForm({
  clients,
  campaigns,
  members,
  defaultClientId,
}: {
  clients: { id: string; name: string }[];
  campaigns: { id: string; name: string; client_id: string | null }[];
  members: { id: string; name: string }[];
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(defaultClientId ?? clients[0]?.id ?? "");

  // Only this client's campaigns — offering another client's would tie the
  // post to money that isn't theirs.
  const clientCampaigns = campaigns.filter((c) => c.client_id === clientId);

  return (
    <CreateForm
      action={createPost}
      fieldLabels={{ title: "Title", notes: "Notes" }}
      submitLabel="Add post"
      onCancel={() => router.back()}
      onDone={() => router.push(`/marketing/clients/${clientId}`)}
    >
      <Field label="Client" htmlFor="post-client">
        <Dropdown
          id="post-client"
          name="client_id"
          value={clientId}
          onChange={setClientId}
          placeholder="Which client is this for?"
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
        />
      </Field>

      <Field label="Title" htmlFor="post-title">
        <Input id="post-title" name="title" maxLength={200} autoFocus />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Channel" htmlFor="post-channel">
          <Dropdown
            id="post-channel"
            name="channel"
            defaultValue="instagram"
            options={CHANNEL_OPTIONS}
          />
        </Field>
        <Field label="Status" htmlFor="post-status">
          <Dropdown
            id="post-status"
            name="status"
            defaultValue="idea"
            options={(["idea", "making", "scheduled"] as const).map((s) => ({
              value: s,
              label: POST_STATUS_LABELS[s],
            }))}
          />
        </Field>
        <Field label="Owner" htmlFor="post-owner">
          <Dropdown
            id="post-owner"
            name="owner_id"
            defaultValue=""
            options={[
              { value: "", label: "Unassigned" },
              ...members.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
        </Field>
        <Field label="Publish date" htmlFor="post-publish">
          <DatePicker id="post-publish" name="publish_on" />
        </Field>
        <Field label="Campaign" htmlFor="post-campaign">
          <Dropdown
            id="post-campaign"
            name="campaign_id"
            defaultValue=""
            options={[
              { value: "", label: "No campaign" },
              ...clientCampaigns.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </Field>
      </div>

      <Field
        label="Notes"
        htmlFor="post-notes"
        hint="The idea, the caption draft, whatever the person making it needs."
      >
        <Textarea id="post-notes" name="notes" rows={5} />
      </Field>
    </CreateForm>
  );
}

/**
 * A marketing expense, logged from the section that spent it. Writes into THE
 * company ledger with category='marketing' (0069) — the Finance tab shows the
 * same row, so there is no second book to reconcile.
 */
export function NewExpenseForm({
  clients,
  campaigns,
  defaultClientId,
}: {
  clients: { id: string; name: string }[];
  campaigns: { id: string; name: string; client_id: string | null }[];
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(defaultClientId ?? "");

  // General spend has no client, so campaigns only narrow once one is picked.
  const clientCampaigns = campaigns.filter((c) => c.client_id === clientId);

  return (
    <CreateForm
      action={logMarketingExpense}
      fieldLabels={{ amount: "Amount", occurred_on: "Date", notes: "What it was" }}
      submitLabel="Log expense"
      onCancel={() => router.back()}
      onDone={() =>
        router.push(clientId ? `/marketing/clients/${clientId}?tab=budget` : "/marketing?tab=budget")
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" htmlFor="mexp-amount">
          <NumberInput id="mexp-amount" name="amount" />
        </Field>
        <Field label="Currency" htmlFor="mexp-currency">
          <Dropdown
            id="mexp-currency"
            name="currency"
            defaultValue="TRY"
            options={CURRENCY_OPTIONS}
          />
        </Field>
        <Field label="Direction" htmlFor="mexp-type">
          <Dropdown
            id="mexp-type"
            name="type"
            defaultValue="expense"
            options={[
              { value: "expense", label: "Money out", hint: "Spent from pocket" },
              { value: "income", label: "Money in", hint: "A refund or reimbursement" },
            ]}
          />
        </Field>
        <Field label="Date" htmlFor="mexp-date" hint="Empty = today.">
          <DatePicker id="mexp-date" name="occurred_on" />
        </Field>
        <Field
          label="Client"
          htmlFor="mexp-client"
          hint="Who the money was spent for."
        >
          <Dropdown
            id="mexp-client"
            name="marketing_client_id"
            value={clientId}
            onChange={setClientId}
            options={[
              { value: "", label: "General (no client)" },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </Field>
        <Field
          label="Campaign"
          htmlFor="mexp-campaign"
          hint="Ties the money to the plan it ran against."
        >
          <Dropdown
            id="mexp-campaign"
            name="campaign_id"
            defaultValue=""
            options={[
              { value: "", label: "No campaign" },
              ...clientCampaigns.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </Field>
      </div>
      <Field label="What it was" htmlFor="mexp-notes">
        <Textarea
          id="mexp-notes"
          name="notes"
          rows={3}
          placeholder="A light, a boost, an editor's day rate…"
        />
      </Field>
    </CreateForm>
  );
}

export function NewCampaignForm({
  clients,
  defaultClientId,
}: {
  clients: { id: string; name: string }[];
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(defaultClientId ?? clients[0]?.id ?? "");

  return (
    <CreateForm
      action={createCampaign}
      fieldLabels={{
        name: "Name",
        starts_on: "Start date",
        ends_on: "End date",
        budget: "Budget",
        notes: "Notes",
      }}
      submitLabel="Create campaign"
      onCancel={() => router.back()}
      onDone={() => router.push(`/marketing/clients/${clientId}?tab=campaigns`)}
    >
      <Field label="Client" htmlFor="campaign-client">
        <Dropdown
          id="campaign-client"
          name="client_id"
          value={clientId}
          onChange={setClientId}
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
        />
      </Field>

      <Field label="Name" htmlFor="campaign-name">
        <Input id="campaign-name" name="name" maxLength={160} autoFocus />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Channel"
          htmlFor="campaign-channel"
          hint="Where the content goes."
        >
          <Dropdown
            id="campaign-channel"
            name="channel"
            defaultValue="other"
            options={CHANNEL_OPTIONS}
          />
        </Field>
        <Field
          label="Ad platform"
          htmlFor="campaign-platform"
          hint="Where the money goes."
        >
          <Dropdown
            id="campaign-platform"
            name="platform"
            defaultValue=""
            options={[
              { value: "", label: "No paid spend" },
              { value: "meta", label: "Meta" },
              { value: "tiktok", label: "TikTok" },
              { value: "google", label: "Google" },
              { value: "other", label: "Other" },
            ]}
          />
        </Field>
        <Field label="Status" htmlFor="campaign-status">
          <Dropdown
            id="campaign-status"
            name="status"
            defaultValue="idea"
            options={CAMPAIGN_STATUS_OPTIONS}
          />
        </Field>
        <Field label="Budget" htmlFor="campaign-budget">
          <NumberInput id="campaign-budget" name="budget" />
        </Field>
        <Field label="Starts" htmlFor="campaign-starts">
          <DatePicker id="campaign-starts" name="starts_on" />
        </Field>
        <Field label="Ends" htmlFor="campaign-ends">
          <DatePicker id="campaign-ends" name="ends_on" />
        </Field>
        <Field
          label="Goal"
          htmlFor="campaign-goal-metric"
          hint="What this campaign is for."
        >
          <Dropdown
            id="campaign-goal-metric"
            name="goal_metric"
            defaultValue=""
            options={[
              { value: "", label: "No target" },
              { value: "reach", label: "Reach" },
              { value: "leads", label: "Leads" },
              { value: "sales", label: "Sales" },
              { value: "followers", label: "Followers" },
            ]}
          />
        </Field>
        <Field label="Target" htmlFor="campaign-goal-target">
          <NumberInput id="campaign-goal-target" name="goal_target" decimals={0} />
        </Field>
      </div>

      <Field label="Currency" htmlFor="campaign-currency">
        <Dropdown
          id="campaign-currency"
          name="currency"
          defaultValue="TRY"
          options={CURRENCY_OPTIONS}
        />
      </Field>

      <Field label="Link" htmlFor="campaign-url" hint="Ad manager, brief, landing page.">
        <UrlInput id="campaign-url" name="url" />
      </Field>

      <Field label="Notes" htmlFor="campaign-notes">
        <Textarea id="campaign-notes" name="notes" rows={4} />
      </Field>
    </CreateForm>
  );
}
