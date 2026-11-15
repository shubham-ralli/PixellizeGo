import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ReactNode, useEffect, useMemo, useState } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  cellClassName?: string;
}

type Key = string | number;

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => Key;
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (row: T) => void;

  /** Bulk selection. */
  selectable?: boolean;
  /** Rendered when ≥1 row is selected. Receives selected ids + a clear() helper. */
  bulkActions?: (ids: Key[], clear: () => void) => ReactNode;

  /** Enables the right-aligned search box; return the text to match against. */
  search?: (row: T) => string;
  searchPlaceholder?: string;

  /** Left side of the toolbar (tabs, filters…). */
  toolbarLeft?: ReactNode;

  /** Rows per page (default 10). */
  pageSize?: number;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyText = "Nothing here yet.",
  onRowClick,
  selectable,
  bulkActions,
  search,
  searchPlaceholder = "Search…",
  toolbarLeft,
  pageSize = 10,
}: DataTableProps<T>) {
  const [selected, setSelected] = useState<Set<Key>>(new Set());
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const idsKey = rows.map(rowKey).join(",");
  // Reset selection + page whenever the underlying data changes (reload, filter).
  useEffect(() => {
    setSelected(new Set());
    setPage(0);
  }, [idsKey]);

  const filtered = useMemo(() => {
    if (!search || !query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => search(r).toLowerCase().includes(q));
  }, [rows, search, query]);

  useEffect(() => setPage(0), [query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const start = current * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  const pageKeys = pageRows.map(rowKey);
  const allChecked = !!selectable && pageRows.length > 0 && pageKeys.every((k) => selected.has(k));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pageKeys.forEach((k) => next.delete(k));
      else pageKeys.forEach((k) => next.add(k));
      return next;
    });
  const toggleOne = (k: Key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  const clear = () => setSelected(new Set());
  const colSpan = columns.length + (selectable ? 1 : 0);

  const showToolbar = toolbarLeft || search || (selectable && bulkActions);

  return (
    <div>
      {showToolbar && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {toolbarLeft}
            {selectable && selected.size > 0 && bulkActions && (
              <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm dark:border-brand-500/30 dark:bg-brand-500/10">
                <span className="text-gray-600 dark:text-gray-300">{selected.size} selected</span>
                {bulkActions([...selected], clear)}
              </div>
            )}
          </div>
          {search && (
            <div className="ml-auto">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 w-64 max-w-full"
              />
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <tr>
              {selectable && (
                <th className="w-10 px-5 py-3">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={`px-5 py-3 font-medium ${alignClass[c.align ?? "left"]}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={colSpan} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={colSpan} className="px-5 py-8 text-center text-gray-400">{query ? "No matches." : emptyText}</td></tr>
            ) : (
              pageRows.map((row) => {
                const k = rowKey(row);
                return (
                  <tr
                    key={k}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`text-gray-700 dark:text-gray-300 ${onRowClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5" : ""}`}
                  >
                    {selectable && (
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(k)} onChange={() => toggleOne(k)} aria-label="Select row" />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={`px-5 py-3 ${alignClass[c.align ?? "left"]} ${c.cellClassName ?? ""}`}>
                        {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {filtered.length === 0 ? "0 items" : `${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length}`}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <Button size="xs" variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>Prev</Button>
            <span>Page {current + 1} of {pageCount}</span>
            <Button size="xs" variant="outline" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}
