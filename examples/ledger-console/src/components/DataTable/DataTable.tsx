/**
 * DataTable — captured by emdesign.
 * Reusable, design-system-bound component. Edit freely; re-capture to update.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Badge } from '@ds';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  pageSize?: number;
  emptyMessage?: string;
}

type SortDir = 'asc' | 'desc' | null;

const SortIcon = ({ dir }: { dir: SortDir }) => {
  const base = 'inline-block ml-1.5 text-text-muted dark:text-text-muted';
  if (dir === 'asc') return <span className={base}>{'↑'}</span>;
  if (dir === 'desc') return <span className={base}>{'↓'}</span>;
  return <span className={`${base} opacity-40`}>{'↕'}</span>;
};

/**
 * Swiss-grid data table: hairline borders, zero radius, no shadows.
 * Sortable columns, zebra-striped rows (even = surface-raised),
 * ink header rule (2px), pagination, and an empty state.
 *
 * Token roles only -- no raw hex. Dark: variants for every color utility.
 */
function DataTableInner<T extends Record<string, any>>({
  columns,
  rows,
  pageSize = 10,
  emptyMessage = 'No data to display',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(0);

  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((prevDir) => {
          if (prevDir === 'asc') return 'desc';
          if (prevDir === 'desc') return null;
          return 'asc';
        });
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const sortedRows = useMemo(() => {
    if (!sortKey || !sortDir) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  // ── Empty state ────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="border border-border dark:border-border bg-surface-raised dark:bg-surface-raised">
        <div className="flex items-center justify-center py-16">
          <span className="text-text-muted dark:text-text-muted text-sm font-[var(--font-sans)]">
            {emptyMessage}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border dark:border-border bg-surface-raised dark:bg-surface-raised">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* ── Header row ──────────────────────────────────── */}
          <thead>
            <tr className="border-b-2 border-accent dark:border-accent">
              {columns.map((col) => {
                const canSort = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    className={
                      'px-4 py-3 text-left align-bottom ' +
                      'font-[var(--font-sans)] text-xs font-semibold uppercase tracking-[0.14em] ' +
                      'text-text-muted dark:text-text-muted ' +
                      (canSort ? 'cursor-pointer select-none hover:text-text dark:hover:text-text' : '')
                    }
                    onClick={() => canSort && handleSort(col.key)}
                    scope="col"
                  >
                    {col.label}
                    {canSort && <SortIcon dir={sortKey === col.key ? sortDir : null} />}
                  </th>
                );
              })}
            </tr>
          </thead>
          {/* ── Body rows (zebra striping) ──────────────────── */}
          <tbody>
            {pageRows.map((row, rowIdx) => {
              const globalIdx = currentPage * pageSize + rowIdx;
              return (
                <tr
                  key={(row as any).id ?? globalIdx}
                  className={
                    (globalIdx % 2 === 0
                      ? 'bg-surface-raised dark:bg-surface-raised'
                      : 'bg-surface dark:bg-surface') +
                    ' border-b border-border dark:border-border ' +
                    'transition-colors duration-[var(--motion-fast)]'
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-3 text-text dark:text-text font-[var(--font-sans)]"
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border dark:border-border">
        <span className="text-xs text-text-muted dark:text-text-muted font-[var(--font-sans)] tabular-nums">
          Page {currentPage + 1} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className={
              'px-3 py-1.5 text-xs font-[var(--font-sans)] font-semibold ' +
              'text-text dark:text-text ' +
              'border border-border dark:border-border ' +
              'bg-transparent dark:bg-transparent ' +
              'hover:bg-surface dark:hover:bg-surface ' +
              'disabled:opacity-45 disabled:pointer-events-none ' +
              'transition-[background-color] duration-[var(--motion-fast)]'
            }
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className={
              'px-3 py-1.5 text-xs font-[var(--font-sans)] font-semibold ' +
              'text-text dark:text-text ' +
              'border border-border dark:border-border ' +
              'bg-transparent dark:bg-transparent ' +
              'hover:bg-surface dark:hover:bg-surface ' +
              'disabled:opacity-45 disabled:pointer-events-none ' +
              'transition-[background-color] duration-[var(--motion-fast)]'
            }
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// Preserve generic type parameter across module boundaries via a named export.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
export const DataTable = DataTableInner as <T extends Record<string, any>>(
  props: DataTableProps<T>,
) => React.ReactElement;
