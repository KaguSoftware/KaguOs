import { accentForSection, accentMix, accentVar } from "@/lib/section-accent";
import { SECTION_LABELS, type Section } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A pill that names a SECTION — "which places can this account reach".
 *
 * Deliberately not a `tone` on Badge. Badge is the state vocabulary (green =
 * done, amber = in progress, red = urgent), and letting a place-colour in
 * through that door is how "orange" stops meaning one thing. A chip that
 * answers a different question gets a different component.
 *
 * `status` is a feature gate, not a destination, so it has no accent and
 * renders in the neutral outline — the same shape, honestly uncoloured.
 */
export function SectionChip({
  section,
  suffix,
  className,
}: {
  section: Section;
  /** e.g. "(view)" — a tier note, appended in the muted weight. */
  suffix?: string;
  className?: string;
}) {
  const accent = accentForSection(section);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-xs font-medium",
        !accent && "border-line-strong text-muted",
        className
      )}
      style={
        accent
          ? {
              borderColor: accentMix(accent, 30),
              backgroundColor: accentMix(accent, 10),
              color: accentVar(accent),
            }
          : undefined
      }
    >
      {SECTION_LABELS[section].replace("Kagu ", "")}
      {suffix && <span className="opacity-70">{suffix}</span>}
    </span>
  );
}
