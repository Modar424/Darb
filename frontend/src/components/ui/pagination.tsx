'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n/provider';
import { Button } from './button';
import type { PageMeta } from '@/lib/api/types';

export function Pagination({ meta, onPage }: { meta: PageMeta; onPage: (page: number) => void }) {
  const { t, num } = useI18n();
  if (meta.totalPages <= 1) return null;
  return (
    <nav
      aria-label={t('common.pagination')}
      className="mt-5 flex items-center justify-between gap-3"
    >
      <Button
        variant="secondary"
        size="sm"
        disabled={meta.page <= 1}
        onClick={() => onPage(meta.page - 1)}
      >
        <ChevronRight className="flip-rtl size-4" aria-hidden />
        {t('common.previous')}
      </Button>
      <span aria-live="polite" className="text-sm text-muted">
        {t('common.pageOf', { page: num(meta.page), total: num(meta.totalPages) })}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={meta.page >= meta.totalPages}
        onClick={() => onPage(meta.page + 1)}
      >
        {t('common.next')}
        <ChevronLeft className="flip-rtl size-4" aria-hidden />
      </Button>
    </nav>
  );
}
