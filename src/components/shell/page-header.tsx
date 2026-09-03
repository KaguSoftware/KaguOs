import { CURRENT_ACCENT } from "@/lib/section-accent";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      {/* The section's colour, as a rule down the left of the title. The
          sidebar answers "where am I" only while you're looking at it — on a
          narrow screen it isn't even on screen — so the answer is repeated
          here, at the one place every page starts. A 2px rule rather than a
          dot or a tinted heading: it reads as structure, and it leaves the
          title itself at full contrast.

          --section-accent is set per-route by SectionAccentScope, so no page
          has to pass its section down. Routes without one (/account) fall back
          to primary-dim, and the rule just looks like the app's own green. */}
      <div
        className="min-w-0 border-l-2 pl-3"
        style={{ borderColor: CURRENT_ACCENT }}
      >
        <h1 className="text-[calc(22px*var(--text-scale,1))] font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
