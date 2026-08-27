import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireClientProject } from "@/lib/data/session";
import { getIntakePack } from "@/lib/data/intake";
import { loadPortal } from "@/lib/data/portal";
import { BusinessTabs } from "@/components/portal/bits";
import { IntakeForm } from "@/components/portal/intake-form";
import { LOCALE_COOKIE, parseLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { title: dict(locale).yourInputPack };
}

/**
 * One business's input pack.
 *
 * The FORM below is untouched by the portal's restructuring — it is the thing
 * the client actually has to fill in, it saves on blur, and its questions come
 * from whichever pack the project is on (0073). Everything this page adds is
 * around it: a way to get to the other business's pack without going back to a
 * list.
 *
 * No PageHeader: the form owns its own sticky header, which carries the project
 * name, the meter and the save state together, and says the saves-as-you-type
 * line once on its first step. Two stacked headings competing for the top of a
 * long form was part of what made this hard to read.
 */
export default async function PortalInputsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  // The tenant check, once, above everything. The database refuses the rows
  // independently (0072 §4) — this is what turns "no rows" into "that isn't
  // yours" instead of an input pack that mysteriously has no answers in it.
  const ctx = await requireClientProject(projectId);
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = dict(locale);

  // The pack key comes from `my_client_projects()` — a client cannot read
  // `projects`, which is where the column lives (0072 §2 / 0073). So the project
  // lookup has to land BEFORE the pack fetch rather than beside it: one extra
  // round-trip, and the alternative is rendering the wrong questionnaire.
  //
  // It costs nothing here — the layout above has already loaded it, and
  // loadPortal() is cache()d per request.
  const portal = await loadPortal();

  // Guarded above, so this only fires if the project was deleted between the
  // session context being built and this query running.
  const project = portal.projects.find((p) => p.id === projectId);
  if (!project) notFound();

  const pack = await getIntakePack(ctx, projectId, project.intake_pack);

  return (
    <>
      <BusinessTabs
        businesses={portal.projects}
        activeId={projectId}
        hrefFor={(id) => `/portal/inputs/${id}`}
        label={t.yourBusinesses}
      />

      <IntakeForm
        projectId={projectId}
        projectName={project.name}
        pack={pack.pack}
        initialAnswers={pack.answers}
        initialRows={pack.rows}
        initialSubmittedAt={pack.header?.submitted_at ?? null}
        locale={locale}
        intro={t.packBlurb}
        // Three bundles of already-resolved words, built here because this is
        // where the cookie is read. The date picker, buildChecks and
        // useAction's catch all sit below the form and take plain strings, so
        // the words have to be handed down rather than looked up — same reason
        // `intro` above is a string and not a dictionary key.
        dateLabels={{
          placeholder: t.datePlaceholder,
          clearDate: t.dateClearAria,
          calendar: t.dateCalendarAria,
          prevMonth: t.datePrevMonth,
          nextMonth: t.dateNextMonth,
          today: t.dateToday,
          clear: t.dateClear,
        }}
        checkNotes={{
          lineCount: t.lineCount,
          linesIncomplete: t.linesIncomplete,
          stillToAnswer: t.stillToAnswer,
        }}
        toastGeneric={t.toastGeneric}
      />
    </>
  );
}
