import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getSessionContext, canAccess } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { SECTION_LABELS, type Section } from "@/lib/types";

const SECTION_CARDS: {
  section: Section;
  href: string;
  blurb: string;
}[] = [
  { section: "debug", href: "/debug", blurb: "Open tasks — see what's left, claim what you want." },
  { section: "work", href: "/work", blurb: "Projects and the ideas board." },
  { section: "learn", href: "/learn", blurb: "Learning sprints and your progress." },
  { section: "management", href: "/management/transactions", blurb: "Ledger and contracts." },
  { section: "marketing", href: "/marketing", blurb: "Shared links and notes — more coming." },
];

export default async function DashboardPage() {
  const ctx = await getSessionContext();
  const cards = SECTION_CARDS.filter((c) => canAccess(ctx, c.section));
  const firstName = ctx.profile.full_name?.split(" ")[0] ?? ctx.profile.email;

  return (
    <>
      <PageHeader
        title={`Hey, ${firstName}`}
        description="Everything Kagu runs on, in one quiet place."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.section}
            href={card.href}
            className="group rounded-lg border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong hover:bg-raised"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{SECTION_LABELS[card.section]}</h2>
              <ArrowUpRight
                className="size-4 text-faint transition-colors duration-150 group-hover:text-primary-dim"
                aria-hidden
              />
            </div>
            <p className="mt-1 text-[13px] text-muted">{card.blurb}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
