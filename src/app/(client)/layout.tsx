import { loadPortal, portalCounts } from "@/lib/data/portal";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { todayInIstanbul } from "@/lib/utils";

/**
 * The client shell — the whole surface an outsider with a login ever sees.
 *
 * ── Why this is a separate group and not a variant of the app shell ─────────
 *
 * The teammate shell (app/(app)/layout.tsx) is one long list of things a client
 * must never touch: presence, the pulse, the inbox, the section rail, the
 * command palette, the notification bell. Building the portal as that layout
 * with eight conditionals would mean every future addition to it is a client
 * leak waiting for someone to forget the ninth. A separate group inverts the
 * default: nothing reaches a client unless it is written HERE, deliberately.
 *
 * `loadPortal()` is the only door in — it opens with `requireClient()`, so a
 * member who follows a /portal link is sent to their own home rather than shown
 * an empty portal. The two shells are exclusive, in both directions.
 *
 * The database agrees independently: a client fails all four gate functions
 * (0062 §4), so even a routing mistake that landed one on a teammate page would
 * render an empty page rather than the company's data.
 *
 * ── Why the layout does a data fetch ────────────────────────────────────────
 *
 * The rail carries live counts — packs still to finish, invoices past due — and
 * those are the two reasons anybody opens this app. `loadPortal()` is wrapped in
 * React cache(), so the page below shares this exact fetch rather than paying
 * for a second one, and the number in the rail cannot disagree with the page
 * beside it.
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const portal = await loadPortal();
  const counts = portalCounts(portal, todayInIstanbul());
  const profile = portal.ctx.profile;

  return (
    <ToastProvider>
      <a
        href="#main"
        className="sr-only left-4 top-4 z-50 rounded-md border border-line-strong bg-raised px-3 py-2 text-[calc(13px*var(--text-scale,1))] text-ink focus-visible:not-sr-only focus-visible:fixed"
      >
        Skip to content
      </a>

      <div className="flex min-h-dvh flex-col md:flex-row">
        <PortalSidebar
          name={profile.full_name}
          email={profile.email}
          packsOpen={counts.packsOpen}
          overdue={counts.overdue}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
            <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
              {children}
            </div>
          </main>

          <footer className="border-t border-line px-4 py-5 md:px-8">
            <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
              <span>Kagusoftware</span>
              <span>Client portal</span>
            </div>
          </footer>
        </div>
      </div>
    </ToastProvider>
  );
}
