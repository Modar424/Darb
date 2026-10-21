'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/** URL-driven filter state: shareable, back-button friendly, and the single source of truth. */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  const update = useCallback(
    (patch: Partial<Record<K | 'page', string | number | null>>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === '' || (k === 'page' && Number(v) <= 1))
          next.delete(k);
        else next.set(k, String(v));
      }
      // Any filter change (other than paging itself) returns to the first page.
      if (!('page' in patch)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return { values, page, update };
}
