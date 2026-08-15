import { redirect } from "next/navigation";
import { getSessionContext, isClient } from "@/lib/data/session";
import { selectOrThrow } from "@/lib/data/query";
import { ToastProvider } from "@/components/ui/toast";
import { PortalHeader } from "@/components/portal/portal-header";

/**
 * The client shell — the first surface in KaguOs that a non-Kagu person sees.
 *
 * Deliberately NOT the app shell with pieces switched off. There is no sidebar,
 * no command palette, no presence panel, no notification bell, no showcase
 * banner, no unread popups. Every one of those is a window onto the company,
 * and the way they would leak is not a rendering bug but an honest mistake six
 * months from now: someone adds a widget to the shared shell and it appears in
 * front of a client. A separate layout means that class of mistake is not
 * available. The cost is one small duplicated header; it is worth it.
 *
 * It is also why this reads as a quieter room. A teammate's shell is dense
 * because they live in it all day. A client opens this twice a week to answer
 * one question, and the page should look like that question.
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();
  // A member who wanders in gets sent home. Not an error page: /portal is a
  // legitimate URL, it just isn't theirs, and the dashboard is where they meant
  // to be. requireClient() enforces the same rule per page — this is the group
  // guard, so a page added here without one is still covered.
  if (!isClient(ctx)) redirect("/");
  if (!ctx.clientId) redirect("/login");

  const { data: client } = await selectOrThrow(
    ctx.supabase.from("clients").select("name").eq("id", ctx.clientId).maybeSingle(),
    "portal: client"
  );

  return (
    <ToastProvider>
      <a
        href="#main"
        className="sr-only left-4 top-4 z-50 rounded-md border border-line-strong bg-raised px-3 py-2 text-[13px] text-ink focus-visible:not-sr-only focus-visible:fixed"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh flex-col">
        <PortalHeader
          clientName={client?.name ?? "Your account"}
          personName={ctx.profile.full_name}
        />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 focus:outline-none md:px-8 md:py-12"
        >
          {children}
        </main>
        <footer className="border-t border-line px-4 py-5 text-center md:px-8">
          <p className="text-xs text-faint">Video production and paid media by Kagu.</p>
        </footer>
      </div>
    </ToastProvider>
  );
}
