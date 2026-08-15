import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSectionWrite } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";
import { CreatePage } from "@/components/ui/create";
import { NewCreativeForm } from "@/components/marketing/forms";

export const metadata: Metadata = { title: "New video" };

export default async function NewCreativePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const ctx = await requireSectionWrite("marketing");
  const { client } = await searchParams;

  const [clients, campaigns, profiles] = await Promise.all([
    rowsOrThrow(
      ctx.supabase
        .from("clients")
        .select("id, name")
        .eq("is_demo", ctx.showcase)
        .neq("status", "ended")
        .order("name"),
      "new video: clients"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("marketing_campaigns")
        .select("id, name, client_id")
        .eq("is_demo", ctx.showcase)
        .neq("status", "done")
        .order("name"),
      "new video: campaigns"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("kind", "member")
        .order("full_name"),
      "new video: profiles"
    ),
  ]);

  // A video cannot exist without a client, so there is nothing to put on this
  // form until one exists. Sending them to make one is more useful than
  // rendering a picker with no options in it.
  if (clients.length === 0) redirect("/marketing/clients/new");

  return (
    <CreatePage
      title="New video"
      hint="One row per video, from the idea to the post going live. Nothing here is required — fill in what you know."
      wide
    >
      <NewCreativeForm
        clients={clients as { id: string; name: string }[]}
        campaigns={
          campaigns as { id: string; name: string; client_id: string | null }[]
        }
        members={profiles.map((p) => ({
          id: p.id,
          name: p.full_name || p.email,
        }))}
        defaultClientId={client}
      />
    </CreatePage>
  );
}
