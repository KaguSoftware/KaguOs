import { signOut } from "@/lib/actions/account";
import { Logo } from "@/components/shell/logo";

/**
 * The portal's whole chrome: who you are, whose account you're looking at, and
 * the way out. One row.
 *
 * The client's OWN name is the heading and Kagu's mark is the small mark beside
 * it, which is the right way round — they are visiting their account, not ours.
 * There is no navigation because the portal has one page; adding a nav bar with
 * a single item would be furniture pretending to be structure.
 */
export function PortalHeader({
  clientName,
  personName,
}: {
  clientName: string;
  personName: string | null;
}) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3.5 md:px-8">
        <Logo size={22} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{clientName}</p>
          {personName && (
            <p className="truncate text-xs text-faint">Signed in as {personName}</p>
          )}
        </div>
        {/*
          A plain server-action form, not the app's Button component: this is
          the only interactive control on the page for most visits, and it must
          work before any JavaScript has loaded. The styling matches the ghost
          button so it doesn't look like a stray link.
        */}
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex h-7 shrink-0 items-center rounded-md px-2.5 text-[calc(13px*var(--text-scale,1))] text-muted transition-colors duration-150 ease-mac hover:bg-raised hover:text-ink active:scale-[0.98]"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
