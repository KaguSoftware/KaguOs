import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { cookies } from "next/headers";
import { dict } from "@/lib/i18n";
import { LOCALE_COOKIE, dirFor, parseLocale } from "@/lib/locale";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Neither Geist face has a single Arabic glyph, so before this an Arabic
 * portal page fell through to whatever the OS happened to pick — Geeza Pro on
 * a Mac, Segoe UI on Windows, something else again on Android — and was set in
 * a different typeface from its English twin, at a different apparent size.
 *
 * The variable only PUBLISHES the family; where it actually enters the font
 * stack is decided in globals.css, behind `[dir="rtl"]`. That gate is not
 * belt-and-braces: next/font asks Google for a family and gets back @font-face
 * blocks for every subset that family publishes — latin, math and symbols
 * included — regardless of `subsets` below, which only chooses what gets
 * preloaded. Left ungated in the shared stack, Noto's symbols face would sit
 * ahead of system-ui in the always-English `(app)` shell and restyle
 * characters like → and ▲ there.
 *
 * No `weight` and no `axes`: it is a variable font, and next/font's default
 * for one is the weight axis alone. The family also carries a `wdth` axis,
 * deliberately left out — it would enlarge the file for a width nothing here
 * asks for.
 */
const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
});

/**
 * `generateMetadata` rather than a static `metadata`, for the reason the
 * dashboard's own copy of this gives: the tab title and the description are
 * chrome like everything else, and a client reading Arabic should not be left
 * with an English one. Reading the cookie here costs nothing — the layout
 * below already reads it on the same request.
 *
 * `title.template` stays Latin on purpose. It is a brand join, and "%s ·
 * KaguOs" reads correctly in both directions because the browser lays the tab
 * title out with the document's own direction.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return {
    title: {
      default: "KaguOs",
      template: "%s · KaguOs",
    },
    description: dict(locale).appDescription,
  };
}

/**
 * There was no viewport export at all, so `interactive-widget` fell back to
 * `resizes-visual`: the LAYOUT viewport does not shrink when a phone's software
 * keyboard opens. Any full-height surface therefore drew its bottom edge behind
 * the keyboard — most visibly the chat composer, which landed roughly 300px
 * below the visible region the moment you tapped it. `dvh` does not help; it
 * tracks browser chrome, not the keyboard.
 *
 * `resizes-content` shrinks the layout viewport with the keyboard, which makes
 * every existing `100dvh` calculation correct for free.
 *
 * Deliberately NOT setting maximumScale/userScalable (the doc's example shows
 * them together): disabling pinch-zoom fails WCAG 1.4.4, and this app commits to
 * AA.
 */
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

/**
 * `lang` and `dir` are decided HERE, on `<html>`, rather than on a wrapper
 * inside the client portal.
 *
 * The portal's transient surfaces — toasts, the date picker's popover, the
 * lightbox — `createPortal` into `document.body`, which is outside every
 * wrapper this app has. Setting the direction on a div inside the portal layout
 * would leave a right-to-left page whose menus and toasts still opened
 * left-to-right, which is a worse bug than not translating them at all.
 *
 * Only the client portal ever writes `kagu-locale` (the toggle exists nowhere
 * else), so a teammate's app is English and LTR regardless of what this reads.
 * The team's own view of a client's pack uses a separate content-only
 * preference — see lib/intake-lang.ts.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
