import {
  ArrowUpRight,
  FileText,
  Globe,
  Link2,
  PenTool,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { projectLinkKindLabel, type PortalDict } from "@/lib/i18n";
import type { ProjectLink, ProjectLinkKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The one part of the portal that sends the reader somewhere else (0082).
 *
 * ── Why it is a list of rows and not a row of buttons ──────────────────────
 *
 * Because half of these links need a sentence before they are usable. "Open
 * the site" needs nothing; "install this on your phone" needs to say which
 * Apple ID we put on the invite and that TestFlight has to be installed first.
 * A row of pills would leave that paragraph nowhere to go, and the support
 * message that follows costs more than the space saved.
 *
 * ── Why the hostname is shown ──────────────────────────────────────────────
 *
 * The label is Kagu's words ("Your booking app"), so on its own it gives the
 * reader nothing to check before they click. `staging.touchpadel.com` or
 * `testflight.apple.com` underneath it is the difference between a link a
 * client opens and one they forward to somebody to ask if it is real. It is
 * also the only defence a reader has against a mislabelled row, which is worth
 * more than the tidiness of hiding it.
 *
 * ── Every row leaves the app ───────────────────────────────────────────────
 *
 * `target="_blank"` with `rel="noopener noreferrer"` — noopener because a page
 * opened with a live `window.opener` can navigate the portal tab elsewhere, and
 * on a phone the back button is how people expect to get back, which a
 * same-tab navigation to a third-party app then breaks. That the tab is new is
 * ANNOUNCED rather than merely done: `opensInNewTab` is inside the link's own
 * text, hidden visually, because a screen-reader user who is not told has no
 * way to work out where their focus went.
 *
 * ── Server component ───────────────────────────────────────────────────────
 *
 * No state and no handlers, so it takes the dictionary itself rather than the
 * bundle of pre-resolved strings the columns and the rail need. Nothing here
 * crosses to the browser.
 */

const KIND_ICONS: Record<ProjectLinkKind, LucideIcon> = {
  preview: Globe,
  install: Smartphone,
  design: PenTool,
  document: FileText,
  other: Link2,
};

/**
 * The bit of the address a human recognises, or null.
 *
 * Wrapped even though `urlOf` parsed the same string on the way in: this row
 * predates that validator on any link written before it, and a page that
 * throws on one bad hostname is a page that shows a client nothing at all.
 */
function hostOf(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

export type PortalLinkRow = {
  link: ProjectLink;
  /** The phase it belongs to, when it belongs to one and the client can see it. */
  systemTitle: string | null;
};

/**
 * The links, as the client reads them.
 *
 * `heading` is what the caller wants above the list — the progress page gives
 * it the full panel treatment, the dashboard card asks for none and gets a
 * bare list under its own heading.
 */
export function PortalLinks({
  rows,
  t,
  compact = false,
  className,
}: {
  rows: PortalLinkRow[];
  t: PortalDict;
  /** The dashboard card's version: no detail paragraph, tighter rows. */
  compact?: boolean;
  className?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <ul className={cn("grid", compact ? "gap-1" : "gap-2", className)}>
      {rows.map(({ link, systemTitle }) => {
        const Icon = KIND_ICONS[link.kind] ?? Link2;
        const host = hostOf(link.url);
        return (
          <li key={link.id}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group flex items-start gap-3 rounded-lg border border-line bg-surface transition-colors duration-150 hover:border-line-strong hover:bg-raised/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                compact ? "px-3 py-2" : "px-4 py-3"
              )}
            >
              <Icon
                className="mt-0.5 size-4 shrink-0 text-primary-dim"
                aria-hidden
              />

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {/* Kagu's words, usually Latin, routinely inside an Arabic
                      page — <bdi> so the neutral characters around it do not
                      drift to the wrong end of the line. */}
                  <bdi className="text-[calc(14px*var(--text-scale,1))] font-medium text-ink">
                    {link.label}
                  </bdi>
                  {!compact && (
                    <Badge tone="faint">{projectLinkKindLabel(t, link.kind)}</Badge>
                  )}
                </span>

                {!compact && link.detail && (
                  <span
                    dir="auto"
                    className="mt-1 block max-w-[70ch] whitespace-pre-wrap text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted"
                  >
                    {link.detail}
                  </span>
                )}

                {/* The address and the phase it belongs to. Separate nodes with
                    a gap doing the separating rather than a " · " welded into
                    the text: a middot is bidi-neutral and lands at the wrong
                    end of an Arabic line. */}
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[calc(11px*var(--text-scale,1))] text-faint rtl:font-sans">
                  {host && <bdi className="truncate">{host}</bdi>}
                  {systemTitle && <bdi>{t.partOf(systemTitle)}</bdi>}
                </span>

                <span className="sr-only"> ({t.opensInNewTab})</span>
              </span>

              <ArrowUpRight
                className="mt-0.5 size-4 shrink-0 text-faint transition-colors duration-150 group-hover:text-ink"
                aria-hidden
              />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A project's published links, paired with the phase each one hangs off.
 *
 * The phase title is resolved from the milestones the CLIENT can see, so a link
 * attached to an unpublished phase loses its tag rather than naming something
 * the reader has no other evidence of. The link itself still shows — it was
 * published on its own merits, and the tag is context, not permission.
 */
export function portalLinkRows(
  links: ProjectLink[],
  milestones: { id: string; title: string }[]
): PortalLinkRow[] {
  const titles = new Map(milestones.map((m) => [m.id, m.title]));
  return links.map((link) => ({
    link,
    systemTitle: link.milestone_id ? (titles.get(link.milestone_id) ?? null) : null,
  }));
}
