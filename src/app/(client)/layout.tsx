import { cookies } from "next/headers";
import { loadPortal, portalCounts } from "@/lib/data/portal";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { LanguageToggle } from "@/components/portal/language-toggle";
import { LOCALE_COOKIE, parseLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { TEXT_SIZE_COOKIE, parseTextSize, textScaleCss } from "@/lib/text-size";
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
 *
 * ── Language ───────────────────────────────────────────────────────────────
 *
 * One toggle, in the rail's header row, and everything below it answers — the
 * chrome from `lib/i18n.ts`, the questions from the pack's own `*Ar` halves.
 * `dir` is set on `<html>` by the root layout rather than here, because toasts
 * and popovers portal into `document.body` and would otherwise stay
 * left-to-right on a right-to-left page. See src/app/layout.tsx.
 *
 * The rail itself is a client component, so it cannot be handed the dictionary
 * — half of it is functions. It gets a bundle of already-resolved strings; see
 * `PortalNavLabels`.
 *
 * ── Why the text scale is injected here too ────────────────────────────────
 *
 * It wasn't, and that was a real bug rather than an omission: every font size
 * in the app is written as a fraction of `--text-scale` (globals.css), the
 * `(app)` layout sets it from a cookie, and this layout set nothing — so the
 * variable fell back to 1 and a client had no way to make the text bigger. The
 * teammate with a 27" monitor could; the business owner filling in a nine
 * section form on a tablet could not. Same cookie, same server-side read, so
 * the first paint is already the right size.
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const portal = await loadPortal();
  const counts = portalCounts(portal, todayInIstanbul());
  const profile = portal.ctx.profile;

  const jar = await cookies();
  const locale = parseLocale(jar.get(LOCALE_COOKIE)?.value);
  const textSize = parseTextSize(jar.get(TEXT_SIZE_COOKIE)?.value);
  const t = dict(locale);

  return (
    <ToastProvider>
      <style>{textScaleCss(textSize)}</style>

      <a
        href="#main"
        className="sr-only start-4 top-4 z-50 rounded-md border border-line-strong bg-raised px-3 py-2 text-[calc(14px*var(--text-scale,1))] text-ink focus-visible:not-sr-only focus-visible:fixed"
      >
        {t.skipToContent}
      </a>

      <div className="flex min-h-dvh flex-col md:flex-row">
        <PortalSidebar
          labels={{
            dashboardAria: t.dashboardAria,
            portalNav: t.portalNav,
            menu: t.menu,
            openMenu: t.openMenu,
            closeMenu: t.closeMenu,
            yourAccount: t.yourAccount,
            accountAria: t.accountAria(profile.full_name || profile.email),
            signOut: t.signOut,
            navDashboard: t.navDashboard,
            navDashboardHint: t.navDashboardHint,
            navInputs: t.navInputs,
            navInputsHint: t.navInputsHint,
            navProgress: t.navProgress,
            navProgressHint: t.navProgressHint,
            navFinance: t.navFinance,
            navFinanceHint: t.navFinanceHint,
          }}
          name={profile.full_name}
          email={profile.email}
          packsOpen={counts.packsOpen}
          overdue={counts.overdue}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* The toggle sits above the page rather than in the rail's body: it
              has to be visible at every width, and on mobile the rail collapses
              into a menu button. A client who cannot read the interface cannot
              find a language switch hidden behind a menu — it is the one
              control that has to work before any of the others can. */}
          <div className="flex justify-end px-4 pt-4 md:px-8 md:pt-6">
            <LanguageToggle current={locale} label={t.language} />
          </div>

          <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
            <div className="mx-auto w-full max-w-5xl px-4 pb-6 pt-4 md:px-8 md:pb-10">
              {children}
            </div>
          </main>

          <footer className="border-t border-line px-4 py-5 md:px-8">
            <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
              <span>{t.footerOwner}</span>
              <span>{t.footerWhat}</span>
            </div>
          </footer>
        </div>
      </div>
    </ToastProvider>
  );
}
