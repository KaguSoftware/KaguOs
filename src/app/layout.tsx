import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
