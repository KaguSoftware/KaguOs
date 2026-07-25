import { Skeleton } from "@/components/ui/skeleton";

/** Widths that read as conversation rather than as a list of equal blocks. */
const BUBBLES: { mine: boolean; w: string }[] = [
  { mine: false, w: "w-48" },
  { mine: true, w: "w-32" },
  { mine: true, w: "w-56" },
  { mine: false, w: "w-40" },
  { mine: false, w: "w-64" },
  { mine: true, w: "w-24" },
  { mine: false, w: "w-52" },
];

/**
 * The thread pane while it loads.
 *
 * Before this existed the segment fell through to `(app)/loading.tsx`, which is
 * deliberately generic — a page header plus three big blocks, i.e. the shape of
 * the dashboard. So opening a chat, and every switch between chats, flashed a
 * silhouette that looked nothing like the thing arriving. Because the
 * conversation list now lives in the layout, this boundary replaces only the
 * right-hand pane and the list beside it never blinks.
 */
export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line pb-3">
        <Skeleton className="size-8 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 py-4">
        {BUBBLES.map((b, i) => (
          <div
            key={i}
            className={b.mine ? "flex justify-end" : "flex justify-start"}
          >
            <Skeleton className={`h-9 ${b.w} rounded-lg`} />
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2 border-t border-line pt-3">
        <Skeleton className="size-9 rounded-md" />
        <Skeleton className="h-9 flex-1 rounded-md" />
        <Skeleton className="size-9 rounded-md" />
      </div>
    </div>
  );
}
