'use client';

import { useI18n } from '@/i18n/provider';
import { Button } from './button';
import { Dialog } from './dialog';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger = true,
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!loading}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
