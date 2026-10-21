import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Shown as the card title on narrow screens. */
  primary?: boolean;
}

/**
 * Wide table on ≥ md; stacked cards with labelled rows on small screens (no horizontal scrolling,
 * and the data stays readable with screen readers on both layouts).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
}) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  return (
    <>
      <div className="hidden overflow-x-auto rounded-(--radius-panel) border border-line bg-surface md:block">
        <table className="w-full border-collapse text-start">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-ink-50 text-sm text-muted">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn('px-4 py-3 text-start font-medium', c.className)}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-t border-line align-middle hover:bg-ink-50/60"
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="rounded-(--radius-panel) border border-line bg-surface p-4 shadow-(--shadow-panel)"
          >
            {primary && <div className="mb-2 text-base font-semibold">{primary.cell(row)}</div>}
            <dl className="grid gap-2">
              {columns
                .filter((c) => c !== primary)
                .map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-4 text-sm">
                    <dt className="shrink-0 text-muted">{c.header}</dt>
                    <dd className="min-w-0 text-end">{c.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
