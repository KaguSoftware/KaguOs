"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * URL-backed filter state for the Work tabs. Each tab namespaces its params
 * (e.g. `p_status`, `i_sort`) so Projects and Ideas filters coexist in one URL
 * and survive tab switches. Filtering itself is client-side — the panels already
 * hold every row (see the "fetch all, switch client-side" pattern in HANDOFF) —
 * so changing a filter never hits the network; we only rewrite the query string
 * with replaceState for shareable, refresh-proof links.
 */
export type FilterState = {
  q: string;
  status: string; // "" = all
  sector: string;
  type: string;
  owner: string; // "" = anyone, "me" = mine
  sort: string;
};

export function useWorkFilters(prefix: string, defaultSort: string) {
  const params = useSearchParams();
  const pathname = usePathname();
  const key = (k: string) => `${prefix}_${k}`;

  const state: FilterState = {
    q: params.get(key("q")) ?? "",
    status: params.get(key("status")) ?? "",
    sector: params.get(key("sector")) ?? "",
    type: params.get(key("type")) ?? "",
    owner: params.get(key("owner")) ?? "",
    sort: params.get(key("sort")) ?? defaultSort,
  };

  const set = useCallback(
    (patch: Partial<FilterState>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        const full = key(k);
        // Drop defaults from the URL so a clean state has a clean link.
        if (!v || (k === "sort" && v === defaultSort)) next.delete(full);
        else next.set(full, v);
      }
      const qs = next.toString();
      // replaceState (not router.push) keeps it a pure client update — no
      // navigation, no server round-trip, consistent with the instant tabs.
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, pathname, prefix, defaultSort]
  );

  const active =
    Boolean(state.q || state.status || state.sector || state.type || state.owner);

  const clear = useCallback(() => {
    set({ q: "", status: "", sector: "", type: "", owner: "" });
  }, [set]);

  return { state, set, active, clear };
}

/** A small pill toggle row — used for status filters and the owner toggle. */
export function ChipRow({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value || "all"}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected && opt.value ? "" : opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors duration-150",
              selected
                ? "border-primary/40 bg-primary/10 text-primary-dim"
                : "border-line text-muted hover:border-line-strong hover:text-ink"
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={cn(
                  "font-mono tabular-nums text-[11px]",
                  selected ? "text-primary-dim" : "text-faint"
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The full filter toolbar: search + status chips + sector/type/owner/sort
 * dropdowns + a clear affordance. Composable — callers pass the option lists
 * that make sense for their tab (Projects vs Ideas differ on status + sort).
 */
export function FilterBar({
  filters,
  statusOptions,
  sectorOptions,
  typeOptions,
  sortOptions,
  showOwner,
  searchPlaceholder,
  resultCount,
  totalCount,
}: {
  filters: ReturnType<typeof useWorkFilters>;
  statusOptions: { value: string; label: string; count?: number }[];
  sectorOptions: DropdownOption[];
  typeOptions: DropdownOption[];
  sortOptions: DropdownOption[];
  showOwner: boolean;
  searchPlaceholder: string;
  resultCount: number;
  totalCount: number;
}) {
  const { state, set, active, clear } = filters;

  const sectorWithAll = useMemo(
    () => [{ value: "", label: "All sectors" }, ...sectorOptions],
    [sectorOptions]
  );
  const typeWithAll = useMemo(
    () => [{ value: "", label: "All types" }, ...typeOptions],
    [typeOptions]
  );

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <Input
            value={state.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder={searchPlaceholder}
            aria-label="Search"
            className="pl-8"
          />
        </div>
        <Dropdown
          options={sortOptions}
          value={state.sort}
          onChange={(v) => set({ sort: v })}
          className="w-44"
        />
        <Dropdown
          options={sectorWithAll}
          value={state.sector}
          onChange={(v) => set({ sector: v })}
          placeholder="All sectors"
          className="w-40"
        />
        <Dropdown
          options={typeWithAll}
          value={state.type}
          onChange={(v) => set({ type: v })}
          placeholder="All types"
          className="w-40"
        />
        {showOwner && (
          <Dropdown
            options={[
              { value: "", label: "Anyone" },
              { value: "me", label: "Mine" },
            ]}
            value={state.owner}
            onChange={(v) => set({ owner: v })}
            className="w-32"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChipRow
          options={statusOptions}
          value={state.status}
          onChange={(v) => set({ status: v })}
          ariaLabel="Filter by status"
        />
        <div className="flex items-center gap-3">
          {active && (
            <span className="font-mono text-[11px] tabular-nums text-faint">
              {resultCount} / {totalCount}
            </span>
          )}
          {active && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors duration-150 hover:text-ink"
            >
              <X className="size-3" aria-hidden />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
