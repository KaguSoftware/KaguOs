import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
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

export const metadata: Metadata = {
  title: {
    default: "KaguOs",
    template: "%s · KaguOs",
  },
  description: "Kagu's internal system",
};

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
