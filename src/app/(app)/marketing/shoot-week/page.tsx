import type { Metadata } from "next";
import { requireSection } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow } from "@/lib/data/query";
import { PageHeader } from "@/components/shell/page-header";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { LinkButton } from "@/components/ui/link-button";
import { ShootWeek } from "@/components/marketing/shoot-week";
import type { Client, Creative } from "@/lib/types";

export const metadata: Metadata = { title: "Shoot week" };

/**
 * Shoot week across EVERY client — the version a camera operator actually
 * needs. The per-client tab answers "what are we filming for them"; this
 * answers "what am I filming this fortnight", which is the question that
 * decides whether two shoots collide on a Tuesday.
 *
 * Same derived view either way (MARKETING.md D6): there is no shoot object,
 * only videos carrying a date.
 */
export default async function ShootWeekPage() {
  const ctx = await requireSection("marketing");

  const [creatives, clients, members] = await Promise.all([
    rowsOrThrow(
      ctx.supabase
        .from("creatives")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .not("shoot_date", "is", null)
        .order("shoot_date", { ascending: true }),
      "shoot week: creatives"
    ),
    rowsOrThrow(
      ctx.supabase.from("clients").select("id, name").eq("is_demo", ctx.showcase),
      "shoot week: clients"
    ),
    getMembersMap(ctx.supabase),
  ]);

  const clientNames: Record<string, string> = {};
  for (const c of clients as Pick<Client, "id" | "name">[]) clientNames[c.id] = c.name;

  return (
    <>
      <LiveRefresh tables={["creatives"]} />
      <PageHeader
        title="Shoot week"
        description="Everything with a shoot date in the next fortnight, across every client."
        action={
          <LinkButton href="/marketing" variant="ghost">
            Back to your queue
          </LinkButton>
        }
      />
      <ShootWeek
        creatives={creatives as Creative[]}
        members={members}
        clientNames={clientNames}
      />
    </>
  );
}
