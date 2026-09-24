import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LoginForm } from "@/components/auth/login-form";
import { LanguageToggle } from "@/components/portal/language-toggle";
import { LOCALE_COOKIE, parseLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { AccentRule, RiseText } from "@/components/ui/rise-text";

export async function generateMetadata(): Promise<Metadata> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { title: dict(locale).signIn };
}

/**
 * The one route both audiences share.
 *
 * There is no route group or middleware splitting sign-in the way (app) and
 * (client) split everything after it — nobody has a principal yet, so there is
 * nothing to split on. That makes this the only page that has to read the
 * locale cookie without knowing who is on the other side of it.
 *
 * Reading it is safe for teammates because of the invariant lib/locale.ts
 * documents: only the client portal ever WRITES `kagu-locale`. A teammate has
 * no cookie, `parseLocale` returns the default "en", and this screen is
 * byte-identical to what it has always been.
 *
 * ── Why the toggle is here and not only in the portal ──────────────────────
 *
 * `signOut` redirects here, so this is the screen an Arabic client lands on
 * when they leave — and the root layout already sets `dir="rtl"` from their
 * cookie for every route, this one included. Without the strings below that
 * was a fully mirrored page containing nothing but English.
 *
 * The toggle covers the other half: a FIRST-TIME client has no cookie yet, so
 * they get the English left-to-right default and, without a switch on this
 * page, no way to change it — the portal's own toggle sits behind a login they
 * cannot read. It is the same argument as the portal shell's, one step
 * earlier: the language control has to work before any of the others can.
 *
 * The "KaguOs" wordmark stays Latin in both locales, like `alt="Kagu"` in
 * shell/logo.tsx — it is a brand mark, not a string.
 */
export default async function LoginPage() {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = dict(locale);

  return (
    // The front door gets the same display language as the intro it opens
    // onto: the wordmark rises out of its mask, the brand rule draws in, then
    // the form arrives. A brand surface, so the one soft glow is allowed.
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex justify-end">
          <LanguageToggle current={locale} label={t.language} />
        </div>
        {/* dir="ltr": the wordmark is a Latin brand mark in both locales. */}
        <h1
          dir="ltr"
          className="text-[clamp(44px,14vw,72px)] leading-[0.9] font-semibold uppercase tracking-[-0.055em] text-ink rtl:text-right"
        >
          <RiseText delay={80} duration={750}>KaguOs</RiseText>
        </h1>
        <AccentRule color="var(--primary)" delay={300} />
        <div className="motion-safe:animate-[page-in_450ms_var(--ease-mac)_380ms_both]">
          <p className="mb-6 mt-6 text-sm text-muted">{t.loginBlurb}</p>
          <LoginForm
            labels={{
              email: t.loginEmail,
              emailPlaceholder: t.loginEmailPlaceholder,
              password: t.loginPassword,
              submit: t.signIn,
              wrongCredentials: t.loginWrongCredentials,
            }}
          />
          <p className="mt-6 text-[calc(13px*var(--text-scale,1))] text-faint">
            {t.loginNoAccount}
          </p>
        </div>
      </div>
    </main>
  );
}
