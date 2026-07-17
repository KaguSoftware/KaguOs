import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext, getUserId } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { Sidebar } from "@/components/shell/sidebar";
import { CommandPalette } from "@/components/shell/command-palette";
import { ShowcaseBanner } from "@/components/shell/showcase";
import { ToastProvider } from "@/components/ui/toast";
import type { Notification } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The user id comes from the LOCALLY-verified JWT, so it costs nothing and is
  // available before the profile lookup returns. That lets the notifications
  // query — which only needs the id — start in the same wave as the session
  // fetch instead of waiting a full round-trip behind it.
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect("/login");

  // One wave: the profile lookup, the notifications, and the members map all
  // fly together. getMembersMap is cache()-deduped against the page's own call.
  const [ctx, { data: notifRows }, members] = await Promise.all([
    getSessionContext(),
    supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    getMembersMap(supabase),
  ]);

  return (
    <ToastProvider>
      <CommandPalette sections={[...ctx.sections]} isAdmin={ctx.isAdmin} />
      <div className="flex min-h-dvh flex-col md:flex-row">
        <Sidebar
          sections={[...ctx.sections]}
          isAdmin={ctx.isAdmin}
          showcase={ctx.showcase}
          name={ctx.profile.full_name}
          email={ctx.profile.email}
          notifications={(notifRows ?? []) as Notification[]}
          members={members}
        />
        <main className="min-w-0 flex-1">
          {ctx.showcase && <ShowcaseBanner />}
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
