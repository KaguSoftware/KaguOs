import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { loadPortal } from "@/lib/data/portal";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressMeter } from "@/components/portal/progress-meter";
import { formatRelativeIn } from "@/lib/utils";
import { LOCALE_COOKIE, parseLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { title: dict(locale).yourInputs };
}

/**
 * One input pack per business.
 *
 * This page exists only when a client has MORE than one — a chooser listing
 * exactly one card is a click that teaches nothing, so a single-business
 * account goes straight through to its pack. The rail's "Inputs" item still
 * highlights afterwards, because /portal/inputs is a prefix of where they land.
 */
export default async function PortalInputsIndexPage() {
  const portal = await loadPortal();
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = dict(locale);

  if (portal.projects.length === 1) {
    redirect(`/portal/inputs/${portal.projects[0].id}`);
  }

  return (
    <>
      <PageHeader
        title={t.yourInputs}
        description={t.inputsBlurb}
      />

      {portal.projects.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={Building2}
            title={t.nothingSharedTitle}
            hint={t.nothingSharedHint}
          />
        </div>
      ) : (
        <ul className="grid gap-3">
          {portal.projects.map((project) => {
            const summary = portal.intake.get(project.id);
            const pct = summary?.progress.pct ?? 0;
            const sent = summary?.submittedAt ?? null;
            return (
              <li key={project.id}>
                <Link
                  href={`/portal/inputs/${project.id}`}
                  className="group block rounded-lg border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong hover:bg-raised/30"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    {/* Staff-typed and with no Arabic column, so `dir="auto"` takes the
                        direction from the first strong character: an English
                        trading name still reads left-to-right on an Arabic page. */}
                    <p dir="auto" className="min-w-0 text-sm font-medium text-ink">
                      {project.name}
                    </p>
                    <p className="flex items-center gap-1.5 font-mono text-xs text-faint rtl:font-sans">
                      {sent ? (
                        <>
                          <CheckCircle2 className="size-3.5 text-primary-dim" aria-hidden />
                          {t.sentAgo(formatRelativeIn(locale, sent, t.justNow))}
                        </>
                      ) : (
                        <>
                          {t.filledIn(pct)}
                          <ArrowRight
                            className="size-3.5 -translate-x-1 rtl:translate-x-1 opacity-0 transition-[opacity,transform] duration-200 ease-mac group-hover:translate-x-0 group-hover:opacity-100 rtl:rotate-180"
                            aria-hidden
                          />
                        </>
                      )}
                    </p>
                  </div>
                  <div className="mt-3">
                    <ProgressMeter
                      pct={pct}
                      done={summary?.progress.done ?? 0}
                      total={summary?.progress.total ?? 0}
                      label={t.packProgressAria(project.name)}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
