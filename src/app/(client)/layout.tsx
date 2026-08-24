import Link from "next/link";
import { cookies } from "next/headers";
import { LogOut, UserRound } from "lucide-react";
import { requireClient } from "@/lib/data/session";
import { signOut } from "@/lib/actions/account";
import { Logo } from "@/components/shell/logo";
import { ToastProvider } from "@/components/ui/toast";
import { LanguageToggle } from "@/components/portal/language-toggle";
import { LOCALE_COOKIE, parseLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { TEXT_SIZE_COOKIE, parseTextSize, textScaleCss } from "@/lib/text-size";

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
 * `requireClient()` is the only door in, and it runs before anything renders. A
 * member who follows a /portal link is sent to their own home rather than shown
 * an empty portal — the two shells are exclusive, in both directions.
 *
 * The database agrees independently: a client fails all four gate functions
 * (0062 §4), so even a routing mistake that landed one on a teammate page would
 * render an empty page rather than the company's data.
 *
 * ── Language ───────────────────────────────────────────────────────────────
 *
 * One toggle, in the bar, and everything below it answers — the chrome from
 * `lib/i18n.ts`, the questions from the pack's own `*Ar` halves. `dir` is set
 * on `<html>` by the root layout rather than here, because toasts and popovers
 * portal into `document.body` and would otherwise stay left-to-right on a
 * right-to-left page. See src/app/layout.tsx.
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
  const ctx = await requireClient();
  const jar = await cookies();
  const locale = parseLocale(jar.get(LOCALE_COOKIE)?.value);
  const textSize = parseTextSize(jar.get(TEXT_SIZE_COOKIE)?.value);
  const t = dict(locale);
  const name = ctx.profile.full_name || ctx.profile.email;

  return (
    <ToastProvider>
      <style>{textScaleCss(textSize)}</style>

      <a
        href="#main"
        className="sr-only start-4 top-4 z-50 rounded-md border border-line-strong bg-raised px-3 py-2 text-[calc(14px*var(--text-scale,1))] text-ink focus-visible:not-sr-only focus-visible:fixed"
      >
        {t.skipToContent}
      </a>

      <div className="flex min-h-dvh flex-col">
        {/* One bar, not a rail. A client has one destination and a way out of
            it; a sidebar would be six-sevenths empty and would imply there is
            more of the app to find. */}
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 md:px-8">
            <Link
              href="/portal"
              aria-label={t.yourProjectsAria}
              className="flex items-center gap-2.5 rounded-md transition-opacity duration-150 hover:opacity-80"
            >
              <Logo size={22} />
              <span className="text-[calc(15px*var(--text-scale,1))] font-semibold tracking-tight">
                KaguOs
              </span>
            </Link>

            {/* The toggle sits before the account controls and stays visible at
                every width. A client who cannot read the interface cannot find
                a language switch hidden behind a menu — it is the one control
                that has to work before any of the others can. */}
            <div className="ms-auto flex items-center gap-2">
              <LanguageToggle current={locale} label={t.language} />

              <span className="hidden min-w-0 max-w-[16ch] truncate text-[calc(13px*var(--text-scale,1))] text-faint md:block">
                {name}
              </span>

              <Link
                href="/portal/account"
                aria-label={t.yourAccount}
                title={t.yourAccount}
                className="rounded-md p-2 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
              >
                <UserRound className="size-4" aria-hidden />
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label={t.signOut}
                  title={t.signOut}
                  className="rounded-md p-2 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
                >
                  <LogOut className="size-4" aria-hidden />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
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
    </ToastProvider>
  );
}
