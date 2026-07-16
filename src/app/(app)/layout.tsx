import { getSessionContext } from "@/lib/data/session";
import { Sidebar } from "@/components/shell/sidebar";
import { ToastProvider } from "@/components/ui/toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();

  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col md:flex-row">
        <Sidebar
          sections={[...ctx.sections]}
          isAdmin={ctx.isAdmin}
          name={ctx.profile.full_name}
          email={ctx.profile.email}
        />
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
