'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

/**
 * Accessible modal built on the native <dialog>: focus is trapped, Esc closes, and focus returns to the
 * element that opened it. Backdrop click closes unless `dismissible` is false (e.g. while saving).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
  size?: 'md' | 'lg';
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dlg-title"
      aria-describedby={description ? 'dlg-desc' : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
      className={cn(
        'm-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-(--radius-panel) bg-surface p-0 text-text shadow-(--shadow-pop)',
        size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
      )}
    >
      {open && (
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line p-5">
            <div className="min-w-0">
              <h2 id="dlg-title" className="text-xl font-semibold">
                {title}
              </h2>
              {description && (
                <p id="dlg-desc" className="mt-1 text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissible && onClose()}
              disabled={!dismissible}
              aria-label={t('common.close')}
              className="rounded-md p-1.5 text-muted hover:bg-ink-100 disabled:opacity-40"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="p-5">{children}</div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-ink-50 p-4">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
