import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export interface Crumb {
  label: string;
  href?: string;
}
export function Breadcrumbs({ items, label }: { items: Crumb[]; label: string }) {
  return (
    <nav aria-label={label} className="mb-3 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="rounded underline-offset-4 hover:text-ink-900 hover:underline"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={last ? 'font-medium text-ink-900' : undefined}
                >
                  {c.label}
                </span>
              )}
              {!last && (
                <ChevronLeft className="flip-rtl size-4 rotate-180 text-ink-600" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
