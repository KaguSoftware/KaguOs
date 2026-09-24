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
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      {/* Display type, StaggeredMenu-style: the title rises out of its own
          mask on every route change (template.tsx remounts the page), and the
          section's colour draws in beneath it as a short rule.

          The rule repeats "where am I" at the one place every page starts —
          the sidebar answers it only while you're looking at it, and on a
          narrow screen it isn't on screen at all. It sits under the title, not
          on it, so the title keeps full contrast.

          --section-accent is set per-route by SectionAccentScope, so no page
          has to pass its section down. Routes without one (/account) fall back
          to primary-dim, and the rule just looks like the app's own green. */}
      <div className="min-w-0">
        {/* pb gives descenders room so the mask doesn't clip them. */}
        <div className="overflow-hidden pb-[0.12em]">
          <h1 className="origin-bottom text-[calc(34px*var(--text-scale,1))] leading-[1.02] font-semibold tracking-[-0.04em] text-balance md:text-[calc(48px*var(--text-scale,1))] motion-safe:animate-[line-rise_650ms_var(--ease-mac)_both]">
            {title}
          </h1>
        </div>
        <span
          aria-hidden
          className="mt-3 block h-[3px] w-12 origin-left rounded-full motion-safe:animate-[wipe-x_500ms_var(--ease-mac)_180ms_both]"
          style={{ backgroundColor: CURRENT_ACCENT }}
        />
        {description && (
          <p className="mt-3 text-sm text-muted motion-safe:animate-[page-in_400ms_var(--ease-mac)_260ms_both]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
