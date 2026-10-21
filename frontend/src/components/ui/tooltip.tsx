'use client';

import { useId, type ReactNode } from 'react';

/** CSS-only tooltip shown on hover and keyboard focus; the text is also exposed via aria-describedby. */
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      <span aria-describedby={id} className="inline-flex">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute start-1/2 top-full z-30 mt-2 hidden w-max max-w-64 -translate-x-1/2 rounded-md bg-ink-950 px-2.5 py-1.5 text-sm text-white shadow-lg group-focus-within:block group-hover:block rtl:translate-x-1/2"
      >
        {text}
      </span>
    </span>
  );
}
