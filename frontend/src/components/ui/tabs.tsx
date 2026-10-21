'use client';

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}
/** Controlled tabs with roving tabindex; Arrow keys follow the document direction (RTL-aware). */
export function Tabs({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(
    0,
    items.findIndex((i) => i.id === value),
  );

  const move = (e: KeyboardEvent, to: number) => {
    e.preventDefault();
    const next = (to + items.length) % items.length;
    const item = items[next];
    if (!item) return;
    onChange(item.id);
    refs.current[next]?.focus();
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    if (e.key === 'ArrowRight') move(e, rtl ? i - 1 : i + 1);
    else if (e.key === 'ArrowLeft') move(e, rtl ? i + 1 : i - 1);
    else if (e.key === 'Home') move(e, 0);
    else if (e.key === 'End') move(e, items.length - 1);
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {items.map((item, i) => {
          const selected = i === idx;
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${base}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                '-mb-px min-h-11 shrink-0 whitespace-nowrap border-b-2 px-4 text-base font-medium transition-colors',
                selected
                  ? 'border-saffron-500 text-ink-900'
                  : 'border-transparent text-muted hover:text-ink-900',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item, i) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${base}-panel-${item.id}`}
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={i !== idx}
          tabIndex={0}
          className="pt-5"
        >
          {i === idx ? item.content : null}
        </div>
      ))}
    </div>
  );
}
