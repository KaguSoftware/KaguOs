import { getSessionContext } from "@/lib/data/session";
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
  const ctx = await getSessionContext();

  const [{ data: notifRows }, members] = await Promise.all([
    ctx.supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(30),
    getMembersMap(ctx.supabase),
  ]);

  return (
    <ToastProvider>
      <CommandPalette sections={[...ctx.sections]} isAdmin={ctx.isAdmin} />
      <div className="flex min-h-dvh flex-col md:flex-row">
        <Sidebar
          sections={[...ctx.sections]}
          isAdmin={ctx.isAdmin}
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
